import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

const TOP_TREND_BUCKETS = 5
const INTENT_LIMIT = 100

export interface IntentsData {
  summary: {
    totalTurns: number
    matchedTurns: number
    unmatchedTurns: number
    matchedRate: number
    distinctIntents: number
    avgScore: number | null
  }
  trendIntents: string[]               // top-5 intents represented in the stacked trend
  trend: { date: string; counts: Record<string, number> }[]
  intents: {
    name: string
    turns: number
    sessions: number
    share: number                       // % of all matched turns
    avgScore: number | null
    medianScore: number | null
    p10Score: number | null
    p90Score: number | null
    escalatedSessions: number
    goalCompletedSessions: number
    avgRating: number | null
    ratedSessions: number
    sparkline: { date: string; count: number }[]
  }[]
  availableChannels: string[]
  availableEndpoints: string[]
  availableSnapshots: string[]
}

function inList(col: string, vals: string[]): string {
  return `${col} IN (${vals.map(() => '?').join(', ')})`
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

  // Analytics filters (timestamp, channel, endpoint, snapshot)
  const aC: string[] = []
  const aB: unknown[] = []
  if (from) { aC.push(`"timestamp" >= ?`); aB.push(from) }
  if (to) { aC.push(`"timestamp" <= ?`); aB.push(to + 'T23:59:59.999Z') }
  if (channel) { aC.push(`"channel" = ?`); aB.push(channel) }
  if (endpoints.length) { aC.push(inList('"endpointName"', endpoints)); aB.push(...endpoints) }
  if (snapshots.length) { aC.push(inList('"snapshotName"', snapshots)); aB.push(...snapshots) }
  const aWhere = aC.length ? `WHERE ${aC.join(' AND ')}` : ''
  const aAndPrefix = aC.length ? 'AND ' + aC.join(' AND ') : ''

  const conn = await getDb(slug)

  const [
    summaryRows,
    intentRows,
    sparklineRows,
    outcomeRows,
    availableChannelRows,
    availableEndpointRows,
    availableSnapshotRows,
  ] = await Promise.all([
    // Header KPIs — totals, matched/unmatched, distinct intents, avg score
    dbQuery<{
      totalTurns: number
      matchedTurns: number
      unmatchedTurns: number
      distinctIntents: number
      avgScore: number | null
    }>(
      conn,
      `SELECT
         COUNT(*) as totalTurns,
         COUNT(*) FILTER (WHERE intent IS NOT NULL AND intent != '') as matchedTurns,
         COUNT(*) FILTER (WHERE intent IS NULL OR intent = '') as unmatchedTurns,
         COUNT(DISTINCT intent) FILTER (WHERE intent IS NOT NULL AND intent != '') as distinctIntents,
         AVG(intentScore) FILTER (WHERE intent IS NOT NULL AND intent != '') as avgScore
       FROM analytics ${aWhere}`,
      aB,
    ),

    // Per-intent: turns, distinct sessions, confidence quantiles. Capped to
    // INTENT_LIMIT to keep the table sane on bots with extremely long tails.
    dbQuery<{
      intent: string
      turns: number
      sessions: number
      avgScore: number | null
      medianScore: number | null
      p10Score: number | null
      p90Score: number | null
    }>(
      conn,
      `SELECT
         intent,
         COUNT(*) as turns,
         COUNT(DISTINCT sessionId) as sessions,
         AVG(intentScore) as avgScore,
         quantile_cont(intentScore, 0.5) as medianScore,
         quantile_cont(intentScore, 0.1) as p10Score,
         quantile_cont(intentScore, 0.9) as p90Score
       FROM analytics
       WHERE intent IS NOT NULL AND intent != '' ${aAndPrefix}
       GROUP BY intent
       ORDER BY turns DESC
       LIMIT ${INTENT_LIMIT}`,
      aB,
    ),

    // Daily counts per intent — for sparklines + the stacked trend chart
    dbQuery<{ date: string; intent: string; count: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, intent, COUNT(*) as count
       FROM analytics
       WHERE intent IS NOT NULL AND intent != '' ${aAndPrefix}
       GROUP BY 1, 2
       ORDER BY 1`,
      aB,
    ),

    // Outcome correlation — joins analytics → sessions → goal_events. Filters
    // are applied on analytics only, so this answers "for sessions whose
    // intent X fired during the window, what % escalated / completed a goal /
    // averaged what rating?" The session-level stats (escalation, rating,
    // goals) themselves aren't time-filtered — we want to know the eventual
    // outcome of those sessions.
    dbQuery<{
      intent: string
      escalatedSessions: number
      goalCompletedSessions: number
      avgRating: number | null
      ratedSessions: number
    }>(
      conn,
      `WITH intent_sessions AS (
         SELECT DISTINCT a.intent, a.sessionId
         FROM analytics a
         WHERE a.intent IS NOT NULL AND a.intent != '' ${aC.length ? 'AND ' + aC.join(' AND ') : ''}
       ),
       goal_sessions AS (
         SELECT DISTINCT sessionId FROM goal_events WHERE sessionId IS NOT NULL
       )
       SELECT iso.intent,
              COUNT(*) FILTER (WHERE s.handoverEscalations > 0) as escalatedSessions,
              COUNT(*) FILTER (WHERE gs.sessionId IS NOT NULL) as goalCompletedSessions,
              AVG(s.rating) FILTER (WHERE s.rating IS NOT NULL) as avgRating,
              COUNT(*) FILTER (WHERE s.rating IS NOT NULL) as ratedSessions
       FROM intent_sessions iso
       LEFT JOIN sessions s ON s.sessionId = iso.sessionId
       LEFT JOIN goal_sessions gs ON gs.sessionId = iso.sessionId
       GROUP BY iso.intent`,
      aB,
    ),

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

  const summary = summaryRows[0]
  const matchedTurns = Number(summary?.matchedTurns ?? 0)
  const unmatchedTurns = Number(summary?.unmatchedTurns ?? 0)
  const totalTurns = Number(summary?.totalTurns ?? 0)

  // Build sparkline map: intent -> [{date, count}]
  const sparklinesByIntent = new Map<string, { date: string; count: number }[]>()
  for (const row of sparklineRows) {
    const arr = sparklinesByIntent.get(row.intent) ?? []
    arr.push({ date: row.date, count: Number(row.count) })
    sparklinesByIntent.set(row.intent, arr)
  }

  // Outcome correlation lookup
  const outcomeByIntent = new Map<string, {
    escalatedSessions: number
    goalCompletedSessions: number
    avgRating: number | null
    ratedSessions: number
  }>()
  for (const row of outcomeRows) {
    outcomeByIntent.set(row.intent, {
      escalatedSessions: Number(row.escalatedSessions ?? 0),
      goalCompletedSessions: Number(row.goalCompletedSessions ?? 0),
      avgRating: row.avgRating != null ? Number(row.avgRating) : null,
      ratedSessions: Number(row.ratedSessions ?? 0),
    })
  }

  // Top-5 intents represented in the stacked trend
  const topTrend = intentRows.slice(0, TOP_TREND_BUCKETS).map((r) => r.intent)
  const topSet = new Set(topTrend)
  const trendByDate = new Map<string, Record<string, number>>()
  for (const row of sparklineRows) {
    const bucket = topSet.has(row.intent) ? row.intent : 'Other'
    const day = trendByDate.get(row.date) ?? {}
    day[bucket] = (day[bucket] ?? 0) + Number(row.count)
    trendByDate.set(row.date, day)
  }
  const trend = Array.from(trendByDate.entries())
    .map(([date, counts]) => ({ date, counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const result: IntentsData = {
    summary: {
      totalTurns,
      matchedTurns,
      unmatchedTurns,
      matchedRate: totalTurns > 0 ? Math.round((matchedTurns / totalTurns) * 100) : 0,
      distinctIntents: Number(summary?.distinctIntents ?? 0),
      avgScore: summary?.avgScore != null ? Number(summary.avgScore) : null,
    },
    trendIntents: topTrend,
    trend,
    intents: intentRows.map((r) => {
      const turns = Number(r.turns)
      const outcome = outcomeByIntent.get(r.intent)
      return {
        name: r.intent,
        turns,
        sessions: Number(r.sessions),
        share: matchedTurns > 0 ? Math.round((turns / matchedTurns) * 1000) / 10 : 0,
        avgScore: r.avgScore != null ? Number(r.avgScore) : null,
        medianScore: r.medianScore != null ? Number(r.medianScore) : null,
        p10Score: r.p10Score != null ? Number(r.p10Score) : null,
        p90Score: r.p90Score != null ? Number(r.p90Score) : null,
        escalatedSessions: outcome?.escalatedSessions ?? 0,
        goalCompletedSessions: outcome?.goalCompletedSessions ?? 0,
        avgRating: outcome?.avgRating ?? null,
        ratedSessions: outcome?.ratedSessions ?? 0,
        sparkline: sparklinesByIntent.get(r.intent) ?? [],
      }
    }),
    availableChannels: availableChannelRows.map((r) => r.channel),
    availableEndpoints: availableEndpointRows.map((r) => r.endpoint),
    availableSnapshots: availableSnapshotRows.map((r) => r.snapshotName),
  }

  return NextResponse.json(result)
}
