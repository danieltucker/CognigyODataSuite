import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getCustomer } from '@/lib/customers'

export interface ReportConfig {
  id: string
  name: string
  entity: string
  columns: string[]
  filters: {
    endpoints: string[]
    snapshots: string[]
    channel: string
  }
  windowType: string
  windowDays: number
  createdAt: string
  updatedAt: string
}

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

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(loadReports(slug))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const now = new Date().toISOString()
  const report: ReportConfig = {
    id: nanoid(),
    name: body.name ?? 'Untitled Report',
    entity: body.entity ?? 'analytics',
    columns: body.columns ?? [],
    filters: {
      endpoints: body.filters?.endpoints ?? [],
      snapshots: body.filters?.snapshots ?? [],
      channel: body.filters?.channel ?? '',
    },
    windowType: body.windowType ?? 'weekly-sun',
    windowDays: body.windowDays ?? 7,
    createdAt: now,
    updatedAt: now,
  }

  const reports = loadReports(slug)
  reports.push(report)
  saveReports(slug, reports)
  return NextResponse.json(report, { status: 201 })
}
