import { notFound } from 'next/navigation'
import { getCustomer } from '@/lib/customers'
import { getDb, dbQuery } from '@/db/client'
import { CustomerOverview } from '@/components/customers/customer-overview'
import { ALL_ENTITIES, type EntityName } from '@/db/schema'

interface RawImportState {
  entity_name: EntityName
  last_imported_at: string | Date | null
  sync_field: string
  sync_mode: string
  last_successful_job_id: string | null
  updated_at: string | Date | null
}

interface EntityStatus {
  entity_name: EntityName
  last_imported_at: string | null
  updated_at: string | null
  sync_field: string
  sync_mode: string
  recordCount: number
  lastJobStatus: string | null
}

function toISOOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : String(v)
}

async function getEntityStatuses(slug: string): Promise<EntityStatus[]> {
  const conn = await getDb(slug)
  const states = await dbQuery<RawImportState>(conn, `SELECT * FROM import_state`)
  const stateMap = Object.fromEntries(states.map((s) => [s.entity_name, s]))

  return Promise.all(
    ALL_ENTITIES.map(async (entity: EntityName) => {
      const state = stateMap[entity]
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
        entity_name: entity,
        last_imported_at: toISOOrNull(state?.last_imported_at),
        updated_at: toISOOrNull(state?.updated_at),
        sync_field: state?.sync_field ?? '',
        sync_mode: state?.sync_mode ?? 'incremental',
        recordCount: Number(countRow?.count ?? 0),
        lastJobStatus: lastJob?.status ?? null,
      } satisfies EntityStatus
    })
  )
}

export default async function EntitiesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()

  const statuses = await getEntityStatuses(slug)

  return (
    <CustomerOverview
      slug={slug}
      displayName={customer.displayName}
      initialStatuses={statuses}
    />
  )
}
