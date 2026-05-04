'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RefreshCw, BarChart3, MessageSquare, GitBranch, Zap,
  Users, PhoneCall, Target, List, TrendingUp, Calendar,
  AlertTriangle, Clock,
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

const STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000 // 8 hours

interface EntityStatus {
  entity_name: EntityName
  last_imported_at: string | null
  updated_at: string | null
  recordCount: number
  lastJobStatus: string | null
  lastJobErrorMessage: string | null
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

function isStale(updatedAt: string | null, syncMode: string): boolean {
  if (!updatedAt || syncMode === 'full_refresh') return false
  return Date.now() - new Date(updatedAt).getTime() > STALE_THRESHOLD_MS
}

export function EntityCard({ status, slug, onSyncComplete }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [showError, setShowError] = useState(false)

  async function handlePull(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSyncing(true)
    setShowError(false)
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

  const currentStatus = syncing ? 'running' : status.lastJobStatus
  const badge = statusBadge(currentStatus, status.updated_at)
  const color = ENTITY_COLORS[status.entity_name]
  const stale = isStale(status.updated_at, status.sync_mode)
  const hasFailed = currentStatus === 'failed' && status.lastJobErrorMessage
  const updatedText = status.updated_at
    ? `Updated ${formatRelativeTime(status.updated_at).toLowerCase()}`
    : 'Never synced'

  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 group cursor-pointer">
      <Link
        href={`/customers/${slug}/data/${status.entity_name}`}
        className="absolute inset-0 z-[1]"
        aria-label={`Explore ${ENTITY_LABELS[status.entity_name]} data`}
      />

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
          <div className="flex items-center gap-1.5 shrink-0 relative z-[2]">
            {stale && !hasFailed && (
              <span title="Data may be stale — no sync in over 8 hours">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
              </span>
            )}
            <Badge variant={badge.variant} className="text-[11px]">
              {badge.label}
            </Badge>
          </div>
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
          <div className="flex items-center gap-1 relative z-[2]">
            {hasFailed && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowError((v) => !v) }}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 text-destructive transition-colors"
                title="View error details"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
              onClick={handlePull}
              disabled={syncing}
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''} mr-1`} />
              {syncing ? 'Syncing' : 'Pull'}
            </Button>
          </div>
        </div>

        {/* Error detail — expanded inline */}
        {showError && hasFailed && (
          <div
            className="relative z-[2] mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-[11px] text-destructive leading-relaxed"
            onClick={(e) => e.preventDefault()}
          >
            {status.lastJobErrorMessage}
          </div>
        )}
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
