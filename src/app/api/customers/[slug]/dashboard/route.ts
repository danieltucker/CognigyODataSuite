import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

export interface DashboardData {
  sessionVolume: { date: string; sessions: number }[]
  uniqueUsersPerDay: { date: string; uniqueUsers: number }[]
  topIntents: { intent: string; count: number }[]
  channelDistribution: { channel: string; count: number }[]
  avgExecutionTime: { date: string; avgMs: number }[]
  escalationRate: { escalated: number; total: number }
  escalationTrend: { date: string; escalations: number; sessions: number }[]
  intentScoreDistribution: { bucket: string; count: number }[]
  summary: {
    totalSessions: number
    totalConversations: number
    totalEscalations: number
    avgIntentScore: number | null
    totalGoalEvents: number
  }
  uniqueUsersTotal: number
  avgSessionDuration: number | null
  goalCompletionRate: { withGoal: number; total: number }
  goalsSummary: {
    topGoals: { name: string; count: number }[]
    goalEventsByDay: { date: string; events: number }[]
  }
  topFlows: { flowName: string; count: number }[]
  topExecutedSteps: { stepLabel: string; count: number }[]
  llmErrors: { errorTurns: number; totalTurns: number }
  agentEvaluation: {
    totalRuns: number
    overallPassRate: number
    criteria: { name: string; passed: number; total: number; passRate: number }[]
  } | null
  availableChannels: string[]
  availableEndpoints: string[]
  availableSnapshots: string[]
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const channel = url.searchParams.get('channel') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')

  const conn = await getDb(slug)

  // ---------------------------------------------------------------------------
  // Build per-table filter sets
  // ---------------------------------------------------------------------------

  function inList(col: string, vals: string[]): string {
    return `${col} IN (${vals.map(() => '?').join(', ')})`
  }

  // Analytics (timestamp + channel + endpoint + snapshot)
  const aC: string[] = []
  const aB: unknown[] = []
  if (from) { aC.push(`"timestamp" >= ?`); aB.push(from) }
  if (to) { aC.push(`"timestamp" <= ?`); aB.push(to + 'T23:59:59.999Z') }
  if (channel) { aC.push(`"channel" = ?`); aB.push(channel) }
  if (endpoints.length) { aC.push(inList('"endpointName"', endpoints)); aB.push(...endpoints) }
  if (snapshots.length) { aC.push(inList('"snapshotName"', snapshots)); aB.push(...snapshots) }
  const aWhere = aC.length ? `WHERE ${aC.join(' AND ')}` : ''

  // Date-only filter (conversations, goal_events, live_agent_escalations)
  const dC: string[] = []
  const dB: unknown[] = []
  if (from) { dC.push(`"timestamp" >= ?`); dB.push(from) }
  if (to) { dC.push(`"timestamp" <= ?`); dB.push(to + 'T23:59:59.999Z') }
  const dWhere = dC.length ? `WHERE ${dC.join(' AND ')}` : ''

  // Sessions (startedAt + endpoint + snapshot)
  const sC: string[] = []
  const sB: unknown[] = []
  if (from) { sC.push(`"startedAt" >= ?`); sB.push(from) }
  if (to) { sC.push(`"startedAt" <= ?`); sB.push(to + 'T23:59:59.999Z') }
  if (endpoints.length) { sC.push(inList('"endpointName"', endpoints)); sB.push(...endpoints) }
  if (snapshots.length) { sC.push(inList('"snapshotName"', snapshots)); sB.push(...snapshots) }
  const sWhere = sC.length ? `WHERE ${sC.join(' AND ')}` : ''

  // Executed steps (timestamp + endpoint + snapshot)
  const eC: string[] = []
  const eB: unknown[] = []
  if (from) { eC.push(`"timestamp" >= ?`); eB.push(from) }
  if (to) { eC.push(`"timestamp" <= ?`); eB.push(to + 'T23:59:59.999Z') }
  if (endpoints.length) { eC.push(inList('"endpointName"', endpoints)); eB.push(...endpoints) }
  if (snapshots.length) { eC.push(inList('"snapshotName"', snapshots)); eB.push(...snapshots) }

