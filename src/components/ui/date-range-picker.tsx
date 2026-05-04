'use client'

import { useRef, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Preset helpers
// ---------------------------------------------------------------------------

type Preset = 'today' | '7d' | '30d' | '3m'

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function presetDates(preset: Preset): { from: string; to: string } {
  const today = new Date()
  const to = isoDate(today)
  if (preset === 'today') return { from: to, to }
  const d = new Date(today)
  if (preset === '7d') d.setDate(d.getDate() - 6)
  else if (preset === '30d') d.setDate(d.getDate() - 29)
  else if (preset === '3m') d.setMonth(d.getMonth() - 3)
  return { from: isoDate(d), to }
}

function activePreset(from: string, to: string): Preset | null {
  for (const p of ['today', '7d', '30d', '3m'] as Preset[]) {
    const { from: pf, to: pt } = presetDates(p)
    if (from === pf && to === pt) return p
  }
  return null
}

function rangeLabel(from: string, to: string): string {
  if (!from && !to) return 'All time'
  const preset = activePreset(from, to)
  if (preset === 'today') return 'Today'
  if (preset === '7d') return 'Last 7 days'
  if (preset === '30d') return 'Last 30 days'
  if (preset === '3m') return 'Last 3 months'
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (from && to) return `${fmt(from)} – ${fmt(to)}`
  if (from) return `From ${fmt(from)}`
  return `Until ${fmt(to)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  className?: string
}

export function DateRangePicker({ from, to, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = isoDate(new Date())
  const current = activePreset(from, to)
  const hasRange = from || to

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function selectPreset(preset: Preset) {
    const { from: f, to: t } = presetDates(preset)
    onChange(f, t)
    setOpen(false)
  }

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: '3m', label: '3 months' },
  ]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring',
          hasRange && 'border-primary/50',
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={cn('whitespace-nowrap', !hasRange && 'text-muted-foreground')}>
          {rangeLabel(from, to)}
        </span>
        {hasRange ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange('', ''); setOpen(false) }}
            className="ml-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <ChevronDown className={cn('h-3.5 w-3.5 opacity-50 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 rounded-lg border bg-popover text-popover-foreground shadow-lg p-3 min-w-[220px]">
          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-1 mb-3">
            {PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors text-left',
                  current === key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="border-t border-border pt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-8 shrink-0">From</span>
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => onChange(e.target.value, to)}
                className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-8 shrink-0">To</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => onChange(from, e.target.value)}
                className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export helper so consumers can init to last-7-days
export function defaultDateRange(): { from: string; to: string } {
  return presetDates('7d')
}
