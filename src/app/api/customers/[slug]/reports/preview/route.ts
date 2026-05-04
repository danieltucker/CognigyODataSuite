import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

// Whitelist of queryable tables and their allowed columns.
// Column names match 001_initial.sql exactly — analytics has contactId not userId,
// conversations has inputText not text, executed_steps has stepLabel not nodeId.
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

function validateColumns(entity: string, requested: string[]): string[] {
  const allowed = ALLOWED[entity] ?? []
  return requested.filter((c) => allowed.includes(c))
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
  const limit = Math.min(1000, parseInt(url.searchParams.get('limit') ?? '100', 10))
  const rawColumns = (url.searchParams.get('columns') ?? '').split(',').filter(Boolean)

  if (!ALLOWED[entity]) return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })

  const safeColumns = validateColumns(entity, rawColumns)
  if (safeColumns.length === 0) return NextResponse.json({ rows: [], total: 0, columns: [] })

  const tsCol = getTimestampCol(entity)
  const conditions: string[] = []
  const bindings: unknown[] = []

  if (from) { conditions.push(`"${tsCol}" >= ?`); bindings.push(from) }
  if (to) { conditions.push(`"${tsCol}" <= ?`); bindings.push(to + 'T23:59:59.999Z') }
  if (channel && ALLOWED[entity].includes('channel')) {
    conditions.push(`"channel" = ?`); bindings.push(channel)
  }
  if (endpoints.length && ALLOWED[entity].includes('endpointName')) {
    conditions.push(inList('"endpointName"', endpoints)); bindings.push(...endpoints)
  }
  if (snapshots.length && ALLOWED[entity].includes('snapshotName')) {
    conditions.push(inList('"snapshotName"', snapshots)); bindings.push(...snapshots)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const selectCols = safeColumns.map((c) => `"${c}"`).join(', ')

  try {
    const conn = await getDb(slug)

    const [rows, countRows] = await Promise.all([
      dbQuery<Record<string, unknown>>(
        conn,
        `SELECT ${selectCols} FROM ${entity} ${where} ORDER BY "${tsCol}" DESC LIMIT ?`,
        [...bindings, limit]
      ),
      dbQuery<{ total: number }>(
        conn,
        `SELECT COUNT(*) as total FROM ${entity} ${where}`,
        bindings
      ),
    ])

    return NextResponse.json({
      rows,
      total: Number(countRows[0]?.total ?? 0),
      columns: safeColumns,
    })
  } catch (err) {
    console.error('[reports/preview] query error:', err)
    return NextResponse.json({ error: 'Query failed', rows: [], total: 0, columns: safeColumns }, { status: 500 })
  }
}
