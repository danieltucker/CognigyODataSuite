import { NextRequest, NextResponse } from 'next/server'
import { getCustomer } from '@/lib/customers'
import { importEntity, importAllEntities } from '@/lib/importer'
import { ALL_ENTITIES, type EntityName } from '@/db/schema'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!getCustomer(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const entityName = body?.entity as EntityName | undefined
  const full = Boolean(body?.full)

  if (entityName && !ALL_ENTITIES.includes(entityName)) {
    return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 })
  }

  const jobId = crypto.randomUUID()

  // Fire and forget — client polls /import/jobs for status
  if (entityName) {
    importEntity(slug, entityName, { full, jobId }).catch(console.error)
  } else {
    importAllEntities(slug).catch(console.error)
  }

  return NextResponse.json({ jobId, entity: entityName ?? 'all', started: true })
}