  const [
    sessionVolume,
    uniqueUsersPerDay,
    topIntents,
    channelDistribution,
    avgExecutionTime,
    intentScoreRows,
    summaryAnalytics,
    summaryConversations,
    summaryEscalations,
    summarySessions,
    availableChannelRows,
    availableEndpointRows,
    availableSnapshotRows,
    goalEventsTotal,
    topGoalsRows,
    goalEventsByDayRows,
    topFlowsRows,
    llmErrorRows,
    simulatorRows,
    uniqueUsersTotalRows,
    avgDurationRows,
    goalCompletionRows,
    escalationTrendRows,
    topExecutedStepsRows,
  ] = await Promise.all([
    dbQuery<{ date: string; sessions: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, COUNT(*) as sessions
       FROM analytics ${aWhere} GROUP BY 1 ORDER BY 1`,
      aB
    ),

    dbQuery<{ date: string; uniqueUsers: number }>(
      conn,
      `SELECT strftime("startedAt", '%Y-%m-%d') as date, COUNT(DISTINCT "userId") as uniqueUsers
       FROM sessions
       ${sC.length ? `WHERE "userId" IS NOT NULL AND ${sC.join(' AND ')}` : `WHERE "userId" IS NOT NULL`}
       GROUP BY 1 ORDER BY 1`,
      sB
    ),

    dbQuery<{ intent: string; count: number }>(
      conn,
      `SELECT intent, COUNT(*) as count FROM analytics
       ${aWhere ? aWhere + ' AND' : 'WHERE'} intent IS NOT NULL AND intent != ''
       GROUP BY intent ORDER BY count DESC LIMIT 10`,
      aB
    ),

    dbQuery<{ channel: string; count: number }>(
      conn,
      `SELECT COALESCE(channel, 'unknown') as channel, COUNT(*) as count
       FROM analytics ${aWhere} GROUP BY channel ORDER BY count DESC`,
      aB
    ),

    dbQuery<{ date: string; avgMs: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, ROUND(AVG(executionTime), 0) as avgMs
       FROM analytics ${aWhere ? aWhere + ' AND' : 'WHERE'} executionTime IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      aB
    ),

    dbQuery<{ bucket: string; count: number }>(
      conn,
      `SELECT CASE
         WHEN intentScore < 0.1 THEN '0.0–0.1' WHEN intentScore < 0.2 THEN '0.1–0.2'
         WHEN intentScore < 0.3 THEN '0.2–0.3' WHEN intentScore < 0.4 THEN '0.3–0.4'
         WHEN intentScore < 0.5 THEN '0.4–0.5' WHEN intentScore < 0.6 THEN '0.5–0.6'
         WHEN intentScore < 0.7 THEN '0.6–0.7' WHEN intentScore < 0.8 THEN '0.7–0.8'
         WHEN intentScore < 0.9 THEN '0.8–0.9' ELSE '0.9–1.0'
       END as bucket, COUNT(*) as count
       FROM analytics ${aWhere ? aWhere + ' AND' : 'WHERE'} intentScore IS NOT NULL
       GROUP BY bucket ORDER BY bucket`,
      aB
    ),

    dbQuery<{ total: number; avgScore: number | null }>(
      conn,
      `SELECT COUNT(*) as total, ROUND(AVG(intentScore), 3) as avgScore FROM analytics ${aWhere}`,
      aB
    ),

    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM conversations ${dWhere}`,
      dB
    ),

    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM live_agent_escalations ${dWhere}`,
      dB
    ),

    dbQuery<{ total: number; escalated: number }>(
      conn,
      `SELECT COUNT(*) as total, SUM(CASE WHEN handoverEscalations > 0 THEN 1 ELSE 0 END) as escalated
       FROM sessions ${sWhere}`,
      sB
    ),

    dbQuery<{ channel: string }>(
      conn,
      `SELECT DISTINCT COALESCE(channel, 'unknown') as channel FROM analytics WHERE channel IS NOT NULL ORDER BY 1`
    ),

    dbQuery<{ endpoint: string }>(
      conn,
      `SELECT DISTINCT endpointName as endpoint FROM analytics WHERE endpointName IS NOT NULL AND endpointName != '' ORDER BY 1`
    ),

    dbQuery<{ snapshotName: string }>(
      conn,
      `SELECT DISTINCT "snapshotName" FROM sessions WHERE "snapshotName" IS NOT NULL ORDER BY 1`
    ),

    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM goal_events ${dWhere}`,
      dB
    ),

    dbQuery<{ name: string; count: number }>(
      conn,
      `SELECT COALESCE(g.name, sub.goalId) as name, sub.cnt as count
       FROM (
         SELECT goalId, COUNT(*) as cnt FROM goal_events ${dWhere}
         GROUP BY goalId ORDER BY cnt DESC LIMIT 10
       ) sub
       LEFT JOIN goals g ON sub.goalId = g.goalId
       ORDER BY sub.cnt DESC`,
      dB
    ),

    dbQuery<{ date: string; events: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, COUNT(*) as events
       FROM goal_events ${dWhere} GROUP BY 1 ORDER BY 1`,
      dB
    ),

    dbQuery<{ flowName: string; count: number }>(
      conn,
      `SELECT flowName, COUNT(*) as count FROM executed_steps
       WHERE flowName IS NOT NULL AND flowName != ''
       ${eC.length ? 'AND ' + eC.join(' AND ') : ''}
       GROUP BY flowName ORDER BY count DESC LIMIT 10`,
      eB
    ),

    dbQuery<{ totalTurns: number; errorTurns: number }>(
      conn,
      `SELECT
         COUNT(*) as totalTurns,
         SUM(CASE WHEN inputData LIKE '%Bad Request Error%' OR inputData LIKE '%LLM_PROMPT__ERROR%' THEN 1 ELSE 0 END) as errorTurns
       FROM conversations ${dWhere}`,
      dB
    ),

    dbQuery<{ inputData: string }>(
      conn,
      `SELECT inputData FROM analytics
       WHERE inputData LIKE '%Simulator Metrics%'
       ${aC.length ? 'AND ' + aC.join(' AND ') : ''}`,
      aB
    ),

    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(DISTINCT userId) as total FROM sessions
       WHERE userId IS NOT NULL ${sC.length ? 'AND ' + sC.join(' AND ') : ''}`,
      sB
    ),

    dbQuery<{ avgSeconds: number | null }>(
      conn,
      `SELECT ROUND(AVG(date_diff('second', minTs, maxTs)), 0) as avgSeconds
       FROM (
         SELECT sessionId, MIN(timestamp) as minTs, MAX(timestamp) as maxTs
         FROM analytics ${aWhere}
         GROUP BY sessionId HAVING COUNT(*) > 1
       ) sub`,
      aB
    ),

    dbQuery<{ withGoal: number }>(
      conn,
      `SELECT COUNT(DISTINCT sessionId) as withGoal FROM goal_events ${dWhere}`,
      dB
    ),

    dbQuery<{ date: string; escalations: number; sessions: number }>(
      conn,
      `SELECT strftime("startedAt", '%Y-%m-%d') as date,
              COUNT(*) as sessions,
              SUM(CASE WHEN handoverEscalations > 0 THEN 1 ELSE 0 END) as escalations
       FROM sessions ${sWhere} GROUP BY 1 ORDER BY 1`,
      sB
    ),

    dbQuery<{ stepLabel: string; count: number }>(
      conn,
      `SELECT stepLabel, COUNT(*) as count FROM executed_steps
       WHERE stepLabel IS NOT NULL AND stepLabel != ''
       ${eC.length ? 'AND ' + eC.join(' AND ') : ''}
       GROUP BY stepLabel ORDER BY count DESC LIMIT 15`,
      eB
    ),
  ])

  // Parse simulator metrics
  const criteriaMap = new Map<string, { achieved: number; total: number }>()
  for (const row of simulatorRows) {
    if (!row.inputData) continue
    try {
      const data = JSON.parse(row.inputData) as {
        _cognigy?: { _debugLogs?: Array<{ header: string; message?: { results?: Array<{ achieved: boolean; criterion?: { params?: { name?: string } } }> } }> }
      }
      for (const log of data._cognigy?._debugLogs ?? []) {
        if (log.header !== 'Simulator Metrics') continue
        for (const result of log.message?.results ?? []) {
          const name = result.criterion?.params?.name?.trim()
          if (!name) continue
          const entry = criteriaMap.get(name) ?? { achieved: 0, total: 0 }
          entry.total++
          if (result.achieved) entry.achieved++
          criteriaMap.set(name, entry)
        }
      }
    } catch { /* malformed — skip */ }
  }

  const criteria = Array.from(criteriaMap.entries())
    .map(([name, stats]) => ({
      name,
      passed: stats.achieved,
      total: stats.total,
      passRate: stats.total > 0 ? Math.round((stats.achieved / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const totalCriteriaChecks = criteria.reduce((s, c) => s + c.total, 0)
  const totalPassed = criteria.reduce((s, c) => s + c.passed, 0)

  const totalSessions = Number(summarySessions[0]?.total ?? 0)

  const result: DashboardData = {
    sessionVolume: sessionVolume.map((r) => ({ date: r.date, sessions: Number(r.sessions) })),
    uniqueUsersPerDay: uniqueUsersPerDay.map((r) => ({ date: r.date, uniqueUsers: Number(r.uniqueUsers) })),
    topIntents: topIntents.map((r) => ({ intent: r.intent, count: Number(r.count) })),
    channelDistribution: channelDistribution.map((r) => ({ channel: r.channel, count: Number(r.count) })),
    avgExecutionTime: avgExecutionTime.map((r) => ({ date: r.date, avgMs: Number(r.avgMs) })),
    escalationRate: {
      escalated: Number(summarySessions[0]?.escalated ?? 0),
      total: totalSessions,
    },
    escalationTrend: escalationTrendRows.map((r) => ({
      date: r.date,
      escalations: Number(r.escalations),
      sessions: Number(r.sessions),
    })),
    intentScoreDistribution: intentScoreRows.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
    summary: {
      totalSessions,
      totalConversations: Number(summaryConversations[0]?.total ?? 0),
      totalEscalations: Number(summaryEscalations[0]?.total ?? 0),
      avgIntentScore: summaryAnalytics[0]?.avgScore ?? null,
      totalGoalEvents: Number(goalEventsTotal[0]?.total ?? 0),
    },
    uniqueUsersTotal: Number(uniqueUsersTotalRows[0]?.total ?? 0),
    avgSessionDuration: avgDurationRows[0]?.avgSeconds != null ? Number(avgDurationRows[0].avgSeconds) : null,
    goalCompletionRate: {
      withGoal: Number(goalCompletionRows[0]?.withGoal ?? 0),
      total: totalSessions,
    },
    goalsSummary: {
      topGoals: topGoalsRows.map((r) => ({ name: r.name, count: Number(r.count) })),
      goalEventsByDay: goalEventsByDayRows.map((r) => ({ date: r.date, events: Number(r.events) })),
    },
    topFlows: topFlowsRows.map((r) => ({ flowName: r.flowName, count: Number(r.count) })),
    topExecutedSteps: topExecutedStepsRows.map((r) => ({ stepLabel: r.stepLabel, count: Number(r.count) })),
    llmErrors: {
      errorTurns: Number(llmErrorRows[0]?.errorTurns ?? 0),
      totalTurns: Number(llmErrorRows[0]?.totalTurns ?? 0),
    },
    agentEvaluation: simulatorRows.length > 0
      ? {
          totalRuns: simulatorRows.length,
          overallPassRate: totalCriteriaChecks > 0
            ? Math.round((totalPassed / totalCriteriaChecks) * 100)
            : 0,
          criteria,
        }
      : null,
    availableChannels: availableChannelRows.map((r) => r.channel),
    availableEndpoints: availableEndpointRows.map((r) => r.endpoint),
    availableSnapshots: availableSnapshotRows.map((r) => r.snapshotName),
  }

  return NextResponse.json(result)
}
