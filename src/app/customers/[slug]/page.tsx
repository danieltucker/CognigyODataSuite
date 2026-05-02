import { redirect, notFound } from 'next/navigation'
import { getCustomer } from '@/lib/customers'

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()
  redirect(`/customers/${slug}/dashboard`)
}
