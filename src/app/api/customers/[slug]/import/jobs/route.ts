import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import type { ImportJob } from '@/db/schema'

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conn = await getDb(slug)
  const jobs = await dbQuery<ImportJob>(
    conn,
    `SELECT * FROM import_jobs ORDER BY started_at DESC LIMIT 50`
  )

  return NextResponse.json(jobs)
}
