import ky from 'ky'
import { getDb, dbQuery, dbRun, dbExec, bindParam } from '@/db/client'
import { getCustomer } from './customers'
import { ENTITY_CONFIG, ALL_ENTITIES, type EntityName, type ImportState } from '@/db/schema'

export interface ImportJobResult {
  jobId: string
  entityName: EntityName
  status: 'success' | 'failed'
  recordsAdded: number
  totalFetched: number
  error?: string
}

type ODataRecord = Record<string, unknown>

interface ODataResponse {
  value: ODataRecord[]
  '@odata.count'?: number
}

// ---------------------------------------------------------------------------
// Column definitions per entity (matches 001_initial.sql exactly)
// ---------------------------------------------------------------------------

const ENTITY_COLUMNS: Record<EntityName, string[]> = {
  analytics: [
    'id', '_id', 'organisation', 'projectId', 'flowReferenceId', 'entrypoint',
    'ip', 'contactId', 'sessionId', 'inputId', 'inputText', 'inputData',
    'state', 'mode', 'userType', 'channel', 'flowLanguage', 'intent',
    'intentFlow', 'intentScore', 'completedGoalsList', 'foundSlots',
    'foundSlotDetails', 'timestamp', 'executionTime', 'execution',
    'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
    'custom6', 'custom7', 'custom8', 'custom9', 'custom10',
    'localeReferenceId', 'localeName', 'endpointUrlToken', 'endpointName',
    'rating', 'ratingComment', 'snapshotName',
  ],
  conversations: [
    'id', '_id', 'projectId', 'projectName', 'inputId', 'sessionId',
    'contactId', 'organisation', 'inputText', 'inputData', 'type', 'source',
    'timestamp', 'flowName', 'flowParentId', 'channel', 'inHandoverRequest',
    'inHandoverConversation', 'outputId', 'inputAttachments', 'reference',
    'localeReferenceId', 'endpointUrlToken', 'endpointName', 'snapshotId',
    'snapshotName', 'rating', 'ratingComment',
  ],
  steps: [
    'id', '_id', 'label', 'type', 'entityReferenceId', 'flowReferenceId',
    'flowName', 'projectName', 'snapshotId', 'snapshotName',
  ],
  executed_steps: [
    'id', '_id', 'userId', 'sessionId', 'inputId', 'stepLabel', 'parentStep',
    'type', 'entityReferenceId', 'flowReferenceId', 'flowName', 'timestamp',
    'projectName', 'projectId', 'organisationId', 'snapshotId', 'snapshotName',
    'localeReferenceId', 'localeName', 'endpointUrlToken', 'endpointName',
  ],
  sessions: [
    'id', '_id', 'goals', 'stepPath', 'stepsCount', 'handoverEscalations',
    'startedAt', 'userId', 'sessionId', 'localeReferenceId', 'localeName',
    'endpointReferenceId', 'endpointName', 'projectName', 'projectId',
    'organisationId', 'snapshotId', 'snapshotName', 'endpointUrlToken',
    'rating', 'ratingComment',
  ],
  live_agent_escalations: [
    'id', '_id', 'organisationId', 'projectId', 'sessionId', 'timestamp',
    'localeName', 'status', 'inboxId', 'inboxName', 'teamId', 'teamName',
    'labels', 'agentId', 'agentName', 'contactId', 'endpointName',
    'endpointType', 'endpointUrlToken', 'channel', 'localeReferenceId',
    'snapshotId', 'snapshotName',
  ],
  goals: [
    'goalId', 'name', 'version', 'description', 'referenceId', 'projectId',
    'organisationId', 'createdAt', 'lastChanged', 'createdBy', 'lastChangedBy',
  ],
  goal_steps: [
    'goalStepId', 'name', 'version', 'description', 'order', 'text', 'type',
    'goalId', 'projectId', 'organisationId',
  ],
  goal_step_metrics: [
    'goalStepMetricId', 'name', 'version', 'description', 'type', 'value',
    'goalId', 'goalStepId', 'projectId', 'organisationId',
  ],
  goal_events: [
    'id', 'version', 'timestamp', 'goalCycleId', 'stepId', 'goalId',
    'sessionId', 'projectId', 'organisationId', 'expiresAt', 'localeName',
    'endpointName', 'endpointType', 'endpointUrlToken', 'channel',
    'localeReferenceId', 'snapshotId', 'snapshotName',
  ],
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function buildUpsertSQL(entity: EntityName, primaryKey: string, columns: string[]): string {
  const nonPK = columns.filter((c) => c !== primaryKey)
  const colList = columns.map((c) => `"${c}"`).join(', ')
  const placeholders = columns.map(() => '?').join(', ')
  const updateSet = nonPK.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')

  return (
    `INSERT INTO ${entity} (${colList}, "_imported_at") ` +
    `VALUES (${placeholders}, ?) ` +
    `ON CONFLICT ("${primaryKey}") DO UPDATE SET ${updateSet}, "_imported_at" = EXCLUDED."_imported_at"`
  )
}

function serializeValue(val: unknown): unknown {
  if (val === undefined || val === null) return null
  if (typeof val === 'object') return JSON.stringify(val)
  return val
}

// ---------------------------------------------------------------------------
// OData fetch helpers
// ---------------------------------------------------------------------------

async function fetchPage(
  odataUrl: string,
  apiKey: string,
  collection: string,
  params: Record<string, string>
): Promise<ODataResponse> {
  // Build query string manually — URLSearchParams encodes $ as %24,
  // which OData servers reject ($top becomes %24top).
  const base = `${odataUrl.replace(/\/$/, '')}/${collection}`
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = qs ? `${base}?${qs}` : base

  return ky
    .get(url, {
      headers: { apikey: apiKey },
      timeout: 60_000,
      retry: { limit: 3, delay: (attempt) => 1000 * 2 ** attempt },
    })
    .json<ODataResponse>()
}

async function* paginateIncremental(
  odataUrl: string,
  apiKey: string,
  collection: string,
  syncField: string,
  since: Date | null
): AsyncGenerator<ODataRecord[]> {
  const PAGE_SIZE = 1000
  let cursor = since ? since.toISOString() : null
  let pagesYielded = 0

  while (true) {
    const params: Record<string, string> = {
      $top: String(PAGE_SIZE),
      $orderby: `${syncField} asc`,
    }
    if (cursor) params.$filter = `${syncField} gt ${cursor}`

    let data: ODataResponse
    try {
      data = await fetchPage(odataUrl, apiKey, collection, params)
    } catch (err) {
      // Cognigy returns HTTP 500 when the cursor filter reaches/passes the latest
      // record rather than returning an empty page. Treat this as end-of-data
      // whenever we have an active cursor — regardless of whether we've already
      // yielded pages. Without a cursor (first-ever sync) a 500 is a real failure.
      if (cursor !== null) {
        console.warn(`[importer] ${collection}: 500 at cursor ${cursor} (${pagesYielded} pages) — treating as end of data`)
        break
      }
      throw err
    }

    const records = data.value ?? []
    if (records.length === 0) break

    yield records
    pagesYielded++
    if (records.length < PAGE_SIZE) break

    // Advance cursor to avoid high $skip values
    cursor = records[records.length - 1][syncField] as string
  }
}

async function* paginateFullRefresh(
  odataUrl: string,
  apiKey: string,
  collection: string
): AsyncGenerator<ODataRecord[]> {
  const PAGE_SIZE = 1000
  let skip = 0

  while (true) {
    const data = await fetchPage(odataUrl, apiKey, collection, {
      $top: String(PAGE_SIZE),
      $skip: String(skip),
    })
    const records = data.value ?? []
    if (records.length === 0) break

    yield records
    if (records.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }
}

// ---------------------------------------------------------------------------
// Upsert batch
// ---------------------------------------------------------------------------

async function upsertBatch(
  conn: import('@duckdb/node-api').DuckDBConnection,
  entity: EntityName,
  primaryKey: string,
  columns: string[],
  records: ODataRecord[]
): Promise<number> {
  const sql = buildUpsertSQL(entity, primaryKey, columns)
  await conn.run('BEGIN')
  try {
    // Prepare once, re-bind for each record for efficiency
    const stmt = await conn.prepare(sql)
    const importedAt = new Date().toISOString()
    for (const record of records) {
      columns.forEach((col, i) => bindParam(stmt, i + 1, serializeValue(record[col])))
      bindParam(stmt, columns.length + 1, importedAt)
      await stmt.run()
    }
    stmt.destroySync()
    await conn.run('COMMIT')
  } catch (err) {
    await conn.run('ROLLBACK').catch(() => null)
    throw err
  }
  return records.length
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function importEntity(
  slug: string,
  entityName: EntityName,
  options: { full?: boolean; jobId?: string } = {}
): Promise<ImportJobResult> {
  const customer = getCustomer(slug)
  if (!customer) throw new Error(`Customer '${slug}' not found`)

  const config = ENTITY_CONFIG[entityName]
  const columns = ENTITY_COLUMNS[entityName]
  const jobId = options.jobId ?? crypto.randomUUID()

  let conn: import('@duckdb/node-api').DuckDBConnection | undefined
  let totalFetched = 0
  let maxTimestamp: string | null = null

  try {
    conn = await getDb(slug)

    await dbRun(
      conn,
      `INSERT INTO import_jobs (id, entity_name, status) VALUES (?, ?, 'running')`,
      [jobId, entityName]
    )

    // Get current sync state
    const [state] = await dbQuery<ImportState>(
      conn,
      `SELECT * FROM import_state WHERE entity_name = ?`,
      [entityName]
    )

    const isFullRefresh = options.full || config.syncMode === 'full_refresh'

    if (isFullRefresh) {
      await dbExec(conn, `DELETE FROM ${entityName}`)
    }

    const since = (!isFullRefresh && state?.last_imported_at)
      ? new Date(state.last_imported_at as unknown as string)
      : null

    const pages =
      isFullRefresh || !config.syncField
        ? paginateFullRefresh(customer.odataUrl, customer.apiKey, config.odataCollection)
        : paginateIncremental(
            customer.odataUrl,
            customer.apiKey,
            config.odataCollection,
            config.syncField,
            since
          )

    for await (const page of pages) {
      await upsertBatch(conn, entityName, config.primaryKey, columns, page)
      totalFetched += page.length

      // Track max timestamp for incremental high-water mark
      if (config.syncField) {
        for (const record of page) {
          const ts = record[config.syncField] as string | undefined
          if (ts && (!maxTimestamp || ts > maxTimestamp)) maxTimestamp = ts
        }
      }
    }

    // Update import state — always record that a sync ran.
    // For incremental with no new records, advance cursor to now so next run doesn't re-scan.
    const syncedAt = maxTimestamp ?? new Date().toISOString()
    await dbRun(
      conn,
      `UPDATE import_state
       SET last_imported_at = ?, last_successful_job_id = ?, updated_at = current_timestamp
       WHERE entity_name = ?`,
      [syncedAt, jobId, entityName]
    )

    // Mark job success
    await dbRun(
      conn,
      `UPDATE import_jobs
       SET status = 'success', completed_at = current_timestamp,
           records_added = ?, total_fetched = ?
       WHERE id = ?`,
      [totalFetched, totalFetched, jobId]
    )

    return { jobId, entityName, status: 'success', recordsAdded: totalFetched, totalFetched }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[importer] ${slug}/${entityName} failed:`, message)

    if (conn) {
      await dbRun(
        conn,
        `UPDATE import_jobs
         SET status = 'failed', completed_at = current_timestamp, error_message = ?
         WHERE id = ?`,
        [message, jobId]
      ).catch(() => null)
    }

    return { jobId, entityName, status: 'failed', recordsAdded: 0, totalFetched, error: message }
  }
}

export async function importAllEntities(slug: string): Promise<ImportJobResult[]> {
  const results: ImportJobResult[] = []
  for (const entity of ALL_ENTITIES) {
    results.push(await importEntity(slug, entity))
  }
  // Update lastSyncedAt in registry
  const { updateCustomer } = await import('./customers')
  updateCustomer(slug, { lastSyncedAt: new Date().toISOString() })
  return results
}
