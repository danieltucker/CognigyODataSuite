import { NextRequest, NextResponse } from 'next/server'
import { getDb, dbQuery } from '@/db/client'
import { getCustomer } from '@/lib/customers'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

type Sheet = 'intents' | 'utterances'
type Format = 'csv' | 'xlsx'

const INTENT_LIMIT = 1000
const UTTERANCE_LIMIT = 5000

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
  const sheet: Sheet = url.searchParams.get('sheet') === 'utterances' ? 'utterances' : 'intents'
  const format: Format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
  const intent = url.searchParams.get('intent')
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const channel = url.searchParams.get('channel') ?? ''
  const endpoints = url.searchParams.getAll('endpoint')
  const snapshots = url.searchParams.getAll('snapshot')

  if (sheet === 'utterances' && !intent) {
    return NextResponse.json({ error: 'intent is required for utterances sheet' }, { status: 400 })
  }

  const aC: string[] = []
  const aB: unknown[] = []
  if (from) { aC.push(`"timestamp" >= ?`); aB.push(from) }
  if (to) { aC.push(`"timestamp" <= ?`); aB.push(to + 'T23:59:59.999Z') }
  if (channel) { aC.push(`"channel" = ?`); aB.push(channel) }
  if (endpoints.length) { aC.push(inList('"endpointName"', endpoints)); aB.push(...endpoints) }
  if (snapshots.length) { aC.push(inList('"snapshotName"', snapshots)); aB.push(...snapshots) }

  const conn = await getDb(slug)

  let columns: string[]
  let data: (string | number)[][]
  let filenameBase: string

  if (sheet === 'utterances') {
    const conditions = [`intent = ?`, `inputText IS NOT NULL`, `inputText != ''`, ...aC]
    const bindings = [intent!, ...aB]
    const rows = await dbQuery<{ inputText: string; count: number; avgScore: number | null }>(
      conn,
      `SELECT inputText, COUNT(*) as count, AVG(intentScore) as avgScore
       FROM analytics WHERE ${conditions.join(' AND ')}
       GROUP BY inputText ORDER BY count DESC LIMIT ${UTTERANCE_LIMIT}`,
      bindings,
    )
    columns = ['inputText', 'count', 'avgScore']
    data = rows.map((r) => [
      r.inputText,
      Number(r.count),
      r.avgScore != null ? Number(Number(r.avgScore).toFixed(3)) : '',
    ])
    filenameBase = `${slug}_intents_utterances_${intent!.replace(/[^a-z0-9_-]/gi, '_')}`
  } else {
    const conditions = [`intent IS NOT NULL`, `intent != ''`, ...aC]
    const baseRows = await dbQuery<{
      intent: string
      turns: number
      sessions: number
      avgScore: number | null
      medianScore: number | null
    }>(
      conn,
      `SELECT intent, COUNT(*) as turns, COUNT(DISTINCT sessionId) as sessions,
              AVG(intentScore) as avgScore, quantile_cont(intentScore, 0.5) as medianScore
       FROM analytics WHERE ${conditions.join(' AND ')}
       GROUP BY intent ORDER BY turns DESC LIMIT ${INTENT_LIMIT}`,
      aB,
    )
    const outcomeRows = await dbQuery<{
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
    )
    const outcomeMap = new Map(outcomeRows.map((r) => [r.intent, r]))
    columns = [
      'intent', 'turns', 'sessions', 'avgScore', 'medianScore',
      'escalatedSessions', 'escalationRate',
      'goalCompletedSessions', 'goalCompletionRate',
      'avgRating', 'ratedSessions',
    ]
    data = baseRows.map((r) => {
      const o = outcomeMap.get(r.intent)
      const sessions = Number(r.sessions)
      const esc = Number(o?.escalatedSessions ?? 0)
      const goal = Number(o?.goalCompletedSessions ?? 0)
      return [
        r.intent,
        Number(r.turns),
        sessions,
        r.avgScore != null ? Number(Number(r.avgScore).toFixed(3)) : '',
        r.medianScore != null ? Number(Number(r.medianScore).toFixed(3)) : '',
        esc,
        sessions > 0 ? Number(((esc / sessions) * 100).toFixed(1)) : 0,
        goal,
        sessions > 0 ? Number(((goal / sessions) * 100).toFixed(1)) : 0,
        o?.avgRating != null ? Number(Number(o.avgRating).toFixed(2)) : '',
        Number(o?.ratedSessions ?? 0),
      ]
    })
    filenameBase = `${slug}_intents`
  }

  const dateLabel = from && to ? `_${from}_${to}` : ''
  const filename = `${filenameBase}${dateLabel}`

  if (format === 'csv') {
    const csv = Papa.unparse({ fields: columns, data })
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  const ws = XLSX.utils.aoa_to_sheet([columns, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  })
}
