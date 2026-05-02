import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import { ALL_ENTITIES, type EntityName, type ImportState } from '@/db/schema'

interface EntityStatus extends ImportState {
  recordCount: number
  lastJobStatus: string | null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conn = await getDb(slug)

  const states = await dbQuery<ImportState>(conn, `SELECT * FROM import_state`)
  const stateMap = Object.fromEntries(states.map((s) => [s.entity_name, s]))

  const result: EntityStatus[] = await Promise.all(
    ALL_ENTITIES.map(async (entity: EntityName) => {
      const state = stateMap[entity] ?? {
        entity_name: entity,
        last_imported_at: null,
        sync_field: '',
        sync_mode: 'incremental',
        last_successful_job_id: null,
        updated_at: null,
      }

      const [countRow] = await dbQuery<{ count: number }>(
        conn,
        `SELECT COUNT(*) as count FROM ${entity}`
      )

      const [lastJob] = await dbQuery<{ status: string }>(
        conn,
        `SELECT status FROM import_jobs WHERE entity_name = ? ORDER BY started_at DESC LIMIT 1`,
        [entity]
      )

      return {
        ...state,
        recordCount: Number(countRow?.count ?? 0),
        lastJobStatus: lastJob?.status ?? null,
      }
    })
  )

  return NextResponse.json(result)
}
