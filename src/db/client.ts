import path from 'path'
import fs from 'fs'

import { DuckDBInstance } from '@duckdb/node-api'
import type { DuckDBConnection } from '@duckdb/node-api'

// ---------------------------------------------------------------------------
// Connection cache — stores the in-flight Promise so concurrent requests that
// all find the cache empty don't each race to open the same .duckdb file.
// Using globalThis survives Next.js HMR module reloads.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __dbCache: Map<string, Promise<DuckDBConnection>> | undefined
}

const cache: Map<string, Promise<DuckDBConnection>> =
  globalThis.__dbCache ?? new Map()
globalThis.__dbCache = cache

export function getDbPath(slug: string): string {
  return path.join(process.cwd(), 'data', 'customers', slug, 'data.duckdb')
}

async function openConnection(slug: string): Promise<DuckDBConnection> {
  const dbPath = getDbPath(slug)
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // Retry up to 5× with back-off in case another process (e.g. a stale dev
  // server that didn't exit cleanly) is still holding the DuckDB write lock.
  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const instance = await DuckDBInstance.create(dbPath)
      const conn = await instance.connect()
      await runMigrations(conn)
      return conn
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Could not set lock') && attempt < 4) {
        lastErr = err
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

export async function getDb(slug: string): Promise<DuckDBConnection> {
  if (!cache.has(slug)) {
    // Store the Promise immediately so any concurrent call awaits the same one
    // instead of launching a second DuckDBInstance.create() for the same file.
    const p = openConnection(slug).catch((err) => {
      cache.delete(slug) // evict so the next call can retry
      throw err
    })
    cache.set(slug, p)
  }
  return cache.get(slug)!
}

export function closeDb(slug: string): void {
  cache.delete(slug)
}

export async function runMigrations(conn: DuckDBConnection): Promise<void> {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'src', 'db', 'migrations', '001_initial.sql'),
    'utf-8'
  )
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await conn.run(stmt)
  }
}

// ---------------------------------------------------------------------------
// Value normalisation
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
// Parameter binding
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

export { bindParam }
export type { DuckDBConnection }
