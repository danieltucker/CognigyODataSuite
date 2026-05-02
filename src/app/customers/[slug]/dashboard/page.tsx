import { notFound } from 'next/navigation'
import { getCustomer } from '@/lib/customers'
import { Dashboard } from '@/components/dashboard/dashboard'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const customer = getCustomer(slug)
  if (!customer) notFound()

  return <Dashboard slug={slug} displayName={customer.displayName} />
}
