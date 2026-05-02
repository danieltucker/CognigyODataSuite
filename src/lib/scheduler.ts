import cron, { type ScheduledTask } from 'node-cron'
import { listCustomers } from './customers'
import { importAllEntities } from './importer'

declare global {
  // eslint-disable-next-line no-var
  var __schedulerStarted: boolean | undefined
  // eslint-disable-next-line no-var
  var __cronJobs: Map<string, ScheduledTask> | undefined
}

const jobs: Map<string, ScheduledTask> = globalThis.__cronJobs ?? new Map()
globalThis.__cronJobs = jobs

function intervalToCron(hours: number): string {
  if (hours <= 0) return '0 */1 * * *'
  if (hours === 1) return '0 * * * *'
  return `0 */${hours} * * *`
}

function scheduleCustomer(slug: string, intervalHours: number): void {
  const existing = jobs.get(slug)
  if (existing) existing.stop()

  const expression = intervalToCron(intervalHours)
  const task = cron.schedule(expression, async () => {
    console.log(`[scheduler] ${slug}: starting sync`)
    try {
      const results = await importAllEntities(slug)
      const failed = results.filter((r) => r.status === 'failed').length
      console.log(
        `[scheduler] ${slug}: done — ${results.length - failed}/${results.length} entities synced`
      )
    } catch (err) {
      console.error(`[scheduler] ${slug}: sync error`, err)
    }
  })

  jobs.set(slug, task)
  console.log(`[scheduler] ${slug}: scheduled every ${intervalHours}h (${expression})`)
}

export async function startScheduler(): Promise<void> {
  if (globalThis.__schedulerStarted) return
  globalThis.__schedulerStarted = true

  const customers = listCustomers()
  for (const customer of customers) {
    scheduleCustomer(customer.slug, customer.syncIntervalHours ?? 4)
  }
  console.log(`[scheduler] started — ${customers.length} customer(s) scheduled`)
}

export function stopScheduler(): void {
  for (const task of jobs.values()) task.stop()
  jobs.clear()
  globalThis.__schedulerStarted = false
}

export function updateSchedule(slug: string, intervalHours: number): void {
  scheduleCustomer(slug, intervalHours)
}

export function addToSchedule(slug: string, intervalHours: number): void {
  scheduleCustomer(slug, intervalHours)
}

export function removeFromSchedule(slug: string): void {
  const task = jobs.get(slug)
  if (task) {
    task.stop()
    jobs.delete(slug)
  }
}
