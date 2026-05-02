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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RefreshCw, Users, MessageSquare, PhoneCall, Brain,
  TrendingUp, BarChart3, Cpu, Activity, Target,
} from 'lucide-react'
import type { DashboardData } from '@/app/api/customers/[slug]/dashboard/route'

const PALETTE = ['#9341fb', '#6ae1a1', '#3b9ef6', '#f5c842', '#e6483d', '#14b8a6', '#f97316', '#ec4899']
const SCORE_COLORS = [
  '#e6483d', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#3b9ef6', '#9341fb',
]

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

interface KPICardProps {
  title: string
  value: string | number | null
  subtitle?: string
  color: string
  icon: React.ReactNode
}

function KPICard({ title, value, subtitle, color, icon }: KPICardProps) {
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

interface Props {
  slug: string
  displayName: string
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%'
  return ((a / b) * 100).toFixed(1) + '%'
}

export function Dashboard({ slug, displayName }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [channel, setChannel] = useState('all')
  const [endpoint, setEndpoint] = useState('all')
  const colors = useChartColors()

  const today = new Date().toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams({
        ...(from && { from }),
        ...(to && { to }),
        ...(channel !== 'all' && { channel }),
        ...(endpoint !== 'all' && { endpoint }),
      })
      const res = await fetch(`/api/customers/${slug}/dashboard?${p}`)
      if (!res.ok) throw new Error(`Failed to load dashboard: ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug, from, to, channel, endpoint])

  useEffect(() => { fetchData() }, [fetchData])

  const escalationPct = data ? pct(data.escalationRate.escalated, data.escalationRate.total) : null

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b shrink-0 bg-card/50">
        <div className="mr-auto">
          <h1 className="text-base font-semibold">{displayName}</h1>
          <p className="text-xs text-muted-foreground">Analytics Dashboard</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel filter */}
          {data?.availableChannels && data.availableChannels.length > 1 && (
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {data.availableChannels.map((ch) => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Endpoint filter */}
          {data?.availableEndpoints && data.availableEndpoints.length > 1 && (
            <Select value={endpoint} onValueChange={setEndpoint}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All endpoints" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All endpoints</SelectItem>
                {data.availableEndpoints.map((ep) => (
                  <SelectItem key={ep} value={ep}>{ep}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date range */}
          <Input
            type="date"
            className="h-8 w-36 text-xs font-mono"
            value={from}
            max={today}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs font-mono"
            value={to}
            max={today}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KPICard
            title="Sessions"
            value={data?.summary.totalSessions.toLocaleString() ?? null}
            color="#9341fb"
            icon={<Users className="h-4 w-4" />}
          />
          <KPICard
            title="Conversations"
            value={data?.summary.totalConversations.toLocaleString() ?? null}
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
            value={
              data?.summary.avgIntentScore != null
                ? (data.summary.avgIntentScore * 100).toFixed(1) + '%'
                : null
            }
            color="#6ae1a1"
            icon={<Brain className="h-4 w-4" />}
          />
          <KPICard
            title="Goal Events"
            value={data?.summary.totalGoalEvents.toLocaleString() ?? null}
            color="#f5c842"
            icon={<Target className="h-4 w-4" />}
          />
        </div>

        {/* Session volume */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Session Volume by Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <BarChart data={data?.sessionVolume ?? []} barSize={14}>
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9341fb" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#9341fb" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid }} />
                  <Bar dataKey="sessions" fill="url(#purpleGrad)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

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
                      formatter={(value) => (
                        <span style={{ fontSize: 11, color: colors.axis }}>{value}</span>
                      )}
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
                  <AreaChart data={data?.avgExecutionTime ?? []}>
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ae1a1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6ae1a1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} />
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

        {/* Goals section — only shown when there are goal events */}
        {(data?.summary.totalGoalEvents ?? 0) > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#f5c842]" />
              <h2 className="text-sm font-semibold">Goals</h2>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Top Goals */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#f5c842]" />
                    Top Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                    </div>
                  ) : !data?.goalsSummary.topGoals.length ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={192}>
                      <BarChart data={data.goalsSummary.topGoals} layout="vertical" barSize={10}>
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
                  )}
                </CardContent>
              </Card>

              {/* Goal Events by Day */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#f5c842]" />
                    Goal Events by Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={192}>
                      <AreaChart data={data?.goalsSummary.goalEventsByDay ?? []}>
                        <defs>
                          <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f5c842" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#f5c842" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: colors.axis }} tickLine={false} axisLine={false} width={40} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="events" stroke="#f5c842" strokeWidth={2} fill="url(#goldAreaGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
