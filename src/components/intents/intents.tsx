'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  ResponsiveContainer,
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { DateRangePicker, defaultDateRange } from '@/components/ui/date-range-picker'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  RefreshCw, Brain, Download, Printer, FileSpreadsheet,
  ExternalLink, ArrowUpDown, MessageSquareQuote, ListChecks,
  PhoneCall, Target, Star, Activity,
} from 'lucide-react'
import type { IntentsData } from '@/app/api/customers/[slug]/intents/route'
import type { IntentDetailData } from '@/app/api/customers/[slug]/intents/detail/route'

const PALETTE = ['#9341fb', '#6ae1a1', '#3b9ef6', '#f5c842', '#e6483d', '#9ca3af']
const PAGE_SIZE = 50

function shortDate(d: string): string {
  const parts = d.split('-')
  if (parts.length < 3) return d
  return `${parseInt(parts[2])}.${parseInt(parts[1])}.`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function scoreColor(score: number | null): string {
  if (score == null) return '#9ca3af'
  if (score >= 0.85) return '#22c55e'
  if (score >= 0.6) return '#f59e0b'
  return '#e6483d'
}

function rateColor(rate: number, inverse = false): string {
  // For "good = high" metrics (goal completion) use inverse=false: high=green
  // For "bad = high" metrics (escalation) use inverse=true: high=red
  if (inverse) {
    if (rate >= 30) return '#e6483d'
    if (rate >= 15) return '#f59e0b'
    return '#22c55e'
  }
  if (rate >= 50) return '#22c55e'
  if (rate >= 25) return '#f59e0b'
  return '#e6483d'
}

function useChartColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return { axis: isDark ? '#7a7f8a' : '#6b7280', grid: isDark ? '#2d2f33' : '#e5e7eb' }
}

