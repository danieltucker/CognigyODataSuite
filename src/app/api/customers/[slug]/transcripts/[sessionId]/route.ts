import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; sessionId: string }> }
) {
  const { slug, sessionId } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conn = await getDb(slug)

  const [session] = await dbQuery<{
    sessionId: string | null
    userId: string | null
    startedAt: string | null
    stepsCount: number | null
    handoverEscalations: number | null
    endpointName: string | null
    projectName: string | null
    snapshotName: string | null
    rating: number | null
    ratingComment: string | null
  }>(
    conn,
    `SELECT "sessionId", "userId", "startedAt", "stepsCount", "handoverEscalations",
            "endpointName", "projectName", "snapshotName", "rating", "ratingComment"
     FROM sessions WHERE "sessionId" = ?`,
    [sessionId]
  )

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const [messages, goalEvents] = await Promise.all([
    dbQuery<{
      id: string
      inputText: string | null
      inputData: string | null
      type: string | null
      source: string | null
      timestamp: string | null
      flowName: string | null
      channel: string | null
      endpointName: string | null
      inHandoverRequest: boolean | null
      inHandoverConversation: boolean | null
      rating: number | null
      ratingComment: string | null
    }>(
      conn,
      `SELECT id, "inputText", "inputData", "type", "source", "timestamp",
              "flowName", "channel", "endpointName",
              "inHandoverRequest", "inHandoverConversation",
              "rating", "ratingComment"
       FROM conversations
       WHERE "sessionId" = ?
       ORDER BY "timestamp" ASC NULLS LAST`,
      [sessionId]
    ),

    // Goal events for this session, joined with goal names
    dbQuery<{
      id: string
      timestamp: string | null
      goalId: string | null
      goalName: string | null
    }>(
      conn,
      `SELECT ge.id, ge."timestamp", ge."goalId", g."name" AS goalName
       FROM goal_events ge
       LEFT JOIN goals g ON ge."goalId" = g."goalId"
       WHERE ge."sessionId" = ?
       ORDER BY ge."timestamp" ASC NULLS LAST`,
      [sessionId]
    ),
  ])

  let userSessions: Array<{
    sessionId: string | null
    startedAt: string | null
    endpointName: string | null
    messageCount: number
    handoverEscalations: number | null
  }> = []

  let userProfile: {
    totalSessions: number
    totalMessages: number
    firstSeen: string | null
    lastSeen: string | null
    escalationCount: number
    avgRating: number | null
  } | null = null

  if (session.userId) {
    const [sessions, profileRow, msgRow] = await Promise.all([
      dbQuery<{
        sessionId: string | null
        startedAt: string | null
        endpointName: string | null
        messageCount: number
        handoverEscalations: number | null
      }>(
        conn,
        `SELECT
          s."sessionId",
          s."startedAt",
          s."endpointName",
          s."handoverEscalations",
          COALESCE(m.messageCount, 0) AS messageCount
        FROM sessions s
        LEFT JOIN (
          SELECT "sessionId", COUNT(*) AS messageCount
          FROM conversations
          GROUP BY "sessionId"
        ) m ON s."sessionId" = m."sessionId"
        WHERE s."userId" = ? AND s."sessionId" != ?
        ORDER BY s."startedAt" DESC NULLS LAST
        LIMIT 20`,
        [session.userId, sessionId]
      ),

      dbQuery<{
        totalSessions: number
        firstSeen: string | null
        lastSeen: string | null
        escalationCount: number
        avgRating: number | null
      }>(
        conn,
        `SELECT
          COUNT(*) AS totalSessions,
          MIN("startedAt") AS firstSeen,
          MAX("startedAt") AS lastSeen,
          SUM(COALESCE("handoverEscalations", 0)) AS escalationCount,
          AVG(CAST("rating" AS DOUBLE)) AS avgRating
        FROM sessions
        WHERE "userId" = ?`,
        [session.userId]
      ),

      dbQuery<{ totalMessages: number }>(
        conn,
        `SELECT COUNT(*) AS totalMessages
         FROM conversations
         WHERE "sessionId" IN (
           SELECT "sessionId" FROM sessions
           WHERE "userId" = ? AND "sessionId" IS NOT NULL
         )`,
        [session.userId]
      ),
    ])

    userSessions = sessions
    const p = profileRow[0]
    if (p) {
      userProfile = {
        totalSessions: Number(p.totalSessions),
        totalMessages: Number(msgRow[0]?.totalMessages ?? 0),
        firstSeen: p.firstSeen,
        lastSeen: p.lastSeen,
        escalationCount: Number(p.escalationCount),
        avgRating: p.avgRating !== null ? Math.round(Number(p.avgRating) * 10) / 10 : null,
      }
    }
  }

  return NextResponse.json({ session, messages, goalEvents, userSessions, userProfile })
}
