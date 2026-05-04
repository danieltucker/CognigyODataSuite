'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatRelativeTime } from '@/lib/utils'
import {
  ArrowLeft, MessageSquare, PhoneCall, Star,
  User, Bot, Headphones, Copy, Check, ChevronRight,
  Calendar, Hash, Globe, Layers, BookOpen,
} from 'lucide-react'

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

interface UserSession {
  sessionId: string | null
  startedAt: string | null
  endpointName: string | null
  messageCount: number
  handoverEscalations: number | null
}

interface ApiData {
  session: SessionData
  messages: Message[]
  userSessions: UserSession[]
}

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
    if (data) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
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

  const { session, messages, userSessions } = data
  const decodedSessionId = decodeURIComponent(sessionId)

  return (
    <div className="flex flex-col h-full">
      {/* Header / breadcrumb */}
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
          {decodedSessionId.length > 30
            ? `…${decodedSessionId.slice(-24)}`
            : decodedSessionId
          }
        </span>
        {(session.handoverEscalations ?? 0) > 0 && (
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-orange-500 border-orange-500/30 shrink-0">
            Escalated
          </Badge>
        )}
      </div>

      {/* Body: chat + sidebar */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Chat panel */}
        <div className="flex flex-col flex-1 min-h-0 lg:min-h-full overflow-y-auto">
          <div className="flex flex-col gap-0.5 px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No messages in this session</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} prev={messages[i - 1] ?? null} />
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="shrink-0 lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l overflow-y-auto bg-card/50">
          <SessionInfoPanel session={session} messageCount={messages.length} />
          {userSessions.length > 0 && (
            <>
              <Separator />
              <UserHistoryPanel
                userId={session.userId}
                sessions={userSessions}
                slug={slug}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message: msg, prev }: { message: Message; prev: Message | null }) {
  const [copied, setCopied] = useState(false)

  const isUser = msg.source === 'user'
  const isAgent = msg.inHandoverConversation === true && msg.source !== 'user'
  const text = msg.inputText

  const prevTimestamp = prev?.timestamp ? new Date(prev.timestamp).getTime() : 0
  const thisTimestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
  const showTimestamp = !prev || thisTimestamp - prevTimestamp > 5 * 60 * 1000 // 5-min gap

  const prevSource = prev?.source
  const sameSource = prevSource === msg.source
  const isFirstInGroup = !sameSource || showTimestamp

  if (!text && !msg.inputData) return null

  function handleCopy() {
    if (text) {
      navigator.clipboard.writeText(text)
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

      <div className={`flex items-end gap-1.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar — only for first in group */}
        <div className={`shrink-0 ${isFirstInGroup ? 'visible' : 'invisible'} ${isUser ? 'hidden' : 'block'}`}>
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${
            isAgent ? 'bg-orange-500' : 'bg-primary/70'
          }`}>
            {isAgent
              ? <Headphones className="h-3 w-3" />
              : <Bot className="h-3 w-3" />
            }
          </div>
        </div>

        {/* Bubble */}
        <div
          className={`group relative max-w-[80%] sm:max-w-[65%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : isAgent
              ? 'rounded-bl-sm bg-orange-500/10 text-orange-900 dark:text-orange-200 border border-orange-500/20'
              : 'rounded-bl-sm bg-muted text-foreground'
          }`}
        >
          {text ? (
            <span className="whitespace-pre-wrap break-words">{text}</span>
          ) : (
            <span className="italic opacity-50 text-xs">[structured data]</span>
          )}

          {/* Copy button on hover */}
          {text && (
            <button
              onClick={handleCopy}
              className={`absolute top-1 ${isUser ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded`}
            >
              {copied
                ? <Check className="h-3 w-3" />
                : <Copy className="h-3 w-3" />
              }
            </button>
          )}
        </div>

        {/* User avatar placeholder for alignment */}
        {isUser && isFirstInGroup && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
            <User className="h-3 w-3 text-secondary-foreground" />
          </div>
        )}
        {isUser && !isFirstInGroup && <div className="h-6 w-6 shrink-0" />}
      </div>

      {/* Source label (first in group only, for bot/agent) */}
      {!isUser && isFirstInGroup && (
        <div className={`ml-8 mt-0.5 text-[10px] ${isAgent ? 'text-orange-500' : 'text-muted-foreground/60'}`}>
          {isAgent ? 'Live Agent' : (msg.flowName ?? 'Bot')}
        </div>
      )}
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
                <button onClick={copySessionId} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
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
            value={
              <span className="text-orange-500">{s.handoverEscalations}</span>
            }
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

      {/* User ID */}
      {s.userId && (
        <div className="mt-1 rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">User ID</p>
          <p className="font-mono text-xs break-all">{s.userId}</p>
        </div>
      )}
    </div>
  )
}

function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
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

// ---------------------------------------------------------------------------
// User history panel
// ---------------------------------------------------------------------------

function UserHistoryPanel({
  userId,
  sessions,
  slug,
}: {
  userId: string | null
  sessions: UserSession[]
  slug: string
}) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          User History
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
