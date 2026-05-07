'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
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
  RefreshCw, FlaskConical, CheckCircle2, Activity, Download, Printer,
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ExternalLink,
  ArrowUpDown, AlertTriangle, FileSpreadsheet,
} from 'lucide-react'
import type { AgentEvaluationsData } from '@/app/api/customers/[slug]/agent-evaluations/route'

const PAGE_SIZE = 50

function passRateColor(rate: number): string {
  if (rate >= 90) return '#22c55e'
  if (rate >= 75) return '#f59e0b'
  return '#e6483d'
}

function statusColor(status: 'pass' | 'mixed' | 'fail'): string {
  if (status === 'pass') return '#22c55e'
  if (status === 'fail') return '#e6483d'
  return '#f59e0b'
}

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

function useChartColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return { axis: isDark ? '#7a7f8a' : '#6b7280', grid: isDark ? '#2d2f33' : '#e5e7eb' }
}

function KPICard({ title, value, subtitle, color, icon, delta }: {
  title: string
  value: string | number
  subtitle?: string
  color: string
  icon: React.ReactNode
  delta?: { value: number; suffix?: string } | null
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
        {delta && (
          <div className="mt-2 flex items-center gap-1 text-[11px]">
            {delta.value > 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : delta.value < 0 ? (
              <TrendingDown className="h-3 w-3 text-rose-500" />
            ) : null}
            <span className={delta.value > 0 ? 'text-emerald-500' : delta.value < 0 ? 'text-rose-500' : 'text-muted-foreground'}>
              {delta.value > 0 ? '+' : ''}{delta.value}{delta.suffix ?? ''}
            </span>
            <span className="text-muted-foreground">vs. prior period</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Tiny sparkline renderer for criteria table rows.
function Sparkline({ data, color }: { data: { date: string; passRate: number }[]; color: string }) {
  if (data.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>
  const w = 80
  const h = 20
  const max = Math.max(...data.map((d) => d.passRate), 100)
  const min = Math.min(...data.map((d) => d.passRate), 0)
  const range = Math.max(1, max - min)
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((d.passRate - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

type SortDir = 'asc' | 'desc'
type RunSortKey = 'timestamp' | 'passRate' | 'failed' | 'snapshotName'
type CriterionSortKey = 'name' | 'total' | 'passRate' | 'deltaVsPrior'

interface Props {
  slug: string
  displayName: string
}

export function AgentEvaluations({ slug, displayName }: Props) {
  const init = defaultDateRange()
  const [data, setData] = useState<AgentEvaluationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [channel, setChannel] = useState('all')
  const [endpoints, setEndpoints] = useState<string[]>([])
  const [snapshots, setSnapshots] = useState<string[]>([])
  const [endpointOpen, setEndpointOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)

  const [criterionSort, setCriterionSort] = useState<{ key: CriterionSortKey; dir: SortDir }>({ key: 'total', dir: 'desc' })
  const [runSort, setRunSort] = useState<{ key: RunSortKey; dir: SortDir }>({ key: 'timestamp', dir: 'desc' })
  const [runPage, setRunPage] = useState(0)

  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

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
      const res = await fetch(`/api/customers/${slug}/agent-evaluations?${p}`)
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug, from, to, channel, endpoints, snapshots])

  useEffect(() => { fetchData() }, [fetchData])

  function clearFilters() {
    const d = defaultDateRange()
    setFrom(d.from); setTo(d.to); setChannel('all'); setEndpoints([]); setSnapshots([])
  }

  const hasFilters = from || to || channel !== 'all' || endpoints.length > 0 || snapshots.length > 0

  function exportUrl(sheet: 'runs' | 'criteria', format: 'csv' | 'xlsx'): string {
    const p = new URLSearchParams({ sheet, format })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (channel !== 'all') p.set('channel', channel)
    endpoints.forEach((e) => p.append('endpoint', e))
    snapshots.forEach((s) => p.append('snapshot', s))
    return `/api/customers/${slug}/agent-evaluations/export?${p}`
  }

  const sortedCriteria = useMemo(() => {
    if (!data) return []
    const arr = [...data.criteria]
    arr.sort((a, b) => {
      const k = criterionSort.key
      let av: number | string
      let bv: number | string
      if (k === 'name') { av = a.name; bv = b.name }
      else if (k === 'deltaVsPrior') { av = a.deltaVsPrior ?? -Infinity; bv = b.deltaVsPrior ?? -Infinity }
      else { av = a[k]; bv = b[k] }
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return criterionSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, criterionSort])

  const sortedRuns = useMemo(() => {
    if (!data) return []
    const arr = [...data.runs]
    arr.sort((a, b) => {
      const k = runSort.key
      let av: number | string
      let bv: number | string
      if (k === 'timestamp') { av = a.timestamp; bv = b.timestamp }
      else if (k === 'snapshotName') { av = a.snapshotName ?? ''; bv = b.snapshotName ?? '' }
      else if (k === 'passRate') { av = a.total > 0 ? a.passed / a.total : 0; bv = b.total > 0 ? b.passed / b.total : 0 }
      else { av = a.failed; bv = b.failed }
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return runSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, runSort])

  const pagedRuns = sortedRuns.slice(runPage * PAGE_SIZE, (runPage + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / PAGE_SIZE))

  useEffect(() => { setRunPage(0) }, [from, to, channel, endpoints, snapshots, runSort])

  const selectedRun = useMemo(
    () => sortedRuns.find((r) => r.sessionId === selectedRunId) ?? null,
    [sortedRuns, selectedRunId],
  )

  const selectedCriterionData = useMemo(() => {
    if (!data || !selectedCriterion) return null
    const meta = data.criteria.find((c) => c.name === selectedCriterion)
    if (!meta) return null
    const runsForCriterion = data.runs
      .map((r) => {
        const hit = r.results.find((res) => res.name === selectedCriterion)
        return hit ? { run: r, achieved: hit.achieved } : null
      })
      .filter((x): x is { run: typeof data.runs[number]; achieved: boolean } => !!x)
    return { meta, runs: runsForCriterion }
  }, [data, selectedCriterion])

  function toggleCriterionSort(key: CriterionSortKey) {
    setCriterionSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  function toggleRunSort(key: RunSortKey) {
    setRunSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const isEmpty = !loading && data && data.summary.totalRuns === 0
  const passRateDelta = data?.summary.prevPassRate != null
    ? data.summary.overallPassRate - data.summary.prevPassRate
    : null

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b shrink-0 bg-card/50 print:hidden">
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{displayName}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3 text-[#9341fb]" />
              Agent Evaluations
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 gap-1.5"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!data || data.summary.totalRuns === 0}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Export</span>
            </Button>
            {exportOpen && (
              <>
                <button
                  className="fixed inset-0 z-30"
                  aria-label="Close menu"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-12 top-9 z-40 w-56 rounded-md border bg-popover shadow-lg p-1 text-xs">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Runs</p>
                  <a href={exportUrl('runs', 'xlsx')} onClick={() => setExportOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                  </a>
                  <a href={exportUrl('runs', 'csv')} onClick={() => setExportOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </a>
                  <p className="px-2 py-1 mt-1 text-[10px] uppercase tracking-wider text-muted-foreground border-t">Criteria summary</p>
                  <a href={exportUrl('criteria', 'xlsx')} onClick={() => setExportOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                  </a>
                  <a href={exportUrl('criteria', 'csv')} onClick={() => setExportOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
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

        {/* Filter row — matches /dashboard */}
        <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />

          {(data?.availableEndpoints?.length ?? 0) > 0 && (
            <MultiSelect
              options={data!.availableEndpoints}
              value={endpoints}
              onChange={setEndpoints}
              placeholder="All endpoints"
              className="w-44"
              open={endpointOpen}
              onOpenChange={setEndpointOpen}
            />
          )}

          {(data?.availableSnapshots?.length ?? 0) > 0 && (
            <MultiSelect
              options={data!.availableSnapshots}
              value={snapshots}
              onChange={setSnapshots}
              placeholder="All snapshots"
              className="w-44"
              open={snapshotOpen}
              onOpenChange={setSnapshotOpen}
            />
          )}

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

          {hasFilters && (
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearFilters}
            >
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
              <FlaskConical className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">No simulator run data in this period</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adjust the filters or run more simulator tests in Cognigy to populate this view.
              </p>
            </CardContent>
          </Card>
        )}

        {!isEmpty && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KPICard
                title="Overall Pass Rate"
                value={data ? `${data.summary.overallPassRate}%` : '—'}
                subtitle={data ? `${data.summary.totalPassed.toLocaleString()} / ${data.summary.totalChecks.toLocaleString()} criteria checks` : undefined}
                color={data ? passRateColor(data.summary.overallPassRate) : '#9341fb'}
                icon={<CheckCircle2 className="h-4 w-4" />}
                delta={passRateDelta != null ? { value: passRateDelta, suffix: 'pp' } : null}
              />
              <KPICard
                title="Test Runs"
                value={data ? data.summary.totalRuns.toLocaleString() : '—'}
                subtitle="simulator sessions evaluated"
                color="#9341fb"
                icon={<FlaskConical className="h-4 w-4" />}
                delta={data?.summary.prevTotalRuns != null && data.summary.prevTotalRuns > 0
                  ? { value: data.summary.totalRuns - data.summary.prevTotalRuns }
                  : null}
              />
              <KPICard
                title="Criteria Checked"
                value={data ? data.summary.criteriaCount : '—'}
                subtitle="unique evaluation criteria"
                color="#3b9ef6"
                icon={<Activity className="h-4 w-4" />}
              />
            </div>

            {/* Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#9341fb]" /> Pass Rate Trend
                  <span className="text-xs font-normal text-muted-foreground">— daily volatility vs running rate to date</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data && data.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} tickFormatter={shortDate} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<TrendTooltip />} />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        height={24}
                        iconType="plainline"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      <ReferenceLine y={data.summary.overallPassRate} stroke="#9341fb" strokeDasharray="3 3" strokeOpacity={0.3} />
                      <Line
                        name="Daily"
                        type="monotone"
                        dataKey="passRate"
                        stroke="#9341fb"
                        strokeWidth={2}
                        dot={(props: { cx?: number; cy?: number; payload?: { criteriaCount?: number } }) => {
                          const { cx, cy, payload } = props
                          if (cx === undefined || cy === undefined) return <g />
                          // Mark thin-coverage days (≤25% of the period's max criteria/day)
                          // with a hollow dot so partial-coverage days read as low-confidence.
                          const max = Math.max(...(data?.trend ?? []).map((d) => d.criteriaCount), 1)
                          const thin = (payload?.criteriaCount ?? 0) <= Math.max(1, Math.round(max * 0.25))
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={thin ? 3 : 3.5}
                              fill={thin ? 'transparent' : '#9341fb'}
                              stroke="#9341fb"
                              strokeWidth={1.5}
                            />
                          )
                        }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        name="Cumulative"
                        type="monotone"
                        dataKey="cumulativePassRate"
                        stroke="#3b9ef6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground p-4">No trend data.</p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Hollow dots on the daily line mark days with thin coverage
                  (only a small subset of criteria ran). Use the cumulative
                  line to judge overall trajectory — it isn&apos;t skewed by
                  occasional ad-hoc test runs.
                </p>
              </CardContent>
            </Card>

            {/* Failure samples */}
            {data && data.failureSamples.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    Recent Failure Samples
                    <span className="text-xs font-normal text-muted-foreground">— jump to transcripts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {data.failureSamples.map((s) => (
                      <li key={s.sessionId} className="flex items-start gap-3 text-xs border-b last:border-0 pb-1.5 last:pb-0">
                        <span className="text-muted-foreground tabular-nums shrink-0 w-32">{formatTimestamp(s.timestamp)}</span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-rose-500">
                            {s.failedCriteria.length} failed:&nbsp;
                          </span>
                          <span className="text-foreground/80">{s.failedCriteria.join(', ')}</span>
                          {s.snapshotName && <span className="ml-2 text-muted-foreground">· {s.snapshotName}</span>}
                        </div>
                        <Link
                          href={`/customers/${slug}/transcripts/${encodeURIComponent(s.sessionId)}`}
                          className="text-[11px] text-[#9341fb] hover:underline shrink-0 flex items-center gap-1"
                        >
                          Transcript <ExternalLink className="h-3 w-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Criteria table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#9341fb]" /> Criteria
                  <span className="text-xs font-normal text-muted-foreground">— click a row for run-by-run detail</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium"><SortHeader label="Criterion" active={criterionSort.key === 'name'} dir={criterionSort.dir} onClick={() => toggleCriterionSort('name')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Runs" active={criterionSort.key === 'total'} dir={criterionSort.dir} onClick={() => toggleCriterionSort('total')} /></th>
                        <th className="px-2 py-2 font-medium text-right">Passed</th>
                        <th className="px-2 py-2 font-medium text-right">Failed</th>
                        <th className="px-2 py-2 font-medium"><SortHeader label="Pass rate" active={criterionSort.key === 'passRate'} dir={criterionSort.dir} onClick={() => toggleCriterionSort('passRate')} /></th>
                        <th className="px-2 py-2 font-medium">Trend</th>
                        <th className="px-4 py-2 font-medium text-right"><SortHeader label="Δ vs prior" active={criterionSort.key === 'deltaVsPrior'} dir={criterionSort.dir} onClick={() => toggleCriterionSort('deltaVsPrior')} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCriteria.map((c) => (
                        <tr
                          key={c.name}
                          className="border-b last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                          onClick={() => setSelectedCriterion(c.name)}
                        >
                          <td className="px-4 py-2 font-medium truncate max-w-xs">{c.name}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{c.total.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{c.passed.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{c.failed.toLocaleString()}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2 min-w-[140px]">
                              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${c.passRate}%`, backgroundColor: passRateColor(c.passRate) }} />
                              </div>
                              <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: passRateColor(c.passRate) }}>
                                {c.passRate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <Sparkline data={c.sparkline} color={passRateColor(c.passRate)} />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[11px]">
                            {c.deltaVsPrior == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : c.deltaVsPrior === 0 ? (
                              <span className="text-muted-foreground">0pp</span>
                            ) : (
                              <span className={c.deltaVsPrior > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                {c.deltaVsPrior > 0 ? '+' : ''}{c.deltaVsPrior}pp
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Runs table */}
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-[#9341fb]" /> Runs
                  <span className="text-xs font-normal text-muted-foreground">
                    — {sortedRuns.length.toLocaleString()} total
                  </span>
                </CardTitle>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Page {runPage + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={runPage === 0} onClick={() => setRunPage((p) => Math.max(0, p - 1))}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={runPage >= totalPages - 1} onClick={() => setRunPage((p) => Math.min(totalPages - 1, p + 1))}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium"><SortHeader label="When" active={runSort.key === 'timestamp'} dir={runSort.dir} onClick={() => toggleRunSort('timestamp')} /></th>
                        <th className="px-2 py-2 font-medium">Session</th>
                        <th className="px-2 py-2 font-medium"><SortHeader label="Snapshot" active={runSort.key === 'snapshotName'} dir={runSort.dir} onClick={() => toggleRunSort('snapshotName')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Pass rate" active={runSort.key === 'passRate'} dir={runSort.dir} onClick={() => toggleRunSort('passRate')} /></th>
                        <th className="px-2 py-2 font-medium text-right"><SortHeader label="Failed" active={runSort.key === 'failed'} dir={runSort.dir} onClick={() => toggleRunSort('failed')} /></th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRuns.map((r) => {
                        const passRate = r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0
                        return (
                          <tr
                            key={r.sessionId + r.timestamp}
                            className="border-b last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                            onClick={() => setSelectedRunId(r.sessionId)}
                          >
                            <td className="px-4 py-2 tabular-nums">{formatTimestamp(r.timestamp)}</td>
                            <td className="px-2 py-2 font-mono text-[11px] truncate max-w-[160px]" title={r.sessionId}>{r.sessionId.slice(-12)}</td>
                            <td className="px-2 py-2 text-muted-foreground truncate max-w-[160px]">{r.snapshotName ?? '—'}</td>
                            <td className="px-2 py-2 text-right tabular-nums" style={{ color: passRateColor(passRate) }}>{passRate}%</td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {r.failed > 0 ? <span className="text-rose-600 dark:text-rose-400">{r.failed}</span> : <span className="text-muted-foreground">0</span>}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{ backgroundColor: `${statusColor(r.status)}1f`, color: statusColor(r.status) }}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Link
                                href={`/customers/${slug}/transcripts/${encodeURIComponent(r.sessionId)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-[#9341fb] hover:underline inline-flex items-center gap-1"
                              >
                                Transcript <ExternalLink className="h-3 w-3" />
                              </Link>
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

      {/* Criterion detail sheet */}
      <Sheet open={!!selectedCriterion} onOpenChange={(o) => !o && setSelectedCriterion(null)}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-4 overflow-y-auto">
          {selectedCriterionData && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: passRateColor(selectedCriterionData.meta.passRate) }} />
                  {selectedCriterionData.meta.name}
                </SheetTitle>
                <SheetDescription>
                  {selectedCriterionData.meta.passed.toLocaleString()} / {selectedCriterionData.meta.total.toLocaleString()} runs passed
                  ({selectedCriterionData.meta.passRate}%){selectedCriterionData.meta.deltaVsPrior != null && (
                    <span className={selectedCriterionData.meta.deltaVsPrior > 0 ? ' text-emerald-500' : selectedCriterionData.meta.deltaVsPrior < 0 ? ' text-rose-500' : ''}>
                      {' · '}{selectedCriterionData.meta.deltaVsPrior > 0 ? '+' : ''}{selectedCriterionData.meta.deltaVsPrior}pp vs prior
                    </span>
                  )}
                </SheetDescription>
              </SheetHeader>

              {selectedCriterionData.meta.sparkline.length > 1 && (
                <div className="rounded-md border p-3">
                  <p className="text-[11px] text-muted-foreground mb-2">Daily pass rate</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={selectedCriterionData.meta.sparkline} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} tickFormatter={shortDate} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v) => [`${v}%`, 'pass rate']} />
                      <Line type="monotone" dataKey="passRate" stroke={passRateColor(selectedCriterionData.meta.passRate)} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Runs that evaluated this criterion</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-3 py-1.5 font-medium">When</th>
                        <th className="px-3 py-1.5 font-medium">Snapshot</th>
                        <th className="px-3 py-1.5 font-medium">Result</th>
                        <th className="px-3 py-1.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCriterionData.runs.slice(0, 200).map(({ run, achieved }) => (
                        <tr key={run.sessionId + run.timestamp} className="border-b last:border-0">
                          <td className="px-3 py-1.5 tabular-nums">{formatTimestamp(run.timestamp)}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">{run.snapshotName ?? '—'}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: achieved ? '#22c55e1f' : '#e6483d1f',
                                color: achieved ? '#22c55e' : '#e6483d',
                              }}
                            >
                              {achieved ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <Link
                              href={`/customers/${slug}/transcripts/${encodeURIComponent(run.sessionId)}`}
                              className="text-[#9341fb] hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedCriterionData.runs.length > 200 && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
                      Showing first 200 of {selectedCriterionData.runs.length}. Export the runs sheet to see all.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Run detail sheet */}
      <Sheet open={!!selectedRunId} onOpenChange={(o) => !o && setSelectedRunId(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-4 overflow-y-auto">
          {selectedRun && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" style={{ color: statusColor(selectedRun.status) }} />
                  Test Run
                </SheetTitle>
                <SheetDescription>
                  {formatTimestamp(selectedRun.timestamp)}
                  {selectedRun.snapshotName && ` · ${selectedRun.snapshotName}`}
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Passed</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{selectedRun.passed}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Failed</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{selectedRun.failed}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{selectedRun.total}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Criteria</p>
                <ul className="rounded-md border divide-y">
                  {selectedRun.results.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <span className="truncate">{r.name}</span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
                        style={{
                          backgroundColor: r.achieved ? '#22c55e1f' : '#e6483d1f',
                          color: r.achieved ? '#22c55e' : '#e6483d',
                        }}
                      >
                        {r.achieved ? 'Pass' : 'Fail'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/customers/${slug}/transcripts/${encodeURIComponent(selectedRun.sessionId)}`}
                className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open transcript
              </Link>

              <p className="text-[10px] text-muted-foreground font-mono break-all">{selectedRun.sessionId}</p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

interface TrendPayloadEntry {
  payload: {
    date: string
    passRate: number
    cumulativePassRate: number
    passed: number
    total: number
    runs: number
    criteriaCount: number
  }
}

function TrendTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TrendPayloadEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-xl text-xs space-y-1 z-50">
      <p className="font-semibold border-b border-border pb-1 mb-1">{label}</p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#9341fb' }} />
        Daily: <span className="font-semibold tabular-nums">{p.passRate}%</span>
        <span className="text-muted-foreground">({p.passed}/{p.total})</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#3b9ef6' }} />
        Cumulative: <span className="font-semibold tabular-nums">{p.cumulativePassRate}%</span>
      </p>
      <p className="text-muted-foreground border-t pt-1 mt-1">
        {p.criteriaCount} {p.criteriaCount === 1 ? 'criterion' : 'criteria'} · {p.runs} run{p.runs !== 1 ? 's' : ''}
      </p>
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
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? 'text-foreground' : 'text-muted-foreground/40'} ${active && dir === 'asc' ? 'rotate-180' : ''}`} />
    </button>
  )
}
