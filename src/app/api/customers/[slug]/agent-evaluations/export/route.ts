import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import {
  parseSimulatorRows,
  aggregateCriteria,
  type SimulatorRunRow,
} from '@/lib/simulator-metrics'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

type Sheet = 'runs' | 'criteria'
type Format = 'csv' | 'xlsx'

function inList(col: string, vals: string[]): string {
  return `${col} IN (${vals.map(() => '?').join(', ')})`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const sheet: Sheet = url.searchParams.get('sheet') === 'criteria' ? 'criteria' : 'runs'
  const format: Format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const channel = url.searchParams.get('channel') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')

  const conditions: string[] = [`inputData LIKE '%Simulator Metrics%'`]
  const bindings: unknown[] = []
  if (from) { conditions.push(`"timestamp" >= ?`); bindings.push(from) }
  if (to) { conditions.push(`"timestamp" <= ?`); bindings.push(to + 'T23:59:59.999Z') }
  if (channel) { conditions.push(`"channel" = ?`); bindings.push(channel) }
  if (endpoints.length) { conditions.push(inList('"endpointName"', endpoints)); bindings.push(...endpoints) }
  if (snapshots.length) { conditions.push(inList('"snapshotName"', snapshots)); bindings.push(...snapshots) }

  const conn = await getDb(slug)
  const rows = await dbQuery<SimulatorRunRow>(
    conn,
    `SELECT "sessionId", "timestamp", "endpointName", "snapshotName", "inputData"
     FROM analytics WHERE ${conditions.join(' AND ')}
     ORDER BY "timestamp" DESC`,
    bindings,
  )
  const runs = parseSimulatorRows(rows)

  let columns: string[]
  let data: (string | number)[][]
  let filenameBase: string

  if (sheet === 'criteria') {
    columns = ['name', 'total', 'passed', 'failed', 'passRate']
    data = aggregateCriteria(runs).map((c) => [c.name, c.total, c.passed, c.failed, c.passRate])
    filenameBase = `${slug}_agent-evaluations_criteria`
  } else {
    columns = ['timestamp', 'sessionId', 'endpointName', 'snapshotName', 'total', 'passed', 'failed', 'status', 'failedCriteria']
    data = runs.map((r) => [
      r.timestamp,
      r.sessionId,
      r.endpointName ?? '',
      r.snapshotName ?? '',
      r.total,
      r.passed,
      r.failed,
      r.status,
      r.results.filter((c) => !c.achieved).map((c) => c.name).join('; '),
    ])
    filenameBase = `${slug}_agent-evaluations_runs`
  }

  const dateLabel = from && to ? `_${from}_${to}` : ''
  const filename = `${filenameBase}${dateLabel}`

  if (format === 'csv') {
    const csv = Papa.unparse({ fields: columns, data })
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  const ws = XLSX.utils.aoa_to_sheet([columns, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  })
}
