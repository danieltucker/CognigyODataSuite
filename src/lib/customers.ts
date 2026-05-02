import path from 'path'
import fs from 'fs'
import { slugify } from './utils'

export interface CustomerRecord {
  slug: string
  displayName: string
  odataUrl: string
  apiKey: string
  syncIntervalHours: number
  createdAt: string
  lastSyncedAt: string | null
  color?: string
}

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'customers.json')

function ensureRegistry(): void {
  const dir = path.dirname(REGISTRY_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(REGISTRY_PATH)) fs.writeFileSync(REGISTRY_PATH, '[]', 'utf-8')
}

export function listCustomers(): CustomerRecord[] {
  ensureRegistry()
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as CustomerRecord[]
}

export function getCustomer(slug: string): CustomerRecord | null {
  return listCustomers().find((c) => c.slug === slug) ?? null
}

export function createCustomer(
  data: Omit<CustomerRecord, 'slug' | 'createdAt' | 'lastSyncedAt'>
): CustomerRecord {
  const customers = listCustomers()
  let slug = slugify(data.displayName)
  // Ensure unique slug
  let attempt = 0
  while (customers.some((c) => c.slug === (attempt === 0 ? slug : `${slug}-${attempt}`))) {
    attempt++
  }
  if (attempt > 0) slug = `${slug}-${attempt}`

  const record: CustomerRecord = {
    ...data,
    slug,
    createdAt: new Date().toISOString(),
    lastSyncedAt: null,
  }
  customers.push(record)
  saveRegistry(customers)
  return record
}

export function updateCustomer(
  slug: string,
  data: Partial<Omit<CustomerRecord, 'slug' | 'createdAt'>>
): CustomerRecord | null {
  const customers = listCustomers()
  const idx = customers.findIndex((c) => c.slug === slug)
  if (idx === -1) return null
  customers[idx] = { ...customers[idx], ...data }
  saveRegistry(customers)
  return customers[idx]
}

export function deleteCustomer(slug: string): boolean {
  const customers = listCustomers()
  const next = customers.filter((c) => c.slug !== slug)
  if (next.length === customers.length) return false
  saveRegistry(next)
  return true
}

function saveRegistry(customers: CustomerRecord[]): void {
  ensureRegistry()
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(customers, null, 2), 'utf-8')
}
