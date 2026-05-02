'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Download, Search, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { EntityName } from '@/db/schema'
import { ENTITY_COLS } from '@/lib/entity-columns'
import { formatCellValue } from '@/lib/format-cell'
import { RecordDetailSheet } from '@/components/data/record-detail-sheet'

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

const FILTERABLE_COLS = ['channel', 'endpointName', 'snapshotName'] as const
type FilterableCol = (typeof FILTERABLE_COLS)[number]

const FILTER_LABELS: Record<FilterableCol, string> = {
  channel: 'Channel',
  endpointName: 'Endpoint',
  snapshotName: 'Snapshot',
}

interface DataResponse {
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Props {
  slug: string
  entity: EntityName
}

export function DataExplorer({ slug, entity }: Props) {
  const config = ENTITY_COLS[entity]
  const today = new Date().toISOString().split('T')[0]
  const router = useRouter()

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState(config.dateCol ?? config.cols[0]?.key ?? 'id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(
    Object.fromEntries(config.cols.map((c) => [c.key, c.defaultVisible]))
  )
  const [showColPanel, setShowColPanel] = useState(false)
  const colPanelRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Column filters
  const [columnFilters, setColumnFilters] = useState<Partial<Record<FilterableCol, string>>>({})
  const [filterValues, setFilterValues] = useState<Partial<Record<FilterableCol, string[]>>>({})

  // Record detail
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Close column panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPanelRef.current && !colPanelRef.current.contains(e.target as Node)) {
        setShowColPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset when entity changes
  useEffect(() => {
    const cfg = ENTITY_COLS[entity]
    setSortBy(cfg.dateCol ?? cfg.cols[0]?.key ?? 'id')
    setSortDir('desc')
    setPage(1)
    setSearch('')
    setSearchInput('')
    setFrom('')
    setTo('')
    setColVisibility(Object.fromEntries(cfg.cols.map((c) => [c.key, c.defaultVisible])))
    setColumnFilters({})
    setFilterValues({})
  }, [entity])

  // Fetch filter values
  useEffect(() => {
    async function fetchFilterValues() {
      try {
        const res = await fetch(`/api/customers/${slug}/data/${entity}/filter-values`)
        if (res.ok) {
          const data: Partial<Record<FilterableCol, string[]>> = await res.json()
          setFilterValues(data)
        }
      } catch {
        // non-critical
      }
    }
    fetchFilterValues()
  }, [slug, entity])

  function handleSearchChange(val: string) {
    setSearchInput(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 400)
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
        ...(search && { search }),
        ...(from && { from }),
        ...(to && { to }),
      })
      for (const col of FILTERABLE_COLS) {
        const val = columnFilters[col]
        if (val) p.set(`filter_${col}`, val)
      }
      const res = await fetch(`/api/customers/${slug}/data/${entity}?${p}`)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data: DataResponse = await res.json()
      setRows(data.rows)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [slug, entity, page, pageSize, search, sortBy, sortDir, from, to, columnFilters])

  useEffect(() => { fetchData() }, [fetchData])

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  function handleExport(format: 'csv' | 'xlsx') {
    const p = new URLSearchParams({
      format,
      sortBy,
      sortDir,
      ...(search && { search }),
      ...(from && { from }),
      ...(to && { to }),
    })
    for (const col of FILTERABLE_COLS) {
      const val = columnFilters[col]
      if (val) p.set(`filter_${col}`, val)
    }
    window.location.href = `/api/customers/${slug}/data/${entity}/export?${p}`
  }

  function handleRowClick(row: Record<string, unknown>) {
    setDetailRow(row)
    setDetailOpen(true)
  }

  function setFilter(col: FilterableCol, val: string) {
    setColumnFilters((prev) => ({ ...prev, [col]: val === '__all__' ? undefined : val }))
    setPage(1)
  }

  const visibleCols = config.cols.filter((c) => colVisibility[c.key] !== false)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  // Which filterable cols exist in this entity AND have values
  const activeFilters = FILTERABLE_COLS.filter(
    (col) => filterValues[col] && filterValues[col]!.length > 0
  )

  return (
    <div className="flex flex-col min-h-full">
      {/* Header / Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back</span>
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
        <h1 className="text-sm font-medium">{ENTITY_LABELS[entity]}</h1>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {total.toLocaleString()} records
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 w-56 text-sm"
              placeholder={`Search ${config.searchCols.slice(0, 2).join(', ')}…`}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Date range */}
          {config.dateCol && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className="h-8 w-36 text-sm"
                value={from}
                max={today}
                onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                className="h-8 w-36 text-sm"
                value={to}
                max={today}
                onChange={(e) => { setTo(e.target.value); setPage(1) }}
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Column visibility */}
            <div className="relative" ref={colPanelRef}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowColPanel((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Columns
              </Button>
              {showColPanel && (
                <div className="absolute right-0 top-10 z-50 w-52 rounded-md border bg-popover shadow-lg p-2 max-h-80 overflow-y-auto">
                  <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Visible columns
                  </p>
                  {config.cols.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-muted rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={colVisibility[col.key] !== false}
                        onChange={(e) =>
                          setColVisibility((v) => ({ ...v, [col.key]: e.target.checked }))
                        }
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Exports */}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('csv')}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('xlsx')}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Excel
            </Button>
          </div>
        </div>

        {/* Column filters row — only shown when there are filterable columns */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilters.map((col) => (
              <Select
                key={col}
                value={columnFilters[col] ?? '__all__'}
                onValueChange={(v) => setFilter(col, v)}
              >
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue placeholder={`All ${FILTER_LABELS[col]}s`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All {FILTER_LABELS[col]}s</SelectItem>
                  {filterValues[col]!.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            {activeFilters.some((col) => columnFilters[col]) && (
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setColumnFilters({}); setPage(1) }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60">
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none border-b transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortBy === col.key ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-primary" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-20" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-3 py-12 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-3 py-12 text-center text-destructive">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-3 py-12 text-center text-muted-foreground">
                  No records found
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(row)}
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-1.5 max-w-[200px] truncate text-xs"
                      title={row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : ''}
                    >
                      {formatCellValue(row[col.key], col.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t text-xs mt-auto shrink-0">
        <span className="text-muted-foreground">
          {total === 0 ? '0 records' : `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(1)}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-3 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <RecordDetailSheet
        row={detailRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        columns={config.cols}
        title={ENTITY_LABELS[entity]}
      />
    </div>
  )
}
