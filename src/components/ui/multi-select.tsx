'use client'

import { useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  className?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MultiSelect({
  options, value, onChange, placeholder, className, open, onOpenChange,
}: MultiSelectProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onOpenChange])

  function toggle(option: string) {
    onChange(
      value.includes(option) ? value.filter((v) => v !== option) : [...value, option]
    )
  }

  const label =
    value.length === 0 ? placeholder
    : value.length === 1 ? value[0]
    : `${value.length} selected`

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring',
          value.length > 0 && 'border-primary/50 text-foreground',
        )}
      >
        <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>
          {label}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[280px] max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No options available</p>
          ) : (
            options.map((option) => {
              const selected = value.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    selected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="break-all">{option}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
