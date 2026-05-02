import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import { ALL_ENTITIES, type EntityName } from '@/db/schema'
import { ENTITY_COLS } from '@/lib/entity-columns'
import * as XLSX from 'xlsx'

const EXPORT_LIMIT = 50_000

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; entity: string }> }
) {
  const { slug, entity } = await params

  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!ALL_ENTITIES.includes(entity as EntityName))
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })

  const entityName = entity as EntityName
  const config = ENTITY_COLS[entityName]
  const allColKeys = config.cols.map((c) => c.key)

  const url = new URL(req.url)
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'
  const search = url.searchParams.get('search') ?? ''
  const rawSort = url.searchParams.get('sortBy') ?? ''
  const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const sortBy = allColKeys.includes(rawSort) ? rawSort : (config.dateCol ?? allColKeys[0] ?? 'id')

  const conn = await getDb(slug)

  const conditions: string[] = []
  const bindValues: unknown[] = []

  if (search && config.searchCols.length > 0) {
    const clauses = config.searchCols.map((col) => `"${col}" ILIKE ?`).join(' OR ')
    conditions.push(`(${clauses})`)
    config.searchCols.forEach(() => bindValues.push(`%${search}%`))
  }

  if (config.dateCol) {
    if (from) { conditions.push(`"${config.dateCol}" >= ?`); bindValues.push(from) }
    if (to) { conditions.push(`"${config.dateCol}" <= ?`); bindValues.push(to + 'T23:59:59.999Z') }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await dbQuery(
    conn,
    `SELECT * FROM ${entityName} ${where} ORDER BY "${sortBy}" ${sortDir} LIMIT ?`,
    [...bindValues, EXPORT_LIMIT]
  )

  const filename = `${slug}-${entityName}-${new Date().toISOString().slice(0, 10)}`

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(rows as object[])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, entityName)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    })
  }

  // CSV
  if (rows.length === 0) {
    return new NextResponse('', {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  const headers = Object.keys(rows[0] as object)
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const csv = [
    headers.join(','),
    ...(rows as Record<string, unknown>[]).map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}
