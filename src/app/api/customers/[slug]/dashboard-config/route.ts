import { NextRequest, NextResponse } from 'next/server'
import { getCustomer } from '@/lib/customers'
import { getDashboardConfig, saveDashboardConfig, CARD_REGISTRY } from '@/lib/dashboard-config'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(getDashboardConfig(slug))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!Array.isArray(body.kpiCards) || !Array.isArray(body.chartCards)) {
    return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 })
  }

  const validIds = new Set(CARD_REGISTRY.map((c) => c.id))
  const kpiCards   = (body.kpiCards   as unknown[]).filter((id): id is string => typeof id === 'string' && validIds.has(id))
  const chartCards = (body.chartCards as unknown[]).filter((id): id is string => typeof id === 'string' && validIds.has(id))

  saveDashboardConfig(slug, { version: 1, kpiCards, chartCards })
  return NextResponse.json({ ok: true })
}
