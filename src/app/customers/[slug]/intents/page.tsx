import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getCustomer } from '@/lib/customers'
import { Intents } from '@/components/intents/intents'

export default async function IntentsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()

  return (
    <Suspense>
      <Intents slug={slug} displayName={customer.displayName} />
    </Suspense>
  )
}
