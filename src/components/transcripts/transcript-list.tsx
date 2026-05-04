'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRelativeTime } from '@/lib/utils'
import {
  Search, MessageSquare, ChevronLeft, ChevronRight,
  PhoneCall, Star, X, MessageSquareText,
} from 'lucide-react'

interface SessionRow {
  sessionId: string | null
  userId: string | null
  endpointName: string | null
  startedAt: string | null
  messageCount: number
  lastMessageAt: string | null
  handoverEscalations: number | null
  rating: number | null
  ratingComment: string | null
}

interface ApiResponse {
  sessions: SessionRow[]
  total: number
  page: number
  pageSize: number
  hideEmpty: boolean
  availableEndpoints: string[]
}

interface Props {
  slug: string
}

export function TranscriptList({ slug }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [hideEmpty, setHideEmpty] = useState(true)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, from, to, endpoint, hideEmpty])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        hideEmpty: String(hideEmpty),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (endpoint) params.set('endpoint', endpoint)

      const res = await fetch(`/api/customers/${slug}/transcripts?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [slug, page, debouncedSearch, from, to, endpoint])

  useEffect(() => { load() }, [load])

  const hasFilters = search || from || to || endpoint || !hideEmpty

  function clearFilters() {
    setSearch('')
    setFrom('')
    setTo('')
    setEndpoint('')
    setHideEmpty(true)
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquareText className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Transcripts</h1>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.total.toLocaleString()} session{data.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search session ID or user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 text-sm w-36"
            title="From date"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 text-sm w-36"
            title="To date"
          />

          {(data?.availableEndpoints?.length ?? 0) > 0 && (
            <Select value={endpoint || 'all'} onValueChange={(v) => setEndpoint(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="All endpoints" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All endpoints</SelectItem>
                {data!.availableEndpoints.map((ep) => (
                  <SelectItem key={ep} value={ep}>{ep}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant={hideEmpty ? 'outline' : 'secondary'}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setHideEmpty((v) => !v)}
            title={hideEmpty ? 'Currently hiding sessions with no messages — click to show all' : 'Showing all sessions including empty ones'}
          >
            {hideEmpty ? 'Hide empty' : 'Show empty'}
          </Button>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={clearFilters}>
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="rounded-lg border overflow-hidden">
        {loading && !data && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading sessions…
          </div>
        )}

        {!loading && data?.sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No sessions found</p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}

        {data && data.sessions.length > 0 && (
          <div className={`divide-y transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {data.sessions.map((s) => (
              <SessionRow key={s.sessionId ?? Math.random()} session={s} slug={slug} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data ? (
              <>
                {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                {Math.min(page * PAGE_SIZE, data.total).toLocaleString()} of {data.total.toLocaleString()}
              </>
            ) : null}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionRow({ session: s, slug }: { session: SessionRow; slug: string }) {
  const sessionId = s.sessionId ?? '—'
  const shortId = sessionId.length > 20 ? sessionId.slice(-16) : sessionId

  return (
    <Link
      href={`/customers/${slug}/transcripts/${encodeURIComponent(sessionId)}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors group"
    >
      {/* Icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        (s.handoverEscalations ?? 0) > 0
          ? 'bg-orange-500/10 text-orange-500'
          : 'bg-primary/10 text-primary'
      }`}>
        {(s.handoverEscalations ?? 0) > 0
          ? <PhoneCall className="h-3.5 w-3.5" />
          : <MessageSquare className="h-3.5 w-3.5" />
        }
      </div>

      {/* Main info */}
      <div className="flex flex-1 min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground truncate" title={sessionId}>
            {shortId}
          </span>
          {(s.handoverEscalations ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-500/30 hidden sm:inline-flex">
              Escalated
            </Badge>
          )}
          {s.rating !== null && (
            <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-amber-500">
              <Star className="h-3 w-3 fill-amber-500" />
              {s.rating}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {s.userId && (
            <span className="truncate max-w-[120px] sm:max-w-[200px]" title={s.userId}>
              {s.userId}
            </span>
          )}
          {s.endpointName && (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate max-w-[100px]">{s.endpointName}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: count + time */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {s.messageCount}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {s.startedAt ? formatRelativeTime(s.startedAt) : '—'}
        </span>
      </div>
    </Link>
  )
}
