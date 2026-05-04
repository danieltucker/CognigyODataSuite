'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MultiSelect } from '@/components/ui/multi-select'
import { DateRangePicker, defaultDateRange } from '@/components/ui/date-range-picker'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Search, MessageSquare, ChevronLeft, ChevronRight,
  PhoneCall, Star, X, MessageSquareText, Check, Globe, BookOpen,
} from 'lucide-react'

interface SessionRow {
  sessionId: string | null
  userId: string | null
  endpointName: string | null
  snapshotName: string | null
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
  availableSnapshots: string[]
}

interface Props {
  slug: string
}

const PAGE_SIZE = 25

export function TranscriptList({ slug }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const [endpointOpen, setEndpointOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [didInit, setDidInit] = useState(false)

  const search = searchParams.get('search') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const endpoints = searchParams.getAll('endpoint')
  const snapshots = searchParams.getAll('snapshot')
  const hideEmpty = searchParams.get('hideEmpty') !== 'false'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (didInit) return
    setDidInit(true)
    if (!searchParams.get('from') && !searchParams.get('to')) {
      const { from: f, to: t } = defaultDateRange()
      const params = new URLSearchParams(searchParams.toString())
      params.set('from', f)
      params.set('to', t)
      router.replace(`${pathname}?${params}`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSearchInput(searchParams.get('search') ?? '')
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      updateParams({ search: searchInput || null, page: null })
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateParams(updates: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      params.delete(key)
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v))
      } else if (value !== null) {
        params.set(key, value)
      }
    }
    router.replace(`${pathname}?${params}`)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        hideEmpty: String(hideEmpty),
      })
      if (search) params.set('search', search)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      endpoints.forEach((e) => params.append('endpoint', e))
      snapshots.forEach((s) => params.append('snapshot', s))

      const res = await fetch(`/api/customers/${slug}/transcripts?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [slug, page, search, from, to, endpoints.join(','), snapshots.join(','), hideEmpty]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const hasFilters = search || from || to || endpoints.length > 0 || snapshots.length > 0 || !hideEmpty

  function clearFilters() {
    setSearchInput('')
    router.replace(pathname)
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquareText className="h-4 w-4 text-primary" />
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
      <div className="flex flex-col gap-2">
        {/* Row 1: search + with-messages toggle + clear */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search session ID or user ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Consistent "With messages" toggle — filled when active */}
          <button
            onClick={() => updateParams({ hideEmpty: hideEmpty ? 'false' : 'true', page: null })}
            title={hideEmpty ? 'Only showing sessions with messages — click to include empty sessions' : 'Showing all sessions — click to hide empty sessions'}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
              hideEmpty
                ? 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15'
                : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Check className={cn('h-3 w-3 transition-opacity', hideEmpty ? 'opacity-100 text-primary' : 'opacity-30')} />
            With messages
          </button>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs shrink-0" onClick={clearFilters}>
              <X className="h-3 w-3" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>

        {/* Row 2: date + endpoint + snapshot */}
        <div className="flex gap-2 flex-wrap items-center">
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => updateParams({ from: f || null, to: t || null, page: null })}
          />

          {(data?.availableEndpoints?.length ?? 0) > 0 && (
            <MultiSelect
              options={data!.availableEndpoints}
              value={endpoints}
              onChange={(v) => updateParams({ endpoint: v.length ? v : null, page: null })}
              placeholder="All endpoints"
              className="w-44 shrink-0"
              open={endpointOpen}
              onOpenChange={setEndpointOpen}
            />
          )}

          {(data?.availableSnapshots?.length ?? 0) > 0 && (
            <MultiSelect
              options={data!.availableSnapshots}
              value={snapshots}
              onChange={(v) => updateParams({ snapshot: v.length ? v : null, page: null })}
              placeholder="All snapshots"
              className="w-44 shrink-0"
              open={snapshotOpen}
              onOpenChange={setSnapshotOpen}
            />
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
              <SessionRowItem
                key={s.sessionId ?? Math.random()}
                session={s}
                slug={slug}
                currentSearch={searchParams.toString()}
              />
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
              onClick={() => updateParams({ page: String(page - 1) })}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => updateParams({ page: String(page + 1) })}
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

function SessionRowItem({
  session: s, slug, currentSearch,
}: {
  session: SessionRow
  slug: string
  currentSearch: string
}) {
  const sessionId = s.sessionId ?? '—'
  // No JS truncation — show the full ID, CSS truncate clips from the right only if needed
  const href = `/customers/${slug}/transcripts/${encodeURIComponent(sessionId)}${currentSearch ? `?from=${encodeURIComponent(currentSearch)}` : ''}`
  const isEscalated = (s.handoverEscalations ?? 0) > 0

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors group"
    >
      {/* Icon */}
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        isEscalated ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'
      )}>
        {isEscalated
          ? <PhoneCall className="h-3.5 w-3.5" />
          : <MessageSquare className="h-3.5 w-3.5" />
        }
      </div>

      {/* Main content — flex-1 uses all available space; truncation happens rightward */}
      <div className="flex flex-1 min-w-0 flex-col gap-1">
        {/* Top line: session ID + status badges */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-medium text-foreground truncate" title={sessionId}>
            {sessionId}
          </span>
          {isEscalated && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-500/30 shrink-0">
              Escalated
            </Badge>
          )}
          {s.rating !== null && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500 shrink-0">
              <Star className="h-3 w-3 fill-amber-500" />
              {s.rating}
            </span>
          )}
        </div>

        {/* Bottom line: user ID (grows to fill) + endpoint chip + snapshot chip */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden text-[11px] text-muted-foreground">
          {s.userId && (
            <span className="flex-1 min-w-0 truncate" title={s.userId}>
              {s.userId}
            </span>
          )}
          {s.endpointName && (
            <span
              className="inline-flex items-center gap-1 shrink-0 max-w-[160px] truncate rounded bg-muted px-1.5 py-0.5 text-[10px] leading-tight"
              title={s.endpointName}
            >
              <Globe className="h-2.5 w-2.5 shrink-0 opacity-60" />
              <span className="truncate">{s.endpointName}</span>
            </span>
          )}
          {s.snapshotName && (
            <span
              className="inline-flex items-center gap-1 shrink-0 max-w-[160px] truncate rounded bg-muted px-1.5 py-0.5 text-[10px] leading-tight"
              title={s.snapshotName}
            >
              <BookOpen className="h-2.5 w-2.5 shrink-0 opacity-60" />
              <span className="truncate">{s.snapshotName}</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: message count + time — always visible, never truncated */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 pl-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {s.messageCount}
        </span>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {s.startedAt ? formatRelativeTime(s.startedAt) : '—'}
        </span>
      </div>
    </Link>
  )
}
