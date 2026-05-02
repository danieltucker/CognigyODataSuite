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
  }
  availableChannels: string[]
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

  const conn = await getDb(slug)

  // Date range conditions
  const dateConditions: string[] = []
  const dateBinds: unknown[] = []
  if (from) { dateConditions.push(`"timestamp" >= ?`); dateBinds.push(from) }
  if (to) { dateConditions.push(`"timestamp" <= ?`); dateBinds.push(to + 'T23:59:59.999Z') }
  if (channel) { dateConditions.push(`"channel" = ?`); dateBinds.push(channel) }
  const analyticsWhere = dateConditions.length > 0 ? `WHERE ${dateConditions.join(' AND ')}` : ''

  // Session date range
  const sessionConditions: string[] = []
  const sessionBinds: unknown[] = []
  if (from) { sessionConditions.push(`"startedAt" >= ?`); sessionBinds.push(from) }
  if (to) { sessionConditions.push(`"startedAt" <= ?`); sessionBinds.push(to + 'T23:59:59.999Z') }
  const sessionsWhere = sessionConditions.length > 0 ? `WHERE ${sessionConditions.join(' AND ')}` : ''

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
  ] = await Promise.all([
    dbQuery<{ date: string; sessions: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date, COUNT(*) as sessions
       FROM analytics ${analyticsWhere}
       GROUP BY 1 ORDER BY 1`,
      dateBinds
    ),
    dbQuery<{ intent: string; count: number }>(
      conn,
      `SELECT intent, COUNT(*) as count
       FROM analytics ${analyticsWhere ? analyticsWhere + ' AND' : 'WHERE'} intent IS NOT NULL AND intent != ''
       GROUP BY intent ORDER BY count DESC LIMIT 10`,
      dateBinds
    ),
    dbQuery<{ channel: string; count: number }>(
      conn,
      `SELECT COALESCE(channel, 'unknown') as channel, COUNT(*) as count
       FROM analytics ${analyticsWhere}
       GROUP BY channel ORDER BY count DESC`,
      dateBinds
    ),
    dbQuery<{ date: string; avgMs: number }>(
      conn,
      `SELECT strftime(timestamp, '%Y-%m-%d') as date,
              ROUND(AVG(executionTime), 0) as avgMs
       FROM analytics ${analyticsWhere ? analyticsWhere + ' AND' : 'WHERE'} executionTime IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      dateBinds
    ),
    dbQuery<{ bucket: string; count: number }>(
      conn,
      `SELECT
         CASE
           WHEN intentScore < 0.1 THEN '0.0–0.1'
           WHEN intentScore < 0.2 THEN '0.1–0.2'
           WHEN intentScore < 0.3 THEN '0.2–0.3'
           WHEN intentScore < 0.4 THEN '0.3–0.4'
           WHEN intentScore < 0.5 THEN '0.4–0.5'
           WHEN intentScore < 0.6 THEN '0.5–0.6'
           WHEN intentScore < 0.7 THEN '0.6–0.7'
           WHEN intentScore < 0.8 THEN '0.7–0.8'
           WHEN intentScore < 0.9 THEN '0.8–0.9'
           ELSE '0.9–1.0'
         END as bucket,
         COUNT(*) as count
       FROM analytics ${analyticsWhere ? analyticsWhere + ' AND' : 'WHERE'} intentScore IS NOT NULL
       GROUP BY bucket ORDER BY bucket`,
      dateBinds
    ),
    dbQuery<{ total: number; avgScore: number | null }>(
      conn,
      `SELECT COUNT(*) as total, ROUND(AVG(intentScore), 3) as avgScore
       FROM analytics ${analyticsWhere}`,
      dateBinds
    ),
    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM conversations ${
        dateConditions.length > 0 ? `WHERE ${dateConditions.filter(c => !c.includes('channel')).join(' AND ')}` : ''
      }`,
      dateBinds.filter((_, i) => !dateConditions[i]?.includes('channel'))
    ),
    dbQuery<{ total: number }>(
      conn,
      `SELECT COUNT(*) as total FROM live_agent_escalations ${
        dateConditions.length > 0 ? `WHERE ${dateConditions.filter(c => !c.includes('channel')).join(' AND ')}` : ''
      }`,
      dateBinds.filter((_, i) => !dateConditions[i]?.includes('channel'))
    ),
    dbQuery<{ total: number; escalated: number }>(
      conn,
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN handoverEscalations > 0 THEN 1 ELSE 0 END) as escalated
       FROM sessions ${sessionsWhere}`,
      sessionBinds
    ),
    // Always unfiltered — used to populate the channel dropdown
    dbQuery<{ channel: string }>(
      conn,
      `SELECT DISTINCT COALESCE(channel, 'unknown') as channel FROM analytics WHERE channel IS NOT NULL ORDER BY 1`
    ),
  ])

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
    },
    availableChannels: availableChannelRows.map((r) => r.channel),
  }

  return NextResponse.json(result)
}
