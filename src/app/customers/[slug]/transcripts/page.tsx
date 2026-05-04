import { notFound } from 'next/navigation'
import { getCustomer } from '@/lib/customers'
import { TranscriptList } from '@/components/transcripts/transcript-list'

export default async function TranscriptsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()

  return <TranscriptList slug={slug} />
}
