import { notFound } from 'next/navigation'
import { getCustomer } from '@/lib/customers'
import { TranscriptDetail } from '@/components/transcripts/transcript-detail'

export default async function TranscriptDetailPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>
}) {
  const { slug, sessionId } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()

  return <TranscriptDetail slug={slug} sessionId={sessionId} />
}
