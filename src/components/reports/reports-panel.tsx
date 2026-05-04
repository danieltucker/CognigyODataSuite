'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, FileSpreadsheet,
  Download, Mail, FileDown, Clock, Trash2, Copy,
  Pencil, Check, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { MultiSelect } from '@/components/ui/multi-select'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WindowType = 'weekly-sun' | 'weekly-mon' | 'monthly' | 'custom'
export type EntityName = 'analytics' | 'sessions' | 'conversations' | 'goal_events' | 'executed_steps'

export interface ReportConfig {
  id: string
  name: string
  entity: EntityName
  columns: string[]
  filters: {
    endpoints: string[]
    snapshots: string[]
    channel: string
  }
  windowType: WindowType
  windowDays: number
  createdAt: string
  updatedAt: string
}

interface ReportRow {
  [key: string]: string | number | null
}

interface ReportData {
  rows: ReportRow[]
  total: number
  columns: string[]
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getWindowBounds(windowType: WindowType, windowDays: number, anchor: Date): { start: Date; end: Date } {
  const d = new Date(anchor)
  if (windowType === 'weekly-sun') {
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (windowType === 'weekly-mon') {
    const day = d.getDay()
    const diff = (day + 6) % 7
    const start = new Date(d)
    start.setDate(d.getDate() - diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (windowType === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start, end }
  }
  // custom
  const start = new Date(d)
  const end = new Date(d)
  end.setDate(start.getDate() + windowDays - 1)
  return { start, end }
}

function stepWindow(windowType: WindowType, windowDays: number, anchor: Date, direction: -1 | 1): Date {
  const next = new Date(anchor)
  if (windowType === 'weekly-sun' || windowType === 'weekly-mon') {
    next.setDate(anchor.getDate() + direction * 7)
  } else if (windowType === 'monthly') {
    next.setMonth(anchor.getMonth() + direction)
  } else {
    next.setDate(anchor.getDate() + direction * windowDays)
  }
  return next
}

function formatWindowLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

// ---------------------------------------------------------------------------
// Entity column definitions (display names)
// ---------------------------------------------------------------------------

const ENTITY_COLUMNS: Record<EntityName, string[]> = {
  analytics: [
    'sessionId', 'contactId', 'timestamp', 'intent', 'intentFlow', 'intentScore',
    'channel', 'endpointName', 'snapshotName', 'inputText', 'state', 'mode',
    'userType', 'executionTime', 'projectId', 'organisation', 'flowReferenceId',
    'localeName', 'rating', 'ratingComment',
    'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
    'custom6', 'custom7', 'custom8', 'custom9', 'custom10',
  ],
  sessions: [
    'sessionId', 'userId', 'startedAt', 'endpointName', 'snapshotName',
    'handoverEscalations', 'stepsCount', 'rating', 'ratingComment',
    'projectId', 'projectName', 'localeName',
  ],
  conversations: [
    'sessionId', 'contactId', 'timestamp', 'type', 'source', 'inputText',
    'flowName', 'channel', 'endpointName', 'snapshotName',
    'inHandoverRequest', 'inHandoverConversation', 'projectId',
  ],
  goal_events: [
    'id', 'sessionId', 'goalId', 'timestamp', 'goalCycleId', 'stepId',
    'projectId', 'channel', 'endpointName', 'snapshotName', 'localeName',
  ],
  executed_steps: [
    'sessionId', 'userId', 'timestamp', 'flowName', 'flowReferenceId',
    'stepLabel', 'type', 'entityReferenceId', 'projectId', 'endpointName', 'snapshotName',
  ],
}

const ENTITY_LABELS: Record<EntityName, string> = {
  analytics: 'Analytics',
  sessions: 'Sessions',
  conversations: 'Conversations',
  goal_events: 'Goal Events',
  executed_steps: 'Executed Steps',
}

const WINDOW_LABELS: Record<WindowType, string> = {
  'weekly-sun': 'Weekly (Sun–Sun)',
  'weekly-mon': 'Weekly (Mon–Mon)',
  monthly: 'Monthly',
  custom: 'Custom days',
}

// ---------------------------------------------------------------------------
// TimeWindowNavigator
// ---------------------------------------------------------------------------

function TimeWindowNavigator({
  windowType,
  windowDays,
  anchor,
  onWindowTypeChange,
  onWindowDaysChange,
  onAnchorChange,
}: {
  windowType: WindowType
  windowDays: number
  anchor: Date
  onWindowTypeChange: (v: WindowType) => void
  onWindowDaysChange: (v: number) => void
  onAnchorChange: (d: Date) => void
}) {
  const today = new Date()
  const { start, end } = getWindowBounds(windowType, windowDays, anchor)

  const prevAnchor = stepWindow(windowType, windowDays, anchor, -1)
  const nextAnchor = stepWindow(windowType, windowDays, anchor, 1)
  const { start: nextStart } = getWindowBounds(windowType, windowDays, nextAnchor)
  const canGoNext = nextStart <= today

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      {/* Window type selector */}
      <div className="flex items-center gap-2 shrink-0">
        <Select value={windowType} onValueChange={(v) => onWindowTypeChange(v as WindowType)}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly-sun">Weekly (Sun–Sun)</SelectItem>
            <SelectItem value="weekly-mon">Weekly (Mon–Mon)</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="custom">Custom days</SelectItem>
          </SelectContent>
        </Select>
        {windowType === 'custom' && (
          <Input
            type="number"
            min={1}
            max={365}
            value={windowDays}
            onChange={(e) => onWindowDaysChange(Math.max(1, parseInt(e.target.value) || 7))}
            className="h-8 w-16 text-xs text-center"
          />
        )}
      </div>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      {/* Navigator */}
      <div className="flex flex-1 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onAnchorChange(prevAnchor)}
          title="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 text-center">
          <p className="text-sm font-semibold tabular-nums leading-none">
            {formatWindowLabel(start, end)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isoDate(start)} → {isoDate(end)}
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onAnchorChange(nextAnchor)}
          disabled={!canGoNext}
          title="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saved report list item
// ---------------------------------------------------------------------------

function ReportListItem({
  report,
  isActive,
  onClick,
}: {
  report: ReportConfig
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight truncate">{report.name}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
          {ENTITY_LABELS[report.entity]}
        </Badge>
      </div>
      <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="truncate">{WINDOW_LABELS[report.windowType]}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 py-24 text-center px-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <FileSpreadsheet className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold">No report selected</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
          Create a new report to start filtering and exporting data with a repeating time window
        </p>
      </div>
      <Button onClick={onNew} className="gap-2">
        <Plus className="h-4 w-4" />
        New Report
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline editable report name
// ---------------------------------------------------------------------------

function EditableName({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
          className="h-8 text-sm font-medium max-w-[280px]"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={commit}>
          <Check className="h-3.5 w-3.5 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDraft(value); setEditing(false) }}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="group flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 hover:bg-accent transition-colors"
      title="Click to rename"
    >
      <span className="text-sm font-semibold">{value}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Preview table
// ---------------------------------------------------------------------------

function PreviewTable({
  columns,
  rows,
  total,
  loading,
}: {
  columns: string[]
  rows: ReportRow[]
  total: number
  loading: boolean
}) {
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
        Select at least one column to preview data
      </div>
    )
  }

  return (
    <div className={cn('w-full transition-opacity', loading && 'opacity-40')}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background border-b z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                No data for this window
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-accent/30 transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2 font-mono text-[11px] text-foreground/80 whitespace-nowrap max-w-[200px] truncate">
                  {row[col] === null || row[col] === undefined ? (
                    <span className="text-muted-foreground/40">—</span>
                  ) : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Reports Panel
// ---------------------------------------------------------------------------

export function ReportsPanel({ slug }: { slug: string }) {
  // Saved reports state
  const [savedReports, setSavedReports] = useState<ReportConfig[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Active report config (working state — not yet saved)
  const [name, setName] = useState('Untitled Report')
  const [entity, setEntity] = useState<EntityName>('analytics')
  const [columns, setColumns] = useState<string[]>([])
  const [filterEndpoints, setFilterEndpoints] = useState<string[]>([])
  const [filterSnapshots, setFilterSnapshots] = useState<string[]>([])
  const [filterChannel, setFilterChannel] = useState('')
  const [windowType, setWindowType] = useState<WindowType>('weekly-sun')
  const [windowDays, setWindowDays] = useState(7)
  const [anchor, setAnchor] = useState<Date>(new Date())

  // Multi-select open state
  const [colOpen, setColOpen] = useState(false)
  const [endpointOpen, setEndpointOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)

  // Available filter options (loaded from API)
  const [availableEndpoints, setAvailableEndpoints] = useState<string[]>([])
  const [availableSnapshots, setAvailableSnapshots] = useState<string[]>([])

  // Preview data
  const [previewData, setPreviewData] = useState<ReportData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const hasActiveReport = activeId !== null || isDirty

  // Memoised so that start/end are stable object references between renders.
  // anchor.getTime() converts the Date to a primitive, preventing useCallback
  // from seeing a new reference on every render and causing infinite refetches.
  const { start, end } = useMemo(
    () => getWindowBounds(windowType, windowDays, anchor),
    [windowType, windowDays, anchor.getTime()] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Load saved reports + available filter options on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${slug}/reports`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/customers/${slug}/dashboard`).then((r) => r.ok ? r.json() : {} as Record<string, unknown>),
    ]).then(([reports, dashData]: [ReportConfig[], Record<string, unknown>]) => {
      setSavedReports(reports)
      if (Array.isArray(dashData.availableEndpoints)) setAvailableEndpoints(dashData.availableEndpoints as string[])
      if (Array.isArray(dashData.availableSnapshots)) setAvailableSnapshots(dashData.availableSnapshots as string[])
    })
  }, [slug])

  // Reset columns when entity changes
  useEffect(() => {
    setColumns([])
  }, [entity])

  function loadReport(report: ReportConfig) {
    setActiveId(report.id)
    setName(report.name)
    setEntity(report.entity)
    setColumns(report.columns)
    setFilterEndpoints(report.filters.endpoints)
    setFilterSnapshots(report.filters.snapshots)
    setFilterChannel(report.filters.channel)
    setWindowType(report.windowType)
    setWindowDays(report.windowDays)
    setAnchor(new Date())
    setPreviewData(null)
    setIsDirty(false)
  }

  function createNew() {
    setActiveId(null)
    setName('Untitled Report')
    setEntity('analytics')
    setColumns([])
    setFilterEndpoints([])
    setFilterSnapshots([])
    setFilterChannel('')
    setWindowType('weekly-sun')
    setWindowDays(7)
    setAnchor(new Date())
    setPreviewData(null)
    setIsDirty(true)
  }

  async function saveReport() {
    const body = {
      name, entity, columns,
      filters: { endpoints: filterEndpoints, snapshots: filterSnapshots, channel: filterChannel },
      windowType, windowDays,
    }
    const res = activeId
      ? await fetch(`/api/customers/${slug}/reports/${activeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch(`/api/customers/${slug}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const saved: ReportConfig = await res.json()
      setSavedReports((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id)
        return idx >= 0 ? prev.map((r) => r.id === saved.id ? saved : r) : [...prev, saved]
      })
      setActiveId(saved.id)
      setIsDirty(false)
    }
  }

  async function deleteReport() {
    if (!activeId) { createNew(); return }
    await fetch(`/api/customers/${slug}/reports/${activeId}`, { method: 'DELETE' })
    setSavedReports((prev) => prev.filter((r) => r.id !== activeId))
    setActiveId(null)
    setIsDirty(false)
    setPreviewData(null)
  }

  // Single effect with AbortController so cleanup (React Strict Mode double-invoke,
  // rapid filter changes) cancels the in-flight request rather than racing.
  const startIso = isoDate(start)
  const endIso = isoDate(end)
  const endpointsKey = filterEndpoints.join(',')
  const snapshotsKey = filterSnapshots.join(',')
  const columnsKey = columns.join(',')

  useEffect(() => {
    if (!hasActiveReport || columns.length === 0) return
    const controller = new AbortController()
    let active = true

    setPreviewLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams({
          from: startIso,
          to: endIso,
          entity,
          columns: columnsKey,
          limit: '100',
        })
        filterEndpoints.forEach((e) => params.append('endpoint', e))
        filterSnapshots.forEach((s) => params.append('snapshot', s))
        if (filterChannel) params.set('channel', filterChannel)

        const res = await fetch(`/api/customers/${slug}/reports/preview?${params}`, {
          signal: controller.signal,
        })
        if (active && res.ok) setPreviewData(await res.json())
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('[preview]', err)
      } finally {
        if (active) setPreviewLoading(false)
      }
    })()

    return () => { active = false; controller.abort() }
  }, [slug, entity, columnsKey, startIso, endIso, endpointsKey, snapshotsKey, filterChannel, hasActiveReport]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportReport(format: 'xlsx' | 'csv') {
    const params = new URLSearchParams({
      from: isoDate(start),
      to: isoDate(end),
      entity,
      columns: columns.join(','),
      format,
    })
    filterEndpoints.forEach((e) => params.append('endpoint', e))
    filterSnapshots.forEach((s) => params.append('snapshot', s))
    if (filterChannel) params.set('channel', filterChannel)

    window.location.href = `/api/customers/${slug}/reports/export?${params}`
  }

  async function copyEmailSummary() {
    if (!previewData) return
    const total = previewData.total
    const windowLabel = formatWindowLabel(start, end)
    const lines = [
      `<b>Report: ${name}</b>`,
      `Period: ${windowLabel}`,
      `Total records: ${total.toLocaleString()}`,
      '',
      '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">',
      `<tr>${previewData.columns.map((c) => `<th style="background:#f5f5f5">${c}</th>`).join('')}</tr>`,
      ...previewData.rows.slice(0, 10).map(
        (row) => `<tr>${previewData.columns.map((c) => `<td>${row[c] ?? '—'}</td>`).join('')}</tr>`,
      ),
      '</table>',
      total > 10 ? `<i>…and ${(total - 10).toLocaleString()} more rows. Export XLS for full data.</i>` : '',
    ]
    const html = lines.join('\n')
    await navigator.clipboard.writeText(html).catch(() => {
      // Fallback: plain text
      navigator.clipboard.writeText(`${name}\n${windowLabel}\n${total} records`)
    })
  }

  const markDirty = () => setIsDirty(true)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ------------------------------------------------------------------ */}
      {/* Left panel — saved reports list                                      */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-56 shrink-0 border-r flex flex-col bg-card">
        <div className="p-3 border-b">
          <Button size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={createNew}>
            <Plus className="h-3.5 w-3.5" />
            New Report
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {savedReports.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-3 leading-relaxed">
              No saved reports yet
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {savedReports.map((r) => (
                <ReportListItem
                  key={r.id}
                  report={r}
                  isActive={activeId === r.id && !isDirty}
                  onClick={() => loadReport(r)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!hasActiveReport ? (
          <EmptyState onNew={createNew} />
        ) : (
          <>
            {/* Config header */}
            <div className="border-b p-4 flex flex-col gap-3 shrink-0">

              {/* Name row */}
              <div className="flex items-center gap-3">
                <EditableName value={name} onChange={(v) => { setName(v); markDirty() }} />
                <div className="ml-auto flex items-center gap-1.5">
                  {isDirty && (
                    <Button size="sm" className="h-7 px-3 text-xs gap-1.5" onClick={saveReport}>
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </Button>
                  )}
                  {activeId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground gap-1.5"
                      onClick={deleteReport}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Entity + columns + filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={entity} onValueChange={(v) => { setEntity(v as EntityName); markDirty() }}>
                  <SelectTrigger className="h-8 w-40 text-xs shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_LABELS) as EntityName[]).map((e) => (
                      <SelectItem key={e} value={e}>{ENTITY_LABELS[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-6 shrink-0" />

                <MultiSelect
                  options={ENTITY_COLUMNS[entity]}
                  value={columns}
                  onChange={(v) => { setColumns(v); markDirty() }}
                  placeholder="Select columns…"
                  className="w-48 shrink-0"
                  open={colOpen}
                  onOpenChange={(o) => { setColOpen(o); if (o) { setEndpointOpen(false); setSnapshotOpen(false) } }}
                />

                <Separator orientation="vertical" className="h-6 shrink-0" />

                {availableEndpoints.length > 0 && (
                  <MultiSelect
                    options={availableEndpoints}
                    value={filterEndpoints}
                    onChange={(v) => { setFilterEndpoints(v); markDirty() }}
                    placeholder="All endpoints"
                    className="w-40 shrink-0"
                    open={endpointOpen}
                    onOpenChange={(o) => { setEndpointOpen(o); if (o) { setColOpen(false); setSnapshotOpen(false) } }}
                  />
                )}

                {availableSnapshots.length > 0 && (
                  <MultiSelect
                    options={availableSnapshots}
                    value={filterSnapshots}
                    onChange={(v) => { setFilterSnapshots(v); markDirty() }}
                    placeholder="All snapshots"
                    className="w-40 shrink-0"
                    open={snapshotOpen}
                    onOpenChange={(o) => { setSnapshotOpen(o); if (o) { setColOpen(false); setEndpointOpen(false) } }}
                  />
                )}
              </div>

              {/* Time window navigator — centrepiece */}
              <TimeWindowNavigator
                windowType={windowType}
                windowDays={windowDays}
                anchor={anchor}
                onWindowTypeChange={(v) => { setWindowType(v); markDirty() }}
                onWindowDaysChange={(v) => { setWindowDays(v); markDirty() }}
                onAnchorChange={setAnchor}
              />
            </div>

            {/* Export bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20 shrink-0">
              <span className="text-xs text-muted-foreground">
                {previewLoading ? (
                  'Loading…'
                ) : previewData ? (
                  <>
                    <span className="font-medium text-foreground">{previewData.total.toLocaleString()}</span>
                    {' '}rows in this window
                  </>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={columns.length === 0}
                  onClick={() => exportReport('xlsx')}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export XLS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={columns.length === 0}
                  onClick={() => exportReport('csv')}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                  disabled={!previewData}
                  onClick={copyEmailSummary}
                  title="Copies a formatted HTML table to clipboard"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Copy Email Summary
                </Button>
              </div>
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-auto">
              <PreviewTable
                columns={previewData?.columns ?? columns}
                rows={previewData?.rows ?? []}
                total={previewData?.total ?? 0}
                loading={previewLoading}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
