'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EntityCard } from './entity-card'
import { RefreshCw, Database } from 'lucide-react'
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

  const totalRecords = statuses.reduce((sum, s) => sum + s.recordCount, 0)
  const syncedCount = statuses.filter((s) => s.updated_at).length

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{displayName}</h1>
            <p className="text-xs text-muted-foreground">
              {syncedCount} of {statuses.length} entities synced
              {totalRecords > 0 && ` · ${totalRecords.toLocaleString()} total records`}
            </p>
          </div>
        </div>
        <Button onClick={handleSyncAll} disabled={syncingAll} size="sm" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Syncing…' : 'Sync All'}
        </Button>
      </div>

      {/* Entity grid */}
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
