import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import { ALL_ENTITIES, type EntityName } from '@/db/schema'
import { ENTITY_COLS } from '@/lib/entity-columns'

const FILTERABLE = ['channel', 'endpointName', 'snapshotName'] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; entity: string }> }
) {
  const { slug, entity } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!ALL_ENTITIES.includes(entity as EntityName))
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })

  const entityName = entity as EntityName
  const entityColKeys = new Set(ENTITY_COLS[entityName].cols.map((c) => c.key))
  const conn = await getDb(slug)

  const result: Record<string, string[]> = {}
  await Promise.all(
    FILTERABLE.filter((col) => entityColKeys.has(col)).map(async (col) => {
      const rows = await dbQuery<{ val: string }>(
        conn,
        `SELECT DISTINCT "${col}" as val FROM ${entityName} WHERE "${col}" IS NOT NULL AND "${col}" != '' ORDER BY 1`
      )
      result[col] = rows.map((r) => String(r.val))
    })
  )

  return NextResponse.json(result)
}
