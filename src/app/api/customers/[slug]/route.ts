import { NextRequest, NextResponse } from 'next/server'
import { getCustomer, updateCustomer, deleteCustomer, type CustomerRecord } from '@/lib/customers'
import { updateSchedule, removeFromSchedule } from '@/lib/scheduler'

function redact({ apiKey: _, ...rest }: CustomerRecord) {
  return { ...rest, apiKeySet: true }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(redact(customer))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { displayName, odataUrl, apiKey, syncIntervalHours, initialSyncDays, color } = body

  if (odataUrl && !odataUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'odataUrl must use HTTPS' }, { status: 400 })
  }

  const updated = updateCustomer(slug, {
    ...(displayName && { displayName }),
    ...(odataUrl && { odataUrl: odataUrl.replace(/\/$/, '') }),
    ...(apiKey && { apiKey }),
    ...(syncIntervalHours && { syncIntervalHours }),
    ...(initialSyncDays && { initialSyncDays }),
    ...(color !== undefined && { color }),
  })

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (syncIntervalHours) updateSchedule(slug, syncIntervalHours)

  return NextResponse.json(redact(updated))
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const deleted = deleteCustomer(slug)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  removeFromSchedule(slug)
  const { closeDb } = await import('@/db/client')
  closeDb(slug)

  return NextResponse.json({ ok: true })
}
