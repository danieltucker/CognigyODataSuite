import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getCustomer } from '@/lib/customers'
import { AgentEvaluations } from '@/components/agent-evaluations/agent-evaluations'

export default async function AgentEvaluationsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()

  return (
    <Suspense>
      <AgentEvaluations slug={slug} displayName={customer.displayName} />
    </Suspense>
  )
}
