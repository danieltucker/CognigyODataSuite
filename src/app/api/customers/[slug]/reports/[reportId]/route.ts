import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getCustomer } from '@/lib/customers'
import type { ReportConfig } from '../route'

function reportsPath(slug: string): string {
  return path.join(process.cwd(), 'data', 'customers', slug, 'reports.json')
}

function loadReports(slug: string): ReportConfig[] {
  const p = reportsPath(slug)
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return [] }
}

function saveReports(slug: string, reports: ReportConfig[]): void {
  const p = reportsPath(slug)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(reports, null, 2))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; reportId: string }> }
) {
  const { slug, reportId } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reports = loadReports(slug)
  const idx = reports.findIndex((r) => r.id === reportId)
  if (idx === -1) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const body = await req.json()
  const updated: ReportConfig = {
    ...reports[idx],
    name: body.name ?? reports[idx].name,
    entity: body.entity ?? reports[idx].entity,
    columns: body.columns ?? reports[idx].columns,
    filters: {
      endpoints: body.filters?.endpoints ?? reports[idx].filters.endpoints,
      snapshots: body.filters?.snapshots ?? reports[idx].filters.snapshots,
      channel: body.filters?.channel ?? reports[idx].filters.channel,
    },
    windowType: body.windowType ?? reports[idx].windowType,
    windowDays: body.windowDays ?? reports[idx].windowDays,
    updatedAt: new Date().toISOString(),
  }

  reports[idx] = updated
  saveReports(slug, reports)
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; reportId: string }> }
) {
  const { slug, reportId } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reports = loadReports(slug)
  const filtered = reports.filter((r) => r.id !== reportId)
  saveReports(slug, filtered)
  return NextResponse.json({ ok: true })
}
