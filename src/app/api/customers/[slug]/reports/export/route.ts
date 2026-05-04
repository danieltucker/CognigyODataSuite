import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

const ALLOWED: Record<string, string[]> = {
  analytics: [
    'sessionId', 'contactId', 'timestamp', 'intent', 'intentFlow', 'intentScore',
    'channel', 'endpointName', 'snapshotName', 'inputText', 'state', 'mode',
    'userType', 'executionTime', 'projectId', 'organisation', 'flowReferenceId',
    'localeName', 'rating', 'ratingComment',
    'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
    'custom6', 'custom7', 'custom8', 'custom9', 'custom10',
  ],
  sessions: [
    'sessionId', 'userId', 'startedAt', 'endpointName', 'snapshotName',
    'handoverEscalations', 'stepsCount', 'rating', 'ratingComment',
    'projectId', 'projectName', 'localeName',
  ],
  conversations: [
    'sessionId', 'contactId', 'timestamp', 'type', 'source', 'inputText',
    'flowName', 'channel', 'endpointName', 'snapshotName',
    'inHandoverRequest', 'inHandoverConversation', 'projectId',
  ],
  goal_events: [
    'id', 'sessionId', 'goalId', 'timestamp', 'goalCycleId', 'stepId',
    'projectId', 'channel', 'endpointName', 'snapshotName', 'localeName',
  ],
  executed_steps: [
    'sessionId', 'userId', 'timestamp', 'flowName', 'flowReferenceId',
    'stepLabel', 'type', 'entityReferenceId', 'projectId', 'endpointName', 'snapshotName',
  ],
}

function inList(col: string, vals: string[]): string {
  return `${col} IN (${vals.map(() => '?').join(', ')})`
}

function getTimestampCol(entity: string): string {
  return entity === 'sessions' ? 'startedAt' : 'timestamp'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const entity = url.searchParams.get('entity') ?? 'analytics'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')
  const channel = url.searchParams.get('channel') ?? ''
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
  const rawColumns = (url.searchParams.get('columns') ?? '').split(',').filter(Boolean)

  if (!ALLOWED[entity]) return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })

  const safeColumns = rawColumns.filter((c) => (ALLOWED[entity] ?? []).includes(c))
  if (safeColumns.length === 0) return NextResponse.json({ error: 'No valid columns' }, { status: 400 })

  const tsCol = getTimestampCol(entity)
  const conditions: string[] = []
  const bindings: unknown[] = []

  if (from) { conditions.push(`"${tsCol}" >= ?`); bindings.push(from) }
  if (to) { conditions.push(`"${tsCol}" <= ?`); bindings.push(to + 'T23:59:59.999Z') }
  if (channel && (ALLOWED[entity] ?? []).includes('channel')) {
    conditions.push(`"channel" = ?`); bindings.push(channel)
  }
  if (endpoints.length && (ALLOWED[entity] ?? []).includes('endpointName')) {
    conditions.push(inList('"endpointName"', endpoints)); bindings.push(...endpoints)
  }
  if (snapshots.length && (ALLOWED[entity] ?? []).includes('snapshotName')) {
    conditions.push(inList('"snapshotName"', snapshots)); bindings.push(...snapshots)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const selectCols = safeColumns.map((c) => `"${c}"`).join(', ')
  // entity, tsCol, and selectCols are safe only because they are derived entirely from
  // the ALLOWED whitelist — never from raw user input. Keep all ALLOWED keys to [a-z0-9_].

  const conn = await getDb(slug)
  const rows = await dbQuery<Record<string, unknown>>(
    conn,
    `SELECT ${selectCols} FROM ${entity} ${where} ORDER BY "${tsCol}" DESC LIMIT 50000`,
    bindings
  )

  const dateLabel = from && to ? `${from}_${to}` : 'all'
  const filename = `${slug}_${entity}_${dateLabel}`

  if (format === 'csv') {
    const csv = Papa.unparse({ fields: safeColumns, data: rows.map((r) => safeColumns.map((c) => r[c] ?? '')) })
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  // XLSX
  const wsData = [safeColumns, ...rows.map((r) => safeColumns.map((c) => r[c] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, entity.slice(0, 31))
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  })
}
