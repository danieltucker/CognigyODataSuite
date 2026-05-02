'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCellValue } from '@/lib/format-cell'
import type { ColDef } from '@/lib/entity-columns'

interface Props {
  row: Record<string, unknown> | null
  open: boolean
  onOpenChange: (v: boolean) => void
  columns: ColDef[]
  title: string
}

export function RecordDetailSheet({ row, open, onOpenChange, columns, title }: Props) {
  if (!row) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[560px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-sm font-semibold">{title} — Record Detail</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-0.5">
            {columns.map((col) => {
              const val = row[col.key]
              const isEmpty = val === null || val === undefined || val === ''
              return (
                <div
                  key={col.key}
                  className="grid grid-cols-[10rem_1fr] gap-3 py-2 border-b border-border/40 last:border-0"
                >
                  <span className="text-[11px] font-medium text-muted-foreground self-start pt-0.5 truncate">
                    {col.label}
                  </span>
                  <span className={`text-xs break-all font-mono leading-relaxed ${isEmpty ? 'text-muted-foreground/40 italic' : ''}`}>
                    {isEmpty ? 'empty' : formatCellValue(val, col.type)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
