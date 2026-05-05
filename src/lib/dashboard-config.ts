import fs from 'fs'
import path from 'path'
import { DEFAULT_CONFIG } from './dashboard-config-shared'
import type { DashboardConfig } from './dashboard-config-shared'

export type { DashboardConfig, CardDef } from './dashboard-config-shared'
export { CARD_REGISTRY, DEFAULT_CONFIG } from './dashboard-config-shared'

function configPath(slug: string): string {
  return path.join(process.cwd(), 'data', 'customers', slug, 'dashboard-config.json')
}

export function getDashboardConfig(slug: string): DashboardConfig {
  try {
    const raw = fs.readFileSync(configPath(slug), 'utf8')
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>
    if (!Array.isArray(parsed.kpiCards) || !Array.isArray(parsed.chartCards)) {
      return { ...DEFAULT_CONFIG }
    }
    return parsed as DashboardConfig
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveDashboardConfig(slug: string, config: DashboardConfig): void {
  const p = configPath(slug)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(config, null, 2))
}
