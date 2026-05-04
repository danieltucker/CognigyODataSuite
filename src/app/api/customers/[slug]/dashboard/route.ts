import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

export interface DashboardData {
  sessionVolume: { date: string; sessions: number }[]
  topIntents: { intent: string; count: number }[]
  channelDistribution: { channel: string; count: number }[]
  avgExecutionTime: { date: string; avgMs: number }[]
  escalationRate: { escalated: number; total: number }
  intentScoreDistribution: { bucket: string; count: number }[]
  summary: {
    totalSessions: number
    totalConversations: number
    totalEscalations: number
    avgIntentScore: number | null
    totalGoalEvents: number
  }
  goalsSummary: {
    topGoals: { name: string; count: number }[]
    goalEventsByDay: { date: string; events: number }[]
  }
  topFlows: { flowName: string; count: number }[]
  llmErrors: { errorTurns: number; totalTurns: number }
  agentEvaluation: {
    totalRuns: number
    overallPassRate: number
    criteria: { name: string; passed: number; total: number; passRate: number }[]
  } | null
  availableChannels: string[]
  availableEndpoints: string[]
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
  const endpoint = url.searchParams.get('endpoint') ?? ''

  const conn = await getDb(slug)

  // Analytics filter (timestamp + channel + endpoint)
  const analyticsConditions: string[] = []
  const analyticsBinds: unknown[] = []
  if (from) { analyticsConditions.push(`"timestamp" >= ?`); analyticsBinds.push(from) }
  if (to) { analyticsConditions.push(`"timestamp" <= ?`); analyticsBinds.push(to + 'T23:59:59.999Z') }
  if (channel) { analyticsConditions.push(`"channel" = ?`); analyticsBinds.push(channel) }
  if (endpoint) { analyticsConditions.push(`"endpointName" = ?`); analyticsBinds.push(endpoint) }
  const analyticsWhere = analyticsConditions.length > 0 ? `WHERE ${analyticsConditions.join(' AND ')}` : ''

  // Date-only filter (conversations, goal_events, live_agent_escalations)
  const dateConditions: string[] = []
  const dateBinds: unknown[] = []
  if (from) { dateConditions.push(`"timestamp" >= ?`); dateBinds.push(from) }
  if (to) { dateConditions.push(`"timestamp" <= ?`); dateBinds.push(to + 'T23:59:59.999Z') }
  const dateWhere = dateConditions.length > 0 ? `WHERE ${dateConditions.join(' AND ')}` : ''

  // Sessions filter (startedAt + endpointName)
  const sessionConditions: string[] = []
  const sessionBinds: unknown[] = []
  if (from) { sessionConditions.push(`"startedAt" >= ?`); sessionBinds.push(from) }
  if (to) { sessionConditions.push(`"startedAt" <= ?`); sessionBinds.push(to + 'T23:59:59.999Z') }
  if (endpoint) { sessionConditions.push(`"endpointName" = ?`); sessionBinds.push(endpoint) }
  const sessionsWhere = sessionConditions.length > 0 ? `WHERE ${sessionConditions.join(' AND ')}` : ''

  // Executed steps filter (timestamp + endpointName)
  const execStepsConditions: string[] = []
  const execStepsBinds: unknown[] = []
  if (from) { execStepsConditions.push(`"timestamp" >= ?`); execStepsBinds.push(from) }
  if (to) { execStepsConditions.push(`"timestamp" <= ?`); execStepsBinds.push(to + 'T23:59:59.999Z') }
  if (endpoint) { execStepsConditions.push(`"endpointName" = ?`); execStepsBinds.push(endpoint) }

