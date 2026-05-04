import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

export interface SessionRow {
  sessionId: string | null
  userId: string | null
  endpointName: string | null
  snapshotName: string | null
  startedAt: string | null
  messageCount: number
  lastMessageAt: string | null
  handoverEscalations: number | null
  rating: number | null
  ratingComment: string | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const search = url.searchParams.get('search') ?? ''
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')
  const hideEmpty = url.searchParams.get('hideEmpty') !== 'false'

  const conn = await getDb(slug)

  const conditions: string[] = []
  const binds: unknown[] = []

  // Sessions with a null sessionId can never match a conversation — exclude always.
  conditions.push(`s."sessionId" IS NOT NULL`)

  if (from) { conditions.push(`s."startedAt" >= ?`); binds.push(from) }
  if (to) { conditions.push(`s."startedAt" <= ?`); binds.push(to + 'T23:59:59.999Z') }

  if (endpoints.length > 0) {
    const placeholders = endpoints.map(() => '?').join(', ')
    conditions.push(`s."endpointName" IN (${placeholders})`)
    binds.push(...endpoints)
  }

  if (snapshots.length > 0) {
    const placeholders = snapshots.map(() => '?').join(', ')
    conditions.push(`s."snapshotName" IN (${placeholders})`)
    binds.push(...snapshots)
  }

  if (search) {
    conditions.push(`(s."sessionId" ILIKE ? OR s."userId" ILIKE ?)`)
    binds.push(`%${search}%`, `%${search}%`)
  }

  if (hideEmpty) conditions.push(`COALESCE(m.messageCount, 0) > 0`)

  const where = `WHERE ${conditions.join(' AND ')}`
  const offset = (page - 1) * pageSize

  const msgSubquery = `LEFT JOIN (
      SELECT "sessionId", COUNT(*) AS messageCount, MAX("timestamp") AS lastMessageAt
      FROM conversations
      GROUP BY "sessionId"
    ) m ON s."sessionId" = m."sessionId"`

  const [{ total }] = await dbQuery<{ total: number }>(
    conn,
    `SELECT COUNT(*) AS total FROM sessions s ${msgSubquery} ${where}`,
    binds
  )

  const sessions = await dbQuery<SessionRow>(
    conn,
    `SELECT
      s."sessionId",
      s."userId",
      s."endpointName",
      s."snapshotName",
      s."startedAt",
      s."handoverEscalations",
      s."rating",
      s."ratingComment",
      COALESCE(m.messageCount, 0) AS messageCount,
      m.lastMessageAt
    FROM sessions s
    ${msgSubquery}
    ${where}
    ORDER BY s."startedAt" DESC NULLS LAST
    LIMIT ? OFFSET ?`,
    [...binds, pageSize, offset]
  )

  const [endpointRows, snapshotRows] = await Promise.all([
    dbQuery<{ endpointName: string }>(
      conn,
      `SELECT DISTINCT "endpointName" FROM sessions WHERE "endpointName" IS NOT NULL ORDER BY "endpointName"`
    ),
    dbQuery<{ snapshotName: string }>(
      conn,
      `SELECT DISTINCT "snapshotName" FROM sessions WHERE "snapshotName" IS NOT NULL ORDER BY "snapshotName"`
    ),
  ])

  return NextResponse.json({
    sessions,
    total: Number(total),
    page,
    pageSize,
    hideEmpty,
    availableEndpoints: endpointRows.map((e) => e.endpointName),
    availableSnapshots: snapshotRows.map((s) => s.snapshotName),
  })
}
