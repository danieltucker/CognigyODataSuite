import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import {
  parseSimulatorRows,
  aggregateCriteria,
  overallPassRate,
  dailyTrend,
  type SimulatorRunRow,
  type ParsedRun,
} from '@/lib/simulator-metrics'

export interface AgentEvaluationsData {
  summary: {
    totalRuns: number
    overallPassRate: number
    criteriaCount: number
    prevPassRate: number | null
    prevTotalRuns: number
    totalChecks: number
    totalPassed: number
  }
  trend: {
    date: string
    passRate: number
    cumulativePassRate: number
    total: number
    passed: number
    runs: number
    criteriaCount: number
  }[]
  criteria: {
    name: string
    total: number
    passed: number
    failed: number
    passRate: number
    deltaVsPrior: number | null
    sparkline: { date: string; passRate: number }[]
  }[]
  runs: {
    sessionId: string
    timestamp: string
    endpointName: string | null
    snapshotName: string | null
    total: number
    passed: number
    failed: number
    status: 'pass' | 'mixed' | 'fail'
    results: { name: string; achieved: boolean }[]
  }[]
  failureSamples: {
    sessionId: string
    timestamp: string
    snapshotName: string | null
    failedCriteria: string[]
  }[]
  availableChannels: string[]
  availableEndpoints: string[]
  availableSnapshots: string[]
}

function inList(col: string, vals: string[]): string {
  return `${col} IN (${vals.map(() => '?').join(', ')})`
}

function buildWhere(opts: {
  from: string
  to: string
  channel: string
  endpoints: string[]
  snapshots: string[]
}): { sql: string; bindings: unknown[] } {
  const conditions: string[] = [`inputData LIKE '%Simulator Metrics%'`]
  const bindings: unknown[] = []
  if (opts.from) { conditions.push(`"timestamp" >= ?`); bindings.push(opts.from) }
  if (opts.to) { conditions.push(`"timestamp" <= ?`); bindings.push(opts.to + 'T23:59:59.999Z') }
  if (opts.channel) { conditions.push(`"channel" = ?`); bindings.push(opts.channel) }
  if (opts.endpoints.length) { conditions.push(inList('"endpointName"', opts.endpoints)); bindings.push(...opts.endpoints) }
  if (opts.snapshots.length) { conditions.push(inList('"snapshotName"', opts.snapshots)); bindings.push(...opts.snapshots) }
  return { sql: `WHERE ${conditions.join(' AND ')}`, bindings }
}

// Fetch + parse all simulator runs matching the filter window.
async function fetchRuns(
  slug: string,
  opts: { from: string; to: string; channel: string; endpoints: string[]; snapshots: string[] },
): Promise<ParsedRun[]> {
  const conn = await getDb(slug)
  const { sql, bindings } = buildWhere(opts)
  const rows = await dbQuery<SimulatorRunRow>(
    conn,
    `SELECT "sessionId", "timestamp", "endpointName", "snapshotName", "inputData"
     FROM analytics ${sql}
     ORDER BY "timestamp" DESC`,
    bindings,
  )
  return parseSimulatorRows(rows)
}

// Shift a YYYY-MM-DD by N days (negative shifts back). If empty input, returns ''.
function shiftDate(iso: string, days: number): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const channel = url.searchParams.get('channel') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')

  const runs = await fetchRuns(slug, { from, to, channel, endpoints, snapshots })

  // Prior-window comparison (same length, immediately preceding)
  let prevRuns: ParsedRun[] = []
  if (from && to) {
    const days = Math.max(
      1,
      Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1,
    )
    const prevTo = shiftDate(from, -1)
    const prevFrom = shiftDate(from, -days)
    prevRuns = await fetchRuns(slug, { from: prevFrom, to: prevTo, channel, endpoints, snapshots })
  }

  const criteriaAgg = aggregateCriteria(runs)
  const prevCriteriaAgg = aggregateCriteria(prevRuns)
  const prevByName = new Map(prevCriteriaAgg.map((c) => [c.name, c]))

  // Daily trend + cumulative running rate from the start of the window. The
  // cumulative line tells "where you currently stand" — partial-coverage days
  // (where only one or two criteria ran) only nudge it slightly, so it stays
  // representative even when the daily line spikes.
  const dailyPoints = dailyTrend(runs)
  let cumPassed = 0
  let cumTotal = 0
  const trend = dailyPoints.map((p) => {
    cumPassed += p.passed
    cumTotal += p.total
    return {
      ...p,
      cumulativePassRate: cumTotal > 0 ? Math.round((cumPassed / cumTotal) * 100) : 0,
    }
  })
  const totalChecks = criteriaAgg.reduce((s, c) => s + c.total, 0)
  const totalPassed = criteriaAgg.reduce((s, c) => s + c.passed, 0)

  // Pull available endpoints/snapshots so the filter bar can populate even
  // when other dashboard data isn't on the page.
  const conn = await getDb(slug)
  const [availableChannelRows, availableEndpointRows, availableSnapshotRows] = await Promise.all([
    dbQuery<{ channel: string }>(
      conn,
      `SELECT DISTINCT channel FROM analytics
       WHERE channel IS NOT NULL AND channel != '' ORDER BY 1`,
      [],
    ),
    dbQuery<{ endpoint: string }>(
      conn,
      `SELECT DISTINCT endpointName as endpoint FROM analytics
       WHERE endpointName IS NOT NULL AND endpointName != '' ORDER BY 1`,
      [],
    ),
    dbQuery<{ snapshotName: string }>(
      conn,
      `SELECT DISTINCT snapshotName FROM analytics
       WHERE snapshotName IS NOT NULL AND snapshotName != '' ORDER BY 1`,
      [],
    ),
  ])

  const result: AgentEvaluationsData = {
    summary: {
      totalRuns: runs.length,
      overallPassRate: overallPassRate(criteriaAgg),
      criteriaCount: criteriaAgg.length,
      prevPassRate: prevRuns.length > 0 ? overallPassRate(prevCriteriaAgg) : null,
      prevTotalRuns: prevRuns.length,
      totalChecks,
      totalPassed,
    },
    trend,
    criteria: criteriaAgg.map((c) => {
      const prior = prevByName.get(c.name)
      return {
        name: c.name,
        total: c.total,
        passed: c.passed,
        failed: c.failed,
        passRate: c.passRate,
        deltaVsPrior: prior ? c.passRate - prior.passRate : null,
        sparkline: dailyTrend(runs, c.name).map((d) => ({ date: d.date, passRate: d.passRate })),
      }
    }),
    runs: runs.map((r) => ({
      sessionId: r.sessionId,
      timestamp: r.timestamp,
      endpointName: r.endpointName,
      snapshotName: r.snapshotName,
      total: r.total,
      passed: r.passed,
      failed: r.failed,
      status: r.status,
      results: r.results.map((res) => ({ name: res.name, achieved: res.achieved })),
    })),
    failureSamples: runs
      .filter((r) => r.failed > 0)
      .slice(0, 10)
      .map((r) => ({
        sessionId: r.sessionId,
        timestamp: r.timestamp,
        snapshotName: r.snapshotName,
        failedCriteria: r.results.filter((c) => !c.achieved).map((c) => c.name),
      })),
    availableChannels: availableChannelRows.map((r) => r.channel),
    availableEndpoints: availableEndpointRows.map((r) => r.endpoint),
    availableSnapshots: availableSnapshotRows.map((r) => r.snapshotName),
  }

  return NextResponse.json(result)
}