  const [
    sessionVolume,
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
    goalEventsTotal,
    topGoalsRows,
    goalEventsByDayRows,
    topFlowsRows,
    llmErrorRows,
    simulatorRows,
  ] = await Promise.all([
    dbQuery<{ date: string; sessions: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, COUNT(*) as sessions
       FROM analytics ${analyticsWhere} GROUP BY 1 ORDER BY 1`,
      analyticsBinds
    ),
    dbQuery<{ intent: string; count: number }>(
      conn,
      `SELECT intent, COUNT(*) as count FROM analytics
       ${analyticsWhere ? analyticsWhere + ' AND' : 'WHERE'} intent IS NOT NULL AND intent != ''
       GROUP BY intent ORDER BY count DESC LIMIT 10`,
      analyticsBinds
    ),
    dbQuery<{ channel: string; count: number }>(
      conn,
      `SELECT COALESCE(channel, 'unknown') as channel, COUNT(*) as count
       FROM analytics ${analyticsWhere} GROUP BY channel ORDER BY count DESC`,
      analyticsBinds
    ),
    dbQuery<{ date: string; avgMs: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, ROUND(AVG(executionTime), 0) as avgMs
       FROM analytics ${analyticsWhere ? analyticsWhere + ' AND' : 'WHERE'} executionTime IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      analyticsBinds
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
       FROM analytics ${analyticsWhere ? analyticsWhere + ' AND' : 'WHERE'} intentScore IS NOT NULL
       GROUP BY bucket ORDER BY bucket`,
      analyticsBinds
    ),
    dbQuery<{ total: number; avgScore: number | null }>(
      conn,
      `SELECT COUNT(*) as total, ROUND(AVG(intentScore), 3) as avgScore FROM analytics ${analyticsWhere}`,
      analyticsBinds
    ),
    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM conversations ${dateWhere}`,
      dateBinds
    ),
    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM live_agent_escalations ${dateWhere}`,
      dateBinds
    ),
    dbQuery<{ total: number; escalated: number }>(
      conn,
      `SELECT COUNT(*) as total, SUM(CASE WHEN handoverEscalations > 0 THEN 1 ELSE 0 END) as escalated
       FROM sessions ${sessionsWhere}`,
      sessionBinds
    ),
    dbQuery<{ channel: string }>(
      conn,
      `SELECT DISTINCT COALESCE(channel, 'unknown') as channel FROM analytics WHERE channel IS NOT NULL ORDER BY 1`
    ),
    dbQuery<{ endpoint: string }>(
      conn,
      `SELECT DISTINCT endpointName as endpoint FROM analytics WHERE endpointName IS NOT NULL AND endpointName != '' ORDER BY 1`
    ),
    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM goal_events ${dateWhere}`,
      dateBinds
    ),
    dbQuery<{ name: string; count: number }>(
      conn,
      `SELECT COALESCE(g.name, sub.goalId) as name, sub.cnt as count
       FROM (
         SELECT goalId, COUNT(*) as cnt FROM goal_events ${dateWhere}
         GROUP BY goalId ORDER BY cnt DESC LIMIT 10
       ) sub
       LEFT JOIN goals g ON sub.goalId = g.goalId
       ORDER BY sub.cnt DESC`,
      dateBinds
    ),
    dbQuery<{ date: string; events: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, COUNT(*) as events
       FROM goal_events ${dateWhere} GROUP BY 1 ORDER BY 1`,
      dateBinds
    ),
    // Top flows from executed_steps
    dbQuery<{ flowName: string; count: number }>(
      conn,
      `SELECT flowName, COUNT(*) as count FROM executed_steps
       WHERE flowName IS NOT NULL AND flowName != ''
       ${execStepsConditions.length > 0 ? 'AND ' + execStepsConditions.join(' AND ') : ''}
       GROUP BY flowName ORDER BY count DESC LIMIT 10`,
      execStepsBinds
    ),
    // LLM error count from conversations debug logs
    dbQuery<{ totalTurns: number; errorTurns: number }>(
      conn,
      `SELECT
         COUNT(*) as totalTurns,
         SUM(CASE WHEN inputData LIKE '%Bad Request Error%' OR inputData LIKE '%LLM_PROMPT__ERROR%' THEN 1 ELSE 0 END) as errorTurns
       FROM conversations ${dateWhere}`,
      dateBinds
    ),
    // Simulator/agent evaluation rows — parsed in JS below
    dbQuery<{ inputData: string }>(
      conn,
      `SELECT inputData FROM analytics
       WHERE inputData LIKE '%Simulator Metrics%'
       ${analyticsConditions.length > 0 ? 'AND ' + analyticsConditions.join(' AND ') : ''}`,
      analyticsBinds
    ),
  ])

  // Parse simulator metrics from analytics inputData
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
    } catch {
      // malformed inputData — skip
    }
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

  const result: DashboardData = {
    sessionVolume: sessionVolume.map((r) => ({ date: r.date, sessions: Number(r.sessions) })),
    topIntents: topIntents.map((r) => ({ intent: r.intent, count: Number(r.count) })),
    channelDistribution: channelDistribution.map((r) => ({ channel: r.channel, count: Number(r.count) })),
    avgExecutionTime: avgExecutionTime.map((r) => ({ date: r.date, avgMs: Number(r.avgMs) })),
    escalationRate: {
      escalated: Number(summarySessions[0]?.escalated ?? 0),
      total: Number(summarySessions[0]?.total ?? 0),
    },
    intentScoreDistribution: intentScoreRows.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
    summary: {
      totalSessions: Number(summarySessions[0]?.total ?? 0),
      totalConversations: Number(summaryConversations[0]?.total ?? 0),
      totalEscalations: Number(summaryEscalations[0]?.total ?? 0),
      avgIntentScore: summaryAnalytics[0]?.avgScore ?? null,
      totalGoalEvents: Number(goalEventsTotal[0]?.total ?? 0),
    },
    goalsSummary: {
      topGoals: topGoalsRows.map((r) => ({ name: r.name, count: Number(r.count) })),
      goalEventsByDay: goalEventsByDayRows.map((r) => ({ date: r.date, events: Number(r.events) })),
    },
    topFlows: topFlowsRows.map((r) => ({ flowName: r.flowName, count: Number(r.count) })),
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
  }

  return NextResponse.json(result)
}
