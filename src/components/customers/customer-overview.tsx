'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EntityCard } from './entity-card'
import { RefreshCw } from 'lucide-react'
import type { EntityName } from '@/db/schema'

interface EntityStatus {
  entity_name: EntityName
  last_imported_at: string | null
  updated_at: string | null
  recordCount: number
  lastJobStatus: string | null
  sync_mode: string
}

interface Props {
  slug: string
  displayName: string
  initialStatuses: EntityStatus[]
}

export function CustomerOverview({ slug, displayName, initialStatuses }: Props) {
  const [statuses, setStatuses] = useState<EntityStatus[]>(initialStatuses)
  const [syncingAll, setSyncingAll] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/customers/${slug}/import/state`)
    if (res.ok) setStatuses(await res.json())
  }, [slug])

  // Refresh when the component mounts fresh (navigating between customers)
  useEffect(() => {
    setStatuses(initialStatuses)
  }, [slug, initialStatuses])

  async function handleSyncAll() {
    setSyncingAll(true)
    try {
      await fetch(`/api/customers/${slug}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      // Poll every 3s until no jobs are running
      for (let i = 0; i < 180; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const res = await fetch(`/api/customers/${slug}/import/jobs`)
        if (!res.ok) break
        const jobs: Array<{ status: string }> = await res.json()
        const running = jobs.some((j) => j.status === 'running')
        await refresh()
        if (!running) break
      }
    } finally {
      setSyncingAll(false)
      await refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{displayName}</h1>
          <p className="text-sm text-muted-foreground">OData import status per entity</p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncingAll} size="sm">
          <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Syncing All…' : 'Sync All'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {statuses.map((s) => (
          <EntityCard
            key={s.entity_name}
            status={s}
            slug={slug}
            onSyncComplete={refresh}
          />
        ))}
      </div>
    </div>
  )
}
