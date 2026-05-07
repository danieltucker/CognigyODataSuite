// Shared parser for Cognigy "Simulator Metrics" debug log entries that live
// inside Analytics rows' inputData JSON. Used by the dashboard summary card
// and the Agent Evaluations drill-in page.

export interface SimulatorRunRow {
  sessionId: string
  timestamp: string
  endpointName: string | null
  snapshotName: string | null
  inputData: string
}

export interface CriterionResult {
  name: string
  achieved: boolean
  params: Record<string, unknown>
}

export interface ParsedRun {
  sessionId: string
  timestamp: string
  endpointName: string | null
  snapshotName: string | null
  results: CriterionResult[]
  passed: number
  failed: number
  total: number
  status: 'pass' | 'mixed' | 'fail'
}

export interface CriterionAggregate {
  name: string
  passed: number
  failed: number
  total: number
  passRate: number
}

interface SimulatorPayload {
  _cognigy?: {
    _debugLogs?: Array<{
      header: string
      message?: {
        results?: Array<{
          achieved: boolean
          criterion?: { params?: { name?: string } & Record<string, unknown> }
        }>
      }
    }>
  }
}

export function parseSimulatorRun(row: SimulatorRunRow): ParsedRun | null {
  if (!row.inputData) return null
  let data: SimulatorPayload
  try {
    data = JSON.parse(row.inputData) as SimulatorPayload
  } catch {
    return null
  }

  const results: CriterionResult[] = []
  for (const log of data._cognigy?._debugLogs ?? []) {
    if (log.header !== 'Simulator Metrics') continue
    for (const r of log.message?.results ?? []) {
      const params = r.criterion?.params ?? {}
      const name = typeof params.name === 'string' ? params.name.trim() : ''
      if (!name) continue
      results.push({ name, achieved: !!r.achieved, params })
    }
  }

  if (results.length === 0) return null

  const passed = results.filter((r) => r.achieved).length
  const failed = results.length - passed
  const status: ParsedRun['status'] =
    passed === results.length ? 'pass' : passed === 0 ? 'fail' : 'mixed'

  return {
    sessionId: row.sessionId,
    timestamp: row.timestamp,
    endpointName: row.endpointName,
    snapshotName: row.snapshotName,
    results,
    passed,
    failed,
    total: results.length,
    status,
  }
}

export function parseSimulatorRows(rows: SimulatorRunRow[]): ParsedRun[] {
  const out: ParsedRun[] = []
  for (const row of rows) {
    const parsed = parseSimulatorRun(row)
    if (parsed) out.push(parsed)
  }
  return out
}

export function aggregateCriteria(runs: ParsedRun[]): CriterionAggregate[] {
  const map = new Map<string, { passed: number; total: number }>()
  for (const run of runs) {
    for (const r of run.results) {
      const entry = map.get(r.name) ?? { passed: 0, total: 0 }
      entry.total++
      if (r.achieved) entry.passed++
      map.set(r.name, entry)
    }
  }
  return Array.from(map.entries())
    .map(([name, stats]) => ({
      name,
      passed: stats.passed,
      failed: stats.total - stats.passed,
      total: stats.total,
      passRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export function overallPassRate(criteria: CriterionAggregate[]): number {
  const total = criteria.reduce((s, c) => s + c.total, 0)
  const passed = criteria.reduce((s, c) => s + c.passed, 0)
  return total > 0 ? Math.round((passed / total) * 100) : 0
}

export interface DailyTrendPoint {
  date: string
  passRate: number
  total: number
  passed: number
  runs: number
  criteriaCount: number
}

// Daily pass-rate trend for an arbitrary set of runs. Optionally scope to a
// single criterion name. Includes coverage context (run count + distinct
// criteria evaluated) so consumers can disambiguate "low pass rate" from
// "low coverage".
export function dailyTrend(
  runs: ParsedRun[],
  criterionName?: string,
): DailyTrendPoint[] {
  interface Bucket {
    passed: number
    total: number
    runs: number
    criteria: Set<string>
  }
  const buckets = new Map<string, Bucket>()
  for (const run of runs) {
    const date = run.timestamp.slice(0, 10)
    const entry = buckets.get(date) ?? { passed: 0, total: 0, runs: 0, criteria: new Set<string>() }
    entry.runs++
    if (criterionName) {
      for (const r of run.results) {
        if (r.name !== criterionName) continue
        entry.total++
        if (r.achieved) entry.passed++
        entry.criteria.add(r.name)
      }
    } else {
      entry.total += run.total
      entry.passed += run.passed
      for (const r of run.results) entry.criteria.add(r.name)
    }
    buckets.set(date, entry)
  }
  return Array.from(buckets.entries())
    .map(([date, b]) => ({
      date,
      passed: b.passed,
      total: b.total,
      runs: b.runs,
      criteriaCount: b.criteria.size,
      passRate: b.total > 0 ? Math.round((b.passed / b.total) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
