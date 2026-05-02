'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RefreshCw, BarChart3, MessageSquare, GitBranch, Zap,
  Users, PhoneCall, Target, List, TrendingUp, Calendar,
} from 'lucide-react'
import { formatRelativeTime, formatCount } from '@/lib/utils'
import type { EntityName } from '@/db/schema'

const ENTITY_LABELS: Record<EntityName, string> = {
  analytics: 'Analytics',
  conversations: 'Conversations',
  steps: 'Steps',
  executed_steps: 'Executed Steps',
  sessions: 'Sessions',
  live_agent_escalations: 'Escalations',
  goals: 'Goals',
  goal_steps: 'Goal Steps',
  goal_step_metrics: 'Goal Metrics',
  goal_events: 'Goal Events',
}

const ENTITY_ICONS: Record<EntityName, React.ReactNode> = {
  analytics: <BarChart3 className="h-4 w-4" />,
  conversations: <MessageSquare className="h-4 w-4" />,
  steps: <GitBranch className="h-4 w-4" />,
  executed_steps: <Zap className="h-4 w-4" />,
  sessions: <Users className="h-4 w-4" />,
  live_agent_escalations: <PhoneCall className="h-4 w-4" />,
  goals: <Target className="h-4 w-4" />,
  goal_steps: <List className="h-4 w-4" />,
  goal_step_metrics: <TrendingUp className="h-4 w-4" />,
  goal_events: <Calendar className="h-4 w-4" />,
}

const ENTITY_COLORS: Record<EntityName, string> = {
  analytics: '#9341fb',
  conversations: '#3b9ef6',
  steps: '#6ae1a1',
  executed_steps: '#f5c842',
  sessions: '#ec4899',
  live_agent_escalations: '#e6483d',
  goals: '#14b8a6',
  goal_steps: '#f97316',
  goal_step_metrics: '#84cc16',
  goal_events: '#a78bfa',
}

interface EntityStatus {
  entity_name: EntityName
  last_imported_at: string | null
  updated_at: string | null
  recordCount: number
  lastJobStatus: string | null
  sync_mode: string
}

interface Props {
  status: EntityStatus
  slug: string
  onSyncComplete: () => void
}

function statusBadge(jobStatus: string | null, updatedAt: string | null): {
  label: string
  variant: BadgeProps['variant']
} {
  if (jobStatus === 'running') return { label: 'Syncing…', variant: 'info' }
  if (jobStatus === 'failed') return { label: 'Failed', variant: 'destructive' }
  if (!updatedAt) return { label: 'Never synced', variant: 'outline' }
  return { label: 'Synced', variant: 'success' }
}

export function EntityCard({ status, slug, onSyncComplete }: Props) {
  const [syncing, setSyncing] = useState(false)

  async function handlePull(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSyncing(true)
    try {
      await fetch(`/api/customers/${slug}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: status.entity_name }),
      })
      await pollUntilDone(slug, status.entity_name)
      onSyncComplete()
    } finally {
      setSyncing(false)
    }
  }

  const badge = statusBadge(syncing ? 'running' : status.lastJobStatus, status.updated_at)
  const color = ENTITY_COLORS[status.entity_name]
  const updatedText = status.updated_at
    ? `Updated ${formatRelativeTime(status.updated_at).toLowerCase()}`
    : 'Never synced'

  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 group cursor-pointer">
      {/* Stretched link covers the whole card */}
      <Link
        href={`/customers/${slug}/data/${status.entity_name}`}
        className="absolute inset-0 z-[1]"
        aria-label={`Explore ${ENTITY_LABELS[status.entity_name]} data`}
      />

      {/* Top accent strip */}
      <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span style={{ color }} className="opacity-80">
              {ENTITY_ICONS[status.entity_name]}
            </span>
            <p className="text-sm font-semibold leading-tight">{ENTITY_LABELS[status.entity_name]}</p>
          </div>
          <Badge variant={badge.variant} className="shrink-0 text-[11px] relative z-[2]">
            {badge.label}
          </Badge>
        </div>

        {/* Record count */}
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>
            {formatCount(status.recordCount)}
          </span>
          <span className="text-xs text-muted-foreground">records</span>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{updatedText}</p>
          <Button
            size="sm"
            variant="ghost"
            className="relative z-[2] h-7 px-2 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
            onClick={handlePull}
            disabled={syncing}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing' : 'Pull'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

async function pollUntilDone(slug: string, entity: EntityName): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const res = await fetch(`/api/customers/${slug}/import/jobs`)
    if (!res.ok) break
    const jobs: Array<{ entity_name: string; status: string }> = await res.json()
    const latest = jobs.find((j) => j.entity_name === entity)
    if (!latest || latest.status === 'success' || latest.status === 'failed') break
  }
}
