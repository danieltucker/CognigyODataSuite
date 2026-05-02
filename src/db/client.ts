import path from 'path'
import fs from 'fs'

// Using @duckdb/node-api which supports Node.js 22+ with pre-built binaries
import { DuckDBInstance } from '@duckdb/node-api'
import type { DuckDBConnection } from '@duckdb/node-api'

declare global {
  // eslint-disable-next-line no-var
  var __dbCache: Map<string, DuckDBConnection> | undefined
}

const cache: Map<string, DuckDBConnection> = globalThis.__dbCache ?? new Map()
globalThis.__dbCache = cache

export function getDbPath(slug: string): string {
  return path.join(process.cwd(), 'data', 'customers', slug, 'data.duckdb')
}

export async function getDb(slug: string): Promise<DuckDBConnection> {
  if (cache.has(slug)) return cache.get(slug)!

  const dbPath = getDbPath(slug)
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const instance = await DuckDBInstance.create(dbPath)
  const conn = await instance.connect()
  await runMigrations(conn)
  cache.set(slug, conn)
  return conn
}

export function closeDb(slug: string): void {
  cache.delete(slug)
}

export async function runMigrations(conn: DuckDBConnection): Promise<void> {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'src', 'db', 'migrations', '001_initial.sql'),
    'utf-8'
  )
  // Split into individual statements; conn.run() handles one statement at a time
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await conn.run(stmt)
  }
}

// ---------------------------------------------------------------------------
// Value normalisation — converts DuckDB-specific types to JS primitives
// ---------------------------------------------------------------------------

function normalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null
  if (typeof val === 'bigint') return Number(val)
  if (typeof val === 'object') {
    const name = (val as { constructor?: { name?: string } }).constructor?.name
    if (name === 'DuckDBTimestampTZValue' || name === 'DuckDBTimestampValue') {
      const micros = (val as { micros: bigint }).micros
      return new Date(Number(micros / 1000n)).toISOString()
    }
    if (name === 'DuckDBDateValue') {
      const days = (val as { days: number }).days
      return new Date(days * 86_400_000).toISOString().split('T')[0]
    }
  }
  return val
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(row)) result[key] = normalizeValue(v)
  return result as T
}

// ---------------------------------------------------------------------------
// Parameter binding — maps JS primitives to DuckDB bind methods
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bindParam(stmt: any, idx: number, val: unknown): void {
  if (val === null || val === undefined) {
    stmt.bindNull(idx)
  } else if (typeof val === 'boolean') {
    stmt.bindBoolean(idx, val)
  } else if (typeof val === 'number') {
    Number.isInteger(val) ? stmt.bindInteger(idx, val) : stmt.bindDouble(idx, val)
  } else {
    // Strings, ISO timestamps, serialized JSON — DuckDB auto-casts to target column type
    stmt.bindVarchar(idx, String(val))
  }
}

// ---------------------------------------------------------------------------
// Public query helpers
// ---------------------------------------------------------------------------

export async function dbQuery<T = Record<string, unknown>>(
  conn: DuckDBConnection,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (params.length === 0) {
    const reader = await conn.runAndReadAll(sql)
    return reader.getRowObjects().map((r) => normalizeRow<T>(r as Record<string, unknown>))
  }
  const stmt = await conn.prepare(sql)
  params.forEach((v, i) => bindParam(stmt, i + 1, v))
  const reader = await stmt.runAndReadAll()
  stmt.destroySync()
  return reader.getRowObjects().map((r) => normalizeRow<T>(r as Record<string, unknown>))
}

export async function dbRun(
  conn: DuckDBConnection,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  if (params.length === 0) {
    await conn.run(sql)
    return
  }
  const stmt = await conn.prepare(sql)
  params.forEach((v, i) => bindParam(stmt, i + 1, v))
  await stmt.run()
  stmt.destroySync()
}

export async function dbExec(conn: DuckDBConnection, sql: string): Promise<void> {
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean)
  for (const s of statements) await conn.run(s)
}

// Exposed for the importer's batch upsert — reuses a prepared statement across many rows
export { bindParam }
export type { DuckDBConnection }
