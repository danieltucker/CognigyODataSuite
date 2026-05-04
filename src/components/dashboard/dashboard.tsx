'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  AreaChart, Area,
  PieChart, Pie, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { DateRangePicker, defaultDateRange } from '@/components/ui/date-range-picker'
import {
  RefreshCw, Users, MessageSquare, PhoneCall, Brain,
  TrendingUp, BarChart3, Cpu, Activity, Target,
  GitBranch, AlertTriangle, CheckCircle2, FlaskConical, UserCheck,
} from 'lucide-react'
import type { DashboardData } from '@/app/api/customers/[slug]/dashboard/route'

const PALETTE = ['#9341fb', '#6ae1a1', '#3b9ef6', '#f5c842', '#e6483d', '#14b8a6', '#f97316', '#ec4899']
const SCORE_COLORS = [
  '#e6483d', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#3b9ef6', '#9341fb',
]

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

function useChartColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return {
    axis: isDark ? '#7a7f8a' : '#6b7280',
    grid: isDark ? '#2d2f33' : '#e5e7eb',
    isDark,
  }
}

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean
  payload?: Array<{ value: number; name?: string; color?: string; fill?: string }>
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-xl text-xs space-y-0.5 z-50">
      {label && <p className="font-semibold text-foreground border-b border-border pb-1 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color ?? entry.fill ?? '#9341fb' }}>
          {formatter ? formatter(entry.value) : entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

// Custom dot matching the reference screenshot style
function AreaDot({ cx, cy, stroke }: { cx?: number; cy?: number; stroke?: string }) {
  if (cx === undefined || cy === undefined) return null
  return <circle cx={cx} cy={cy} r={3.5} fill="white" stroke={stroke} strokeWidth={2} />
}

function AreaActiveDot({ cx, cy, stroke }: { cx?: number; cy?: number; stroke?: string }) {
  if (cx === undefined || cy === undefined) return null
  return <circle cx={cx} cy={cy} r={5} fill="white" stroke={stroke} strokeWidth={2.5} />
}

// Short date label: "28 Apr" → "28/4"
function shortDate(d: string): string {
  const parts = d.split('-')
  if (parts.length < 3) return d
  return `${parseInt(parts[2])}.${parseInt(parts[1])}.`
}

function KPICard({ title, value, subtitle, color, icon }: {
  title: string
  value: string | number | null
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
            <p className="mt-1 text-2xl font-bold tabular-nums">{value ?? '—'}</p>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="shrink-0 rounded-lg p-2" style={{ backgroundColor: color + '20', color }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%'
  return ((a / b) * 100).toFixed(1) + '%'
}

function passRateColor(rate: number): string {
  if (rate >= 90) return '#22c55e'
  if (rate >= 75) return '#f59e0b'
  return '#e6483d'
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

interface Props {
  slug: string
  displayName: string
}

export function Dashboard({ slug, displayName }: Props) {
  const init = defaultDateRange()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [channel, setChannel] = useState('all')
  const [endpoints, setEndpoints] = useState<string[]>([])
  const [snapshots, setSnapshots] = useState<string[]>([])
  const [endpointOpen, setEndpointOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
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

      const res = await fetch(`/api/customers/${slug}/dashboard?${p}`)
      if (!res.ok) throw new Error(`Failed to load dashboard: ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug, from, to, channel, endpoints, snapshots])

  useEffect(() => { fetchData() }, [fetchData])

  const escalationPct = data ? pct(data.escalationRate.escalated, data.escalationRate.total) : null
  const avgConvPerSession = data && data.summary.totalSessions > 0
    ? (data.summary.totalConversations / data.summary.totalSessions).toFixed(1)
    : null
  const llmErrorPct = data && data.llmErrors.totalTurns > 0
    ? pct(data.llmErrors.errorTurns, data.llmErrors.totalTurns)
    : null

  const hasFilters = from || to || channel !== 'all' || endpoints.length > 0 || snapshots.length > 0

  function clearFilters() {
    const d = defaultDateRange()
    setFrom(d.from)
    setTo(d.to)
    setChannel('all')
    setEndpoints([])
    setSnapshots([])
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b shrink-0 bg-card/50">
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{displayName}</h1>
            <p className="text-xs text-muted-foreground">Analytics Dashboard</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => { setFrom(f); setTo(t) }}
          />

          {(data?.availableChannels?.length ?? 0) > 1 && (
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {data!.availableChannels.map((ch) => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

      {!loading && data && data.llmErrors.errorTurns > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{data.llmErrors.errorTurns.toLocaleString()} LLM error{data.llmErrors.errorTurns !== 1 ? 's' : ''}</span>
            {' '}detected across{' '}
            <span className="font-semibold">{llmErrorPct}</span> of conversation turns in this period.
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <KPICard title="Sessions" value={data?.summary.totalSessions.toLocaleString() ?? null} color="#9341fb" icon={<Users className="h-4 w-4" />} />
          <KPICard
            title="Conversations"
            value={data?.summary.totalConversations.toLocaleString() ?? null}
            subtitle={avgConvPerSession ? `${avgConvPerSession} per session` : undefined}
            color="#3b9ef6"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <KPICard
            title="Escalations"
            value={data?.summary.totalEscalations.toLocaleString() ?? null}
            subtitle={escalationPct ? `${escalationPct} of sessions` : undefined}
            color="#e6483d"
            icon={<PhoneCall className="h-4 w-4" />}
          />
          <KPICard
            title="Avg Intent Score"
            value={data?.summary.avgIntentScore != null ? (data.summary.avgIntentScore * 100).toFixed(1) + '%' : null}
            color="#6ae1a1"
            icon={<Brain className="h-4 w-4" />}
          />
          <KPICard title="Goal Events" value={data?.summary.totalGoalEvents.toLocaleString() ?? null} color="#f5c842" icon={<Target className="h-4 w-4" />} />
        </div>

        {/* Session volume + Unique users — side by side, same area chart style */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-1 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#9341fb]" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {loading ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={data?.sessionVolume ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9341fb" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#9341fb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: colors.axis }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={shortDate}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="sessions"
                      stroke="#9341fb"
                      strokeWidth={2}
                      fill="url(#sessionsGrad)"
                      dot={<AreaDot stroke="#9341fb" />}
                      activeDot={<AreaActiveDot stroke="#9341fb" />}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#3b9ef6]" />
                Unique Users per Day
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {loading ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={data?.uniqueUsersPerDay ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b9ef6" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#3b9ef6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: colors.axis }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={shortDate}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="uniqueUsers"
                      stroke="#3b9ef6"
                      strokeWidth={2}
                      fill="url(#usersGrad)"
                      dot={<AreaDot stroke="#3b9ef6" />}
                      activeDot={<AreaActiveDot stroke="#3b9ef6" />}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top intents + Channel distribution */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Top Intents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : data?.topIntents.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={208}>
                  <BarChart data={data?.topIntents ?? []} layout="vertical" barSize={10}>
                    <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="intent"
                      tick={{ fontSize: 10, fill: colors.axis }}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                      tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + '…' : v}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid }} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {(data?.topIntents ?? []).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Channel Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : data?.channelDistribution.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={208}>
                  <PieChart>
                    <Pie
                      data={data?.channelDistribution ?? []}
                      dataKey="count"
                      nameKey="channel"
                      cx="50%"
                      cy="45%"
                      outerRadius={72}
                      innerRadius={36}
                      paddingAngle={3}
                    >
                      {(data?.channelDistribution ?? []).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const entry = payload[0]
                        return (
                          <div className="rounded-lg border bg-card px-3 py-2 shadow-xl text-xs">
                            <p className="font-semibold" style={{ color: entry.payload.fill }}>{entry.name}</p>
                            <p className="text-muted-foreground">{Number(entry.value).toLocaleString()} sessions</p>
                          </div>
                        )
                      }}
                    />
                    <Legend
                      iconSize={8}
                      iconType="circle"
                      formatter={(value) => <span style={{ fontSize: 11, color: colors.axis }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Execution time + Intent score */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Avg Execution Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={data?.avgExecutionTime ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ae1a1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6ae1a1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} tickFormatter={shortDate} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v.toLocaleString()} ms`} />} />
                    <Area type="monotone" dataKey="avgMs" stroke="#6ae1a1" strokeWidth={2} fill="url(#tealGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                NLU Confidence Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <BarChart data={data?.intentScoreDistribution ?? []} barSize={20}>
                    <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: colors.axis }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {(data?.intentScoreDistribution ?? []).map((_, i) => (
                        <Cell key={i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Flows */}
        {!loading && (data?.topFlows.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                Top Flows by Execution Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(160, data!.topFlows.length * 28)}>
                <BarChart data={data!.topFlows} layout="vertical" barSize={10}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b9ef6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3b9ef6" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="flowName"
                    tick={{ fontSize: 10, fill: colors.axis }}
                    tickLine={false}
                    axisLine={false}
                    width={140}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid }} />
                  <Bar dataKey="count" fill="url(#blueGrad)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Agent Evaluation */}
        {!loading && data?.agentEvaluation && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#9341fb]" />
              <h2 className="text-sm font-semibold">Agent Evaluation</h2>
              <span className="text-xs text-muted-foreground">
                {data.agentEvaluation.totalRuns.toLocaleString()} test run{data.agentEvaluation.totalRuns !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KPICard
                title="Overall Pass Rate"
                value={`${data.agentEvaluation.overallPassRate}%`}
                subtitle="across all criteria"
                color={passRateColor(data.agentEvaluation.overallPassRate)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <KPICard
                title="Test Runs"
                value={data.agentEvaluation.totalRuns.toLocaleString()}
                subtitle="simulator sessions evaluated"
                color="#9341fb"
                icon={<FlaskConical className="h-4 w-4" />}
              />
              <KPICard
                title="Criteria Checked"
                value={data.agentEvaluation.criteria.length}
                subtitle="unique evaluation criteria"
                color="#3b9ef6"
                icon={<Activity className="h-4 w-4" />}
              />
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#9341fb]" />
                  Criteria Pass Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.agentEvaluation.criteria.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground/80 truncate pr-4">{c.name}</span>
                        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: passRateColor(c.passRate) }}>
                          {c.passRate}% <span className="text-muted-foreground font-normal">({c.passed}/{c.total})</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${c.passRate}%`, backgroundColor: passRateColor(c.passRate) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Goals */}
        {!loading && (data?.summary.totalGoalEvents ?? 0) > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#f5c842]" />
              <h2 className="text-sm font-semibold">Goals</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#f5c842]" />
                    Top Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={192}>
                    <BarChart data={data!.goalsSummary.topGoals} layout="vertical" barSize={10}>
                      <defs>
                        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f5c842" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#f5c842" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: colors.axis }}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                        tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + '…' : v}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid }} />
                      <Bar dataKey="count" fill="url(#goldGrad)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#f5c842]" />
                    Goal Events by Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={192}>
                    <AreaChart data={data!.goalsSummary.goalEventsByDay} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f5c842" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f5c842" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} tickFormatter={shortDate} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="events" stroke="#f5c842" strokeWidth={2} fill="url(#goldAreaGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
