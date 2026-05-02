import type { ColumnType } from './entity-columns'

export function formatCellValue(val: unknown, type: ColumnType): string {
  if (val === null || val === undefined || val === '') return '—'

  switch (type) {
    case 'timestamp': {
      const str = String(val)
      try {
        const d = new Date(str)
        if (!isNaN(d.getTime())) {
          return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
        }
      } catch { /* fall through */ }
      return str
    }
    case 'number':
      return typeof val === 'number'
        ? val.toLocaleString()
        : String(val)
    case 'boolean':
      return val ? 'Yes' : 'No'
    case 'json': {
      const str = String(val)
      try {
        const parsed = JSON.parse(str)
        if (Array.isArray(parsed)) return `[${parsed.length} item${parsed.length === 1 ? '' : 's'}]`
        if (parsed && typeof parsed === 'object') return `{${Object.keys(parsed).slice(0, 3).join(', ')}${Object.keys(parsed).length > 3 ? '…' : ''}}`
      } catch { /* fall through */ }
      return str.length > 60 ? str.slice(0, 60) + '…' : str
    }
    default: {
      const str = String(val)
      return str.length > 80 ? str.slice(0, 80) + '…' : str
    }
  }
}
