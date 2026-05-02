'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart,
  DonutChart,
  LineChart,
  Card,
  Title,
  Text,
  Metric,
  Flex,
  BadgeDelta,
  Grid,
  Col,
} from '@tremor/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import type { DashboardData } from '@/app/api/customers/[slug]/dashboard/route'

interface Props {
  slug: string
  displayName: string
}

const CHART_COLORS = ['blue', 'violet', 'cyan', 'amber', 'emerald', 'rose', 'indigo', 'orange']

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

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams({
        ...(from && { from }),
        ...(to && { to }),
      })
      const res = await fetch(`/api/customers/${slug}/dashboard?${p}`)
      if (!res.ok) throw new Error(`Failed to load dashboard: ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug, from, to])

  useEffect(() => { fetchData() }, [fetchData])

  const escalationPct = data
    ? pct(data.escalationRate.escalated, data.escalationRate.total)
    : '—'

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <Link href={`/customers/${slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Overview
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-medium">{displayName} — Dashboard</h1>

        <div className="ml-auto flex items-center gap-2">
          <Input type="date" className="h-8 w-36 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="date" className="h-8 w-36 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" size="sm" className="h-8" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary KPI row */}
        <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
          <Card decoration="top" decorationColor="blue">
            <Text>Total Sessions</Text>
            <Metric>{data ? data.summary.totalSessions.toLocaleString() : '—'}</Metric>
          </Card>
          <Card decoration="top" decorationColor="violet">
            <Text>Conversations</Text>
            <Metric>{data ? data.summary.totalConversations.toLocaleString() : '—'}</Metric>
          </Card>
          <Card decoration="top" decorationColor="rose">
            <Flex justifyContent="between" alignItems="start">
              <div>
                <Text>Escalations</Text>
                <Metric>{data ? data.summary.totalEscalations.toLocaleString() : '—'}</Metric>
              </div>
              {data && data.escalationRate.total > 0 && (
                <BadgeDelta deltaType="increase">{escalationPct}</BadgeDelta>
              )}
            </Flex>
            <Text className="mt-1 text-tremor-label">
              {data ? `${data.escalationRate.escalated.toLocaleString()} of ${data.escalationRate.total.toLocaleString()} sessions` : ''}
            </Text>
          </Card>
          <Card decoration="top" decorationColor="emerald">
            <Text>Avg Intent Score</Text>
            <Metric>
              {data?.summary.avgIntentScore != null
                ? (data.summary.avgIntentScore * 100).toFixed(1) + '%'
                : '—'}
            </Metric>
          </Card>
        </Grid>

        {/* Session volume */}
        <Card>
          <Title>Session Volume by Day</Title>
          <Text>Analytics interactions per calendar day</Text>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <BarChart
              className="mt-4 h-48"
              data={data?.sessionVolume ?? []}
              index="date"
              categories={['sessions']}
              colors={['blue']}
              showLegend={false}
              showAnimation
            />
          )}
        </Card>

        {/* Intents + Channels */}
        <Grid numItemsMd={2} className="gap-4">
          <Card>
            <Title>Top Intents</Title>
            <Text>Most triggered intents in this period</Text>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <BarChart
                className="mt-4 h-52"
                data={data?.topIntents ?? []}
                index="intent"
                categories={['count']}
                colors={['violet']}
                layout="vertical"
                showLegend={false}
                showAnimation
              />
            )}
          </Card>

          <Card>
            <Title>Channel Distribution</Title>
            <Text>Sessions split by channel</Text>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <DonutChart
                className="mt-4 h-52"
                data={data?.channelDistribution ?? []}
                index="channel"
                category="count"
                colors={CHART_COLORS}
                showAnimation
                showLabel
              />
            )}
          </Card>
        </Grid>

        {/* Execution time + Intent score distribution */}
        <Grid numItemsMd={2} className="gap-4">
          <Card>
            <Title>Avg Execution Time</Title>
            <Text>Average response time (ms) per day</Text>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <LineChart
                className="mt-4 h-48"
                data={data?.avgExecutionTime ?? []}
                index="date"
                categories={['avgMs']}
                colors={['cyan']}
                showLegend={false}
                showAnimation
                valueFormatter={(v) => `${v.toLocaleString()} ms`}
              />
            )}
          </Card>

          <Card>
            <Title>Intent Score Distribution</Title>
            <Text>How confident was the NLU model?</Text>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <BarChart
                className="mt-4 h-48"
                data={data?.intentScoreDistribution ?? []}
                index="bucket"
                categories={['count']}
                colors={['emerald']}
                showLegend={false}
                showAnimation
              />
            )}
          </Card>
        </Grid>
      </div>
    </div>
  )
}
