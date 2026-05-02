'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Table2 } from 'lucide-react'
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

  async function handlePull() {
    setSyncing(true)
    try {
      await fetch(`/api/customers/${slug}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: status.entity_name }),
      })
      // Poll until the job is no longer running
      await pollUntilDone(slug, status.entity_name)
      onSyncComplete()
    } finally {
      setSyncing(false)
    }
  }

  const badge = statusBadge(syncing ? 'running' : status.lastJobStatus, status.updated_at)

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{ENTITY_LABELS[status.entity_name]}</p>
          <Badge variant={badge.variant} className="shrink-0 text-[11px]">{badge.label}</Badge>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">
            {formatCount(status.recordCount)}
          </span>
          <span className="text-xs text-muted-foreground">records</span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {status.updated_at ? formatRelativeTime(status.updated_at) : 'Never'}
          </p>
          <div className="flex items-center gap-1">
            {status.recordCount > 0 && (
              <Link href={`/customers/${slug}/data/${status.entity_name}`}>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" tabIndex={-1}>
                  <Table2 className="h-3 w-3" />
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handlePull}
              disabled={syncing}
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing' : 'Pull'}
            </Button>
          </div>
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
