import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'

const UTTERANCE_LIMIT = 25
const SESSION_LIMIT = 50

export interface IntentDetailData {
  intent: string
  utterances: { inputText: string; count: number; avgScore: number | null }[]
  utterancesMasked: boolean
  sessions: {
    sessionId: string
    firstSeen: string
    channel: string | null
    endpointName: string | null
    snapshotName: string | null
    turns: number
    avgScore: number | null
  }[]
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
  const intent = url.searchParams.get('intent')
  if (!intent) return NextResponse.json({ error: 'Missing intent' }, { status: 400 })

  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const channel = url.searchParams.get('channel') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')

  const conditions: string[] = [`intent = ?`]
  const bindings: unknown[] = [intent]
  if (from) { conditions.push(`"timestamp" >= ?`); bindings.push(from) }
  if (to) { conditions.push(`"timestamp" <= ?`); bindings.push(to + 'T23:59:59.999Z') }
  if (channel) { conditions.push(`"channel" = ?`); bindings.push(channel) }
  if (endpoints.length) { conditions.push(inList('"endpointName"', endpoints)); bindings.push(...endpoints) }
  if (snapshots.length) { conditions.push(inList('"snapshotName"', snapshots)); bindings.push(...snapshots) }
  const where = `WHERE ${conditions.join(' AND ')}`

  const conn = await getDb(slug)

  const [maskedRows, utterances, sessions] = await Promise.all([
    // If no rows in the window have inputText, the data is masked (Blind Mode)
    // — show a banner instead of an empty list.
    dbQuery<{ withText: number; total: number }>(
      conn,
      `SELECT
         COUNT(*) FILTER (WHERE inputText IS NOT NULL AND inputText != '') as withText,
         COUNT(*) as total
       FROM analytics ${where}`,
      bindings,
    ),

    dbQuery<{ inputText: string; count: number; avgScore: number | null }>(
      conn,
      `SELECT inputText, COUNT(*) as count, AVG(intentScore) as avgScore
       FROM analytics ${where}
         AND inputText IS NOT NULL AND inputText != ''
       GROUP BY inputText
       ORDER BY count DESC
       LIMIT ${UTTERANCE_LIMIT}`,
      bindings,
    ),

    dbQuery<{
      sessionId: string
      firstSeen: string
      channel: string | null
      endpointName: string | null
      snapshotName: string | null
      turns: number
      avgScore: number | null
    }>(
      conn,
      `SELECT sessionId,
              MIN(timestamp) as firstSeen,
              ANY_VALUE(channel) as channel,
              ANY_VALUE(endpointName) as endpointName,
              ANY_VALUE(snapshotName) as snapshotName,
              COUNT(*) as turns,
              AVG(intentScore) as avgScore
       FROM analytics ${where}
         AND sessionId IS NOT NULL
       GROUP BY sessionId
       ORDER BY firstSeen DESC
       LIMIT ${SESSION_LIMIT}`,
      bindings,
    ),
  ])

  const masked = (Number(maskedRows[0]?.withText ?? 0) === 0) && (Number(maskedRows[0]?.total ?? 0) > 0)

  const result: IntentDetailData = {
    intent,
    utterances: utterances.map((r) => ({
      inputText: r.inputText,
      count: Number(r.count),
      avgScore: r.avgScore != null ? Number(r.avgScore) : null,
    })),
    utterancesMasked: masked,
    sessions: sessions.map((r) => ({
      sessionId: r.sessionId,
      firstSeen: r.firstSeen,
      channel: r.channel,
      endpointName: r.endpointName,
      snapshotName: r.snapshotName,
      turns: Number(r.turns),
      avgScore: r.avgScore != null ? Number(r.avgScore) : null,
    })),
  }

  return NextResponse.json(result)
}
