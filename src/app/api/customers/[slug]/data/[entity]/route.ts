import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import { ALL_ENTITIES, type EntityName } from '@/db/schema'
import { ENTITY_COLS } from '@/lib/entity-columns'

const FILTERABLE_COLS = ['channel', 'endpointName', 'snapshotName'] as const

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
  const entityColKeySet = new Set(allColKeys)

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50')))
  const search = url.searchParams.get('search') ?? ''
  const rawSort = url.searchParams.get('sortBy') ?? ''
  const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''

  // Validate sort column against known columns to prevent injection
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

  // Column-specific filters (channel, endpointName, snapshotName)
  for (const col of FILTERABLE_COLS) {
    const val = url.searchParams.get(`filter_${col}`) ?? ''
    if (val && entityColKeySet.has(col)) {
      conditions.push(`"${col}" = ?`)
      bindValues.push(val)
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (page - 1) * pageSize

  const [countRow] = await dbQuery<{ count: number }>(
    conn,
    `SELECT COUNT(*) as count FROM ${entityName} ${where}`,
    bindValues
  )
  const total = Number(countRow?.count ?? 0)

  const rows = await dbQuery(
    conn,
    `SELECT * FROM ${entityName} ${where} ORDER BY "${sortBy}" ${sortDir} LIMIT ? OFFSET ?`,
    [...bindValues, pageSize, offset]
  )

  return NextResponse.json({
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}
