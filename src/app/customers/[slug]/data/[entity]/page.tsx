import { notFound } from 'next/navigation'
import { getCustomer } from '@/lib/customers'
import { ALL_ENTITIES, type EntityName } from '@/db/schema'
import { DataExplorer } from '@/components/data/data-explorer'

export default async function DataPage({
  params,
}: {
  params: Promise<{ slug: string; entity: string }>
}) {
  const { slug, entity } = await params

  if (!getCustomer(slug)) notFound()
  if (!ALL_ENTITIES.includes(entity as EntityName)) notFound()

  return <DataExplorer slug={slug} entity={entity as EntityName} />
}
