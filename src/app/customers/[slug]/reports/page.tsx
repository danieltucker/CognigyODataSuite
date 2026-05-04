import { Suspense } from 'react'
import { ReportsPanel } from '@/components/reports/reports-panel'

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <Suspense>
      <ReportsPanel slug={slug} />
    </Suspense>
  )
}
