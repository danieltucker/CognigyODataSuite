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

  const messages = await dbQuery<{
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
  )

  let userSessions: Array<{
    sessionId: string | null
    startedAt: string | null
    endpointName: string | null
    messageCount: number
    handoverEscalations: number | null
  }> = []

  if (session.userId) {
    userSessions = await dbQuery(
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
    )
  }

  return NextResponse.json({ session, messages, userSessions })
}