function KPICard({ title, value, subtitle, color, icon }: {
  title: string
  value: string | number
  subtitle?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="h-0.5" style={{ backgroundColor: color }} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="rounded-md p-1.5 shrink-0" style={{ backgroundColor: `${color}1f`, color }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Sparkline({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  if (data.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>
  const w = 80
  const h = 20
  const max = Math.max(...data.map((d) => d.count), 1)
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (d.count / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

type SortDir = 'asc' | 'desc'
type SortKey = 'turns' | 'sessions' | 'avgScore' | 'escalationRate' | 'goalRate' | 'avgRating' | 'name'

interface Props {
  slug: string
  displayName: string
}

export function Intents({ slug, displayName }: Props) {
  const init = defaultDateRange()
  const [data, setData] = useState<IntentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [channel, setChannel] = useState('all')
  const [endpoints, setEndpoints] = useState<string[]>([])
  const [snapshots, setSnapshots] = useState<string[]>([])
  const [endpointOpen, setEndpointOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'turns', dir: 'desc' })
  const [page, setPage] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)

  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const [detail, setDetail] = useState<IntentDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const colors = useChartColors()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (channel !== 'all') p.set('channel', channel)
      endpoints.forEach((e) => p.append('endpoint', e))
      snapshots.forEach((s) => p.append('snapshot', s))
      const res = await fetch(`/api/customers/${slug}/intents?${p}`)
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug, from, to, channel, endpoints, snapshots])

  useEffect(() => { fetchData() }, [fetchData])

  // Lazy-load detail when an intent is selected
  useEffect(() => {
    if (!selectedIntent) { setDetail(null); return }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    const p = new URLSearchParams({ intent: selectedIntent })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (channel !== 'all') p.set('channel', channel)
    endpoints.forEach((e) => p.append('endpoint', e))
    snapshots.forEach((s) => p.append('snapshot', s))
    fetch(`/api/customers/${slug}/intents/detail?${p}`)
      .then((r) => r.json() as Promise<IntentDetailData>)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [slug, selectedIntent, from, to, channel, endpoints, snapshots])

  function clearFilters() {
    const d = defaultDateRange()
    setFrom(d.from); setTo(d.to); setChannel('all'); setEndpoints([]); setSnapshots([])
  }

  const hasFilters = from || to || channel !== 'all' || endpoints.length > 0 || snapshots.length > 0

  function exportUrl(sheet: 'intents' | 'utterances', format: 'csv' | 'xlsx', intent?: string): string {
    const p = new URLSearchParams({ sheet, format })
    if (intent) p.set('intent', intent)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (channel !== 'all') p.set('channel', channel)
    endpoints.forEach((e) => p.append('endpoint', e))
    snapshots.forEach((s) => p.append('snapshot', s))
    return `/api/customers/${slug}/intents/export?${p}`
  }

  // Build the stacked-area trend dataset: pivot trend.counts into a flat series
  // with one numeric key per top intent (+ Other).
  const stackedTrend = useMemo(() => {
    if (!data) return []
    const keys = [...data.trendIntents, 'Other']
    return data.trend.map((d) => {
      const row: Record<string, number | string> = { date: d.date }
      for (const k of keys) row[k] = d.counts[k] ?? 0
      return row
    })
  }, [data])

  const trendKeys = useMemo(() => {
    if (!data) return []
    return [...data.trendIntents, 'Other']
  }, [data])

  const sortedIntents = useMemo(() => {
    if (!data) return []
    const arr = [...data.intents]
    arr.sort((a, b) => {
      const k = sort.key
      let av: number | string
      let bv: number | string
      if (k === 'name') { av = a.name; bv = b.name }
      else if (k === 'avgScore') { av = a.avgScore ?? -1; bv = b.avgScore ?? -1 }
      else if (k === 'avgRating') { av = a.avgRating ?? -1; bv = b.avgRating ?? -1 }
      else if (k === 'escalationRate') {
        av = a.sessions > 0 ? a.escalatedSessions / a.sessions : 0
        bv = b.sessions > 0 ? b.escalatedSessions / b.sessions : 0
      }
      else if (k === 'goalRate') {
        av = a.sessions > 0 ? a.goalCompletedSessions / a.sessions : 0
        bv = b.sessions > 0 ? b.goalCompletedSessions / b.sessions : 0
      }
      else { av = a[k]; bv = b[k] }
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, sort])

  useEffect(() => { setPage(0) }, [from, to, channel, endpoints, snapshots, sort])

  const paged = sortedIntents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(sortedIntents.length / PAGE_SIZE))

  const selected = useMemo(
    () => sortedIntents.find((i) => i.name === selectedIntent) ?? null,
    [sortedIntents, selectedIntent],
  )

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const isEmpty = !loading && data && data.summary.matchedTurns === 0

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b shrink-0 bg-card/50 print:hidden">
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{displayName}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-[#9341fb]" />
              Intents
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 gap-1.5"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!data || data.intents.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Export</span>
            </Button>
            {exportOpen && (
              <>
                <button className="fixed inset-0 z-30" aria-label="Close menu" onClick={() => setExportOpen(false)} />
                <div className="absolute right-12 top-9 z-40 w-56 rounded-md border bg-popover shadow-lg p-1 text-xs">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Intents table</p>
                  <a href={exportUrl('intents', 'xlsx')} onClick={() => setExportOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                  </a>
                  <a href={exportUrl('intents', 'csv')} onClick={() => setExportOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </a>
                  <button
                    onClick={() => { setExportOpen(false); window.print() }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-accent border-t mt-1"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
                  </button>
                </div>
              </>
            )}
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />

          {(data?.availableChannels?.length ?? 0) > 1 && (
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {data!.availableChannels.map((ch) => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {(data?.availableEndpoints?.length ?? 0) > 0 && (
            <MultiSelect options={data!.availableEndpoints} value={endpoints} onChange={setEndpoints} placeholder="All endpoints" className="w-44" open={endpointOpen} onOpenChange={setEndpointOpen} />
          )}

          {(data?.availableSnapshots?.length ?? 0) > 0 && (
            <MultiSelect options={data!.availableSnapshots} value={snapshots} onChange={setSnapshots} placeholder="All snapshots" className="w-44" open={snapshotOpen} onOpenChange={setSnapshotOpen} />
          )}

          {hasFilters && (
            <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors" onClick={clearFilters}>
              Reset filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {isEmpty && (
          <Card>
            <CardContent className="p-10 text-center">
              <Brain className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">No intent data in this period</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adjust the filters or import more analytics data to populate this view.
              </p>
            </CardContent>
          </Card>
        )}

        {!isEmpty && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KPICard
                title="Matched Turns"
                value={data ? data.summary.matchedTurns.toLocaleString() : '—'}
                subtitle={data ? `${data.summary.matchedRate}% of ${data.summary.totalTurns.toLocaleString()} total` : undefined}
                color="#9341fb"
                icon={<Brain className="h-4 w-4" />}
              />
              <KPICard
                title="Distinct Intents"
                value={data ? data.summary.distinctIntents : '—'}
                subtitle="unique intents matched"
                color="#3b9ef6"
                icon={<ListChecks className="h-4 w-4" />}
              />
              <KPICard
                title="Avg Confidence"
                value={data?.summary.avgScore != null ? (data.summary.avgScore * 100).toFixed(1) + '%' : '—'}
                subtitle="across all matched turns"
                color={scoreColor(data?.summary.avgScore ?? null)}
                icon={<Activity className="h-4 w-4" />}
              />
              <KPICard
                title="Unmatched Turns"
                value={data ? data.summary.unmatchedTurns.toLocaleString() : '—'}
                subtitle={data && data.summary.totalTurns > 0
                  ? `${((data.summary.unmatchedTurns / data.summary.totalTurns) * 100).toFixed(1)}% of turns`
                  : undefined}
                color={data && data.summary.totalTurns > 0
                  ? rateColor(Math.round((data.summary.unmatchedTurns / data.summary.totalTurns) * 100), true)
                  : '#9ca3af'}
                icon={<MessageSquareQuote className="h-4 w-4" />}
              />
            </div>

            {/* Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#9341fb]" /> Top 5 intents over time
                  <span className="text-xs font-normal text-muted-foreground">— stacked daily volume; the rest grouped as &quot;Other&quot;</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data && stackedTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={stackedTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} tickFormatter={shortDate} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                      <Legend verticalAlign="top" align="right" height={24} iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                      {trendKeys.map((k, i) => (
                        <Area
                          key={k}
                          name={k}
                          type="monotone"
                          dataKey={k}
                          stackId="intents"
                          stroke={PALETTE[i % PALETTE.length]}
                          fill={PALETTE[i % PALETTE.length]}
                          fillOpacity={0.35}
                          strokeWidth={1.5}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground p-4">No trend data.</p>
                )}
              </CardContent>
            </Card>

            {/* Intents table */}
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-[#9341fb]" /> Intents
                  <span className="text-xs font-normal text-muted-foreground">
                    — {sortedIntents.length.toLocaleString()} total · click a row for utterances and sessions
                  </span>
                </CardTitle>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium"><SortHeader label="Intent" active={sort.key === 'name'} dir={sort.dir} onClick={() => toggleSort('name')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Turns" active={sort.key === 'turns'} dir={sort.dir} onClick={() => toggleSort('turns')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Sessions" active={sort.key === 'sessions'} dir={sort.dir} onClick={() => toggleSort('sessions')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Confidence" active={sort.key === 'avgScore'} dir={sort.dir} onClick={() => toggleSort('avgScore')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Escalation" active={sort.key === 'escalationRate'} dir={sort.dir} onClick={() => toggleSort('escalationRate')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Goal" active={sort.key === 'goalRate'} dir={sort.dir} onClick={() => toggleSort('goalRate')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Rating" active={sort.key === 'avgRating'} dir={sort.dir} onClick={() => toggleSort('avgRating')} /></th>
                        <th className="px-4 py-2 font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((it, idx) => {
                        const escRate = it.sessions > 0 ? Math.round((it.escalatedSessions / it.sessions) * 100) : 0
                        const goalRate = it.sessions > 0 ? Math.round((it.goalCompletedSessions / it.sessions) * 100) : 0
                        return (
                          <tr
                            key={it.name}
                            className="border-b last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                            onClick={() => setSelectedIntent(it.name)}
                          >
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium truncate max-w-xs">{it.name}</span>
                                <span className="text-[10px] text-muted-foreground tabular-nums">{it.share}% of matched</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{it.turns.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{it.sessions.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {it.avgScore != null ? (
                                <span style={{ color: scoreColor(it.avgScore) }}>
                                  {(it.avgScore * 100).toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {it.sessions > 0 ? (
                                <span style={{ color: rateColor(escRate, true) }}>
                                  {escRate}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {it.sessions > 0 ? (
                                <span style={{ color: rateColor(goalRate) }}>
                                  {goalRate}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {it.avgRating != null ? (
                                <span title={`n=${it.ratedSessions}`}>
                                  {it.avgRating.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Sparkline data={it.sparkline} color={PALETTE[idx % PALETTE.length]} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Intent detail sheet */}
      <Sheet open={!!selectedIntent} onOpenChange={(o) => !o && setSelectedIntent(null)}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-4 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#9341fb]" />
                  {selected.name}
                </SheetTitle>
                <SheetDescription>
                  {selected.turns.toLocaleString()} turns across {selected.sessions.toLocaleString()} sessions · {selected.share}% of matched turns
                </SheetDescription>
              </SheetHeader>

              {/* Outcome correlation */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <OutcomeStat
                  icon={<Activity className="h-3.5 w-3.5" />}
                  label="Avg confidence"
                  value={selected.avgScore != null ? `${(selected.avgScore * 100).toFixed(0)}%` : '—'}
                  color={scoreColor(selected.avgScore)}
                />
                <OutcomeStat
                  icon={<PhoneCall className="h-3.5 w-3.5" />}
                  label="Escalation"
                  value={selected.sessions > 0
                    ? `${Math.round((selected.escalatedSessions / selected.sessions) * 100)}%`
                    : '—'}
                  sub={`${selected.escalatedSessions}/${selected.sessions}`}
                  color={selected.sessions > 0
                    ? rateColor(Math.round((selected.escalatedSessions / selected.sessions) * 100), true)
                    : '#9ca3af'}
                />
                <OutcomeStat
                  icon={<Target className="h-3.5 w-3.5" />}
                  label="Goal completion"
                  value={selected.sessions > 0
                    ? `${Math.round((selected.goalCompletedSessions / selected.sessions) * 100)}%`
                    : '—'}
                  sub={`${selected.goalCompletedSessions}/${selected.sessions}`}
                  color={selected.sessions > 0
                    ? rateColor(Math.round((selected.goalCompletedSessions / selected.sessions) * 100))
                    : '#9ca3af'}
                />
                <OutcomeStat
                  icon={<Star className="h-3.5 w-3.5" />}
                  label="Avg rating"
                  value={selected.avgRating != null ? selected.avgRating.toFixed(2) : '—'}
                  sub={selected.ratedSessions > 0 ? `n=${selected.ratedSessions}` : 'no ratings'}
                  color="#f5c842"
                />
              </div>

              {/* Confidence quantiles */}
              {(selected.p10Score != null || selected.medianScore != null || selected.p90Score != null) && (
                <div className="rounded-md border p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Confidence distribution</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">p10</p>
                      <p className="text-base font-semibold tabular-nums" style={{ color: scoreColor(selected.p10Score) }}>
                        {selected.p10Score != null ? `${(selected.p10Score * 100).toFixed(0)}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">median</p>
                      <p className="text-base font-semibold tabular-nums" style={{ color: scoreColor(selected.medianScore) }}>
                        {selected.medianScore != null ? `${(selected.medianScore * 100).toFixed(0)}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">p90</p>
                      <p className="text-base font-semibold tabular-nums" style={{ color: scoreColor(selected.p90Score) }}>
                        {selected.p90Score != null ? `${(selected.p90Score * 100).toFixed(0)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-intent trend chart */}
              {selected.sparkline.length > 1 && (
                <div className="rounded-md border p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Daily volume</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={selected.sparkline} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} tickFormatter={shortDate} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={32} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                      <Line type="monotone" dataKey="count" stroke="#9341fb" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sample utterances */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Top sample utterances</p>
                  {detail && detail.utterances.length > 0 && (
                    <a
                      href={exportUrl('utterances', 'xlsx', selectedIntent ?? '')}
                      className="text-[11px] text-[#9341fb] hover:underline inline-flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> Export all
                    </a>
                  )}
                </div>
                {detailLoading ? (
                  <p className="text-xs text-muted-foreground p-2">Loading…</p>
                ) : detail?.utterancesMasked ? (
                  <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-3">
                    Input text is masked for this customer (Blind Mode). Sample utterances aren&apos;t available.
                  </p>
                ) : detail && detail.utterances.length > 0 ? (
                  <ul className="rounded-md border divide-y">
                    {detail.utterances.map((u, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                        <span className="flex-1 break-words">{u.inputText}</span>
                        <span className="shrink-0 flex items-center gap-2 tabular-nums">
                          <span className="text-muted-foreground">{u.count}×</span>
                          {u.avgScore != null && (
                            <span style={{ color: scoreColor(u.avgScore) }}>{(u.avgScore * 100).toFixed(0)}%</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">No utterances found.</p>
                )}
              </div>

              {/* Recent sessions */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Recent sessions</p>
                {detailLoading ? (
                  <p className="text-xs text-muted-foreground p-2">Loading…</p>
                ) : detail && detail.sessions.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-1.5 font-medium">When</th>
                          <th className="px-3 py-1.5 font-medium">Snapshot</th>
                          <th className="px-3 py-1.5 font-medium text-right">Turns</th>
                          <th className="px-3 py-1.5 font-medium text-right">Avg score</th>
                          <th className="px-3 py-1.5 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.sessions.map((s) => (
                          <tr key={s.sessionId} className="border-b last:border-0">
                            <td className="px-3 py-1.5 tabular-nums">{formatTimestamp(s.firstSeen)}</td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">{s.snapshotName ?? '—'}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{s.turns}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {s.avgScore != null ? (
                                <span style={{ color: scoreColor(s.avgScore) }}>{(s.avgScore * 100).toFixed(0)}%</span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <Link
                                href={`/customers/${slug}/transcripts/${encodeURIComponent(s.sessionId)}`}
                                className="text-[#9341fb] hover:underline inline-flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">No sessions found.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function OutcomeStat({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  )
}

function SortHeader({ label, active, dir, onClick }: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? 'text-foreground' : 'text-muted-foreground/40'} ${active && dir === 'asc' ? 'rotate-180' : ''}`} />
    </button>
  )
}
