import { listCustomers } from '@/lib/customers'
import { redirect } from 'next/navigation'
import { Database } from 'lucide-react'

export default function Home() {
  const customers = listCustomers()
  if (customers.length > 0) redirect(`/customers/${customers[0].slug}`)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <Database className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <h2 className="text-lg font-semibold">No customers yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a customer using the sidebar to get started.
        </p>
      </div>
    </div>
  )
}
