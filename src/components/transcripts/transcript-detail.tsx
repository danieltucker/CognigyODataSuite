'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatRelativeTime } from '@/lib/utils'
import {
  ArrowLeft, MessageSquare, PhoneCall, Star,
  User, Bot, Headphones, Copy, Check, ChevronRight,
  Calendar, Hash, Globe, Layers, BookOpen, Target,
  GitBranch, AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionData {
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
}

interface Message {
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
}

interface GoalEvent {
  id: string
  timestamp: string | null
  goalId: string | null
  goalName: string | null
}

interface UserSession {
  sessionId: string | null
  startedAt: string | null
  endpointName: string | null
  messageCount: number
  handoverEscalations: number | null
}

interface UserProfile {
  totalSessions: number
  totalMessages: number
  firstSeen: string | null
  lastSeen: string | null
  escalationCount: number
  avgRating: number | null
}

interface ApiData {
  session: SessionData
  messages: Message[]
  goalEvents: GoalEvent[]
  userSessions: UserSession[]
  userProfile: UserProfile | null
}

// ---------------------------------------------------------------------------
// Timeline item types
// ---------------------------------------------------------------------------

type TimelineItem =
  | { kind: 'message'; data: Message }
  | { kind: 'flow_change'; flowName: string; timestamp: string }
  | { kind: 'handover_request'; timestamp: string }
  | { kind: 'goal_event'; goalName: string | null; goalId: string | null; timestamp: string }

function buildTimeline(messages: Message[], goalEvents: GoalEvent[]): TimelineItem[] {
  const items: TimelineItem[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]

    // Flow change marker — insert before the message that changes flow
    if (
      prev &&
      msg.flowName &&
      prev.flowName &&
      msg.flowName !== prev.flowName
    ) {
      items.push({
        kind: 'flow_change',
        flowName: msg.flowName,
        timestamp: msg.timestamp ?? '',
      })
    }

    items.push({ kind: 'message', data: msg })

    // Handover request — insert after the message that triggered it
    if (msg.inHandoverRequest === true) {
      items.push({ kind: 'handover_request', timestamp: msg.timestamp ?? '' })
    }
  }

  // Merge goal events by timestamp position
  for (const ge of goalEvents) {
    if (!ge.timestamp) continue
    const geTime = new Date(ge.timestamp).getTime()
    // Find insertion index: after the last message with timestamp <= geTime
    let insertAt = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const ts =
        item.kind === 'message'
          ? item.data.timestamp
          : item.kind === 'flow_change' || item.kind === 'handover_request' || item.kind === 'goal_event'
          ? item.timestamp
          : null
      if (ts && new Date(ts).getTime() <= geTime) insertAt = i + 1
    }
    items.splice(insertAt, 0, {
      kind: 'goal_event',
      goalName: ge.goalName,
      goalId: ge.goalId,
      timestamp: ge.timestamp,
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  slug: string
  sessionId: string
}

export function TranscriptDetail({ slug, sessionId }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/customers/${slug}/transcripts/${encodeURIComponent(sessionId)}`
        )
        if (res.status === 404) { setError('Session not found'); return }
        if (!res.ok) { setError('Failed to load transcript'); return }
        setData(await res.json())
      } catch {
        setError('Failed to load transcript')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, sessionId])

  useEffect(() => {
    if (data) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24 text-sm text-muted-foreground">
        Loading transcript…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 gap-3">
        <p className="text-sm text-muted-foreground">{error ?? 'Unknown error'}</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Go back
        </Button>
      </div>
    )
  }

  const { session, messages, goalEvents, userSessions, userProfile } = data
  const decodedId = decodeURIComponent(sessionId)
  const timeline = buildTimeline(messages, goalEvents)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3 bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1 text-xs text-muted-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Transcripts</span>
        </Button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <span className="font-mono text-xs text-muted-foreground truncate">
          {decodedId.length > 30 ? `…${decodedId.slice(-24)}` : decodedId}
        </span>
        {(session.handoverEscalations ?? 0) > 0 && (
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-orange-500 border-orange-500/30 shrink-0">
            Escalated
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Chat */}
        <div className="flex flex-col flex-1 min-h-0 lg:min-h-full overflow-y-auto">
          <div className="flex flex-col gap-0.5 px-4 py-4">
            {timeline.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No messages in this session</p>
              </div>
            )}

            {timeline.map((item, i) => {
              if (item.kind === 'message') {
                const prevItem = timeline[i - 1]
                const prevMsg = prevItem?.kind === 'message' ? prevItem.data : null
                return (
                  <MessageBubble
                    key={item.data.id}
                    message={item.data}
                    prev={prevMsg}
                  />
                )
              }
              if (item.kind === 'flow_change') {
                return (
                  <EventMarker
                    key={`flow-${i}`}
                    icon={<GitBranch className="h-3 w-3" />}
                    label={`Flow: ${item.flowName}`}
                    color="text-blue-500"
                    bg="bg-blue-500/8"
                  />
                )
              }
              if (item.kind === 'handover_request') {
                return (
                  <EventMarker
                    key={`handover-${i}`}
                    icon={<PhoneCall className="h-3 w-3" />}
                    label="Handover requested"
                    color="text-orange-500"
                    bg="bg-orange-500/8"
                  />
                )
              }
              if (item.kind === 'goal_event') {
                return (
                  <EventMarker
                    key={`goal-${i}`}
                    icon={<Target className="h-3 w-3" />}
                    label={item.goalName ? `Goal: ${item.goalName}` : 'Goal achieved'}
                    color="text-emerald-500"
                    bg="bg-emerald-500/8"
                  />
                )
              }
              return null
            })}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="shrink-0 lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l overflow-y-auto bg-card/50">
          <SessionInfoPanel session={session} messageCount={messages.length} />

          {userProfile && (
            <>
              <Separator />
              <UserProfilePanel profile={userProfile} userId={session.userId} />
            </>
          )}

          {userSessions.length > 0 && (
            <>
              <Separator />
              <UserHistoryPanel userId={session.userId} sessions={userSessions} slug={slug} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event marker
// ---------------------------------------------------------------------------

function EventMarker({
  icon, label, color, bg,
}: {
  icon: React.ReactNode
  label: string
  color: string
  bg: string
}) {
  return (
    <div className="flex justify-center my-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${color} ${bg} border-current/20`}>
        {icon}
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message: msg, prev }: { message: Message; prev: Message | null }) {
  const [copied, setCopied] = useState(false)
  const [jsonExpanded, setJsonExpanded] = useState(false)

  const isUser = msg.source === 'user'
  const isAgent = msg.inHandoverConversation === true && msg.source !== 'user'
  const text = msg.inputText

  const prevTimestamp = prev?.timestamp ? new Date(prev.timestamp).getTime() : 0
  const thisTimestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
  const showTimestamp = !prev || thisTimestamp - prevTimestamp > 5 * 60 * 1000

  const prevSource = prev?.source
  const sameSource = prevSource === msg.source
  const isFirstInGroup = !sameSource || showTimestamp

  // Parse inputData for structured content
  let parsedData: unknown = null
  if (!text && msg.inputData) {
    try { parsedData = JSON.parse(msg.inputData) } catch { /* leave null */ }
  }

  if (!text && !parsedData) return null

  function handleCopy() {
    const content = text ?? (parsedData ? JSON.stringify(parsedData, null, 2) : '')
    if (content) {
      navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className={`flex flex-col ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
      {showTimestamp && msg.timestamp && (
        <div className="flex justify-center my-2">
          <span className="text-[10px] text-muted-foreground/60 bg-muted/40 rounded-full px-2.5 py-0.5">
            {new Date(msg.timestamp).toLocaleString(undefined, {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
      )}

      <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        {!isUser && (
          <div className={`shrink-0 self-end ${isFirstInGroup ? 'visible' : 'invisible'}`}>
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${
              isAgent ? 'bg-orange-500' : 'bg-primary/70'
            }`}>
              {isAgent ? <Headphones className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div className={`max-w-[75%] sm:max-w-[60%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
          <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : isAgent
              ? 'rounded-bl-sm bg-orange-500/10 text-orange-900 dark:text-orange-200 border border-orange-500/20'
              : 'rounded-bl-sm bg-muted text-foreground'
          }`}>
            {text ? (
              <span className="whitespace-pre-wrap break-words">{text}</span>
            ) : parsedData ? (
              <div>
                <button
                  onClick={() => setJsonExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                >
                  <span>{jsonExpanded ? '▾' : '▸'}</span>
                  <span>Structured data</span>
                </button>
                {jsonExpanded && (
                  <pre className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(parsedData, null, 2)}
                  </pre>
                )}
              </div>
            ) : null}
          </div>

          {/* Source label */}
          {!isUser && isFirstInGroup && (
            <span className={`text-[10px] ${isAgent ? 'text-orange-500' : 'text-muted-foreground/60'} ml-0.5`}>
              {isAgent ? 'Live Agent' : (msg.flowName ?? 'Bot')}
            </span>
          )}
        </div>

        {/* User avatar */}
        {isUser && (
          <div className={`shrink-0 self-end ${isFirstInGroup ? 'visible' : 'invisible'}`}>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
              <User className="h-3 w-3 text-secondary-foreground" />
            </div>
          </div>
        )}

        {/* Copy button — always visible, outside the bubble */}
        <button
          onClick={handleCopy}
          title="Copy message"
          className={`shrink-0 self-end mb-1 flex h-6 w-6 items-center justify-center rounded-full opacity-30 hover:opacity-100 hover:bg-muted transition-all ${
            copied ? 'opacity-100 text-emerald-500' : ''
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Session info panel
// ---------------------------------------------------------------------------

function SessionInfoPanel({ session: s, messageCount }: { session: SessionData; messageCount: number }) {
  const [copiedId, setCopiedId] = useState(false)

  function copySessionId() {
    if (s.sessionId) {
      navigator.clipboard.writeText(s.sessionId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 1500)
    }
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Session Details
      </h2>
      <div className="flex flex-col gap-2">
        <InfoRow
          icon={<Hash className="h-3.5 w-3.5" />}
          label="Session ID"
          value={
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-[11px] truncate" title={s.sessionId ?? undefined}>
                {s.sessionId ? `…${s.sessionId.slice(-16)}` : '—'}
              </span>
              {s.sessionId && (
                <button onClick={copySessionId} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                  {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
          }
        />
        <InfoRow
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Started"
          value={s.startedAt
            ? new Date(s.startedAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : '—'
          }
        />
        <InfoRow
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Endpoint"
          value={s.endpointName ?? '—'}
        />
        <InfoRow
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Messages"
          value={String(messageCount)}
        />
        {(s.stepsCount ?? 0) > 0 && (
          <InfoRow
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Steps"
            value={String(s.stepsCount)}
          />
        )}
        {(s.handoverEscalations ?? 0) > 0 && (
          <InfoRow
            icon={<PhoneCall className="h-3.5 w-3.5 text-orange-500" />}
            label="Escalations"
            value={<span className="text-orange-500">{s.handoverEscalations}</span>}
          />
        )}
        {s.snapshotName && (
          <InfoRow
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Snapshot"
            value={s.snapshotName}
          />
        )}
        {s.rating !== null && (
          <InfoRow
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
            label="Rating"
            value={
              <span className="flex items-center gap-1">
                <span className="text-amber-500 font-medium">{s.rating}</span>
                {s.ratingComment && (
                  <span className="text-muted-foreground">· {s.ratingComment}</span>
                )}
              </span>
            }
          />
        )}
      </div>
      {s.userId && (
        <div className="mt-1 rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">User ID</p>
          <p className="font-mono text-xs break-all">{s.userId}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// User profile panel
// ---------------------------------------------------------------------------

function UserProfilePanel({ profile: p, userId }: { profile: UserProfile; userId: string | null }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Contact Profile
      </h2>
      <div className="flex flex-col gap-2">
        <InfoRow
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="First seen"
          value={p.firstSeen ? formatRelativeTime(p.firstSeen) : '—'}
        />
        <InfoRow
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Last seen"
          value={p.lastSeen ? formatRelativeTime(p.lastSeen) : '—'}
        />
        <InfoRow
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Total sessions"
          value={p.totalSessions.toLocaleString()}
        />
        <InfoRow
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Total messages"
          value={p.totalMessages.toLocaleString()}
        />
        {p.escalationCount > 0 && (
          <InfoRow
            icon={<PhoneCall className="h-3.5 w-3.5 text-orange-500" />}
            label="Escalations"
            value={<span className="text-orange-500">{p.escalationCount}</span>}
          />
        )}
        {p.avgRating !== null && (
          <InfoRow
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
            label="Avg rating"
            value={<span className="text-amber-500 font-medium">{p.avgRating}</span>}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User history panel
// ---------------------------------------------------------------------------

function UserHistoryPanel({
  userId, sessions, slug,
}: {
  userId: string | null
  sessions: UserSession[]
  slug: string
}) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Session History
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {sessions.length} other session{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {sessions.map((s) => {
          const sid = s.sessionId ?? ''
          const shortId = sid.length > 16 ? `…${sid.slice(-12)}` : sid
          return (
            <Link
              key={sid}
              href={`/customers/${slug}/transcripts/${encodeURIComponent(sid)}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60 transition-colors group"
            >
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                (s.handoverEscalations ?? 0) > 0
                  ? 'bg-orange-500/10 text-orange-500'
                  : 'bg-primary/10 text-primary'
              }`}>
                {(s.handoverEscalations ?? 0) > 0
                  ? <PhoneCall className="h-2.5 w-2.5" />
                  : <MessageSquare className="h-2.5 w-2.5" />
                }
              </div>
              <div className="flex flex-1 min-w-0 flex-col">
                <span className="font-mono text-[11px] truncate group-hover:text-primary transition-colors">
                  {shortId}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {s.startedAt ? formatRelativeTime(s.startedAt) : '—'}
                  {' · '}
                  {s.messageCount} msg
                </span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared info row
// ---------------------------------------------------------------------------

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground/60 shrink-0">{icon}</span>
      <div className="flex flex-1 min-w-0 flex-col">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight">
          {label}
        </span>
        <span className="text-xs text-foreground leading-snug mt-0.5 truncate">
          {value}
        </span>
      </div>
    </div>
  )
}
