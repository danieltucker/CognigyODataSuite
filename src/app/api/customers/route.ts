import { NextRequest, NextResponse } from 'next/server'
import { listCustomers, createCustomer, type CustomerRecord } from '@/lib/customers'
import { addToSchedule } from '@/lib/scheduler'

// Never return apiKey over the wire — the UI has no need to read it back
function redact({ apiKey: _, ...rest }: CustomerRecord) {
  return { ...rest, apiKeySet: true }
}

export async function GET() {
  return NextResponse.json(listCustomers().map(redact))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { displayName, odataUrl, apiKey, syncIntervalHours, initialSyncDays, color } = body

  if (!displayName || !odataUrl || !apiKey) {
    return NextResponse.json({ error: 'displayName, odataUrl, and apiKey are required' }, { status: 400 })
  }

  if (!odataUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'odataUrl must use HTTPS' }, { status: 400 })
  }

  const customer = createCustomer({
    displayName,
    odataUrl: odataUrl.replace(/\/$/, ''),
    apiKey,
    syncIntervalHours: syncIntervalHours ?? 4,
    initialSyncDays: initialSyncDays ?? 365,
    color,
  })

  // Pre-create the DB so it's ready on first visit
  const { getDb } = await import('@/db/client')
  await getDb(customer.slug)

  addToSchedule(customer.slug, customer.syncIntervalHours)

  return NextResponse.json(redact(customer), { status: 201 })
}
