'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AddCustomerSheet } from '@/components/customers/add-customer-sheet'
import { customerColor, formatRelativeTime } from '@/lib/utils'
import { Plus, Database, LayoutDashboard, Table2 } from 'lucide-react'
import type { CustomerRecord } from '@/lib/customers'

export function Sidebar() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function loadCustomers() {
    const res = await fetch('/api/customers')
    if (res.ok) setCustomers(await res.json())
  }

  useEffect(() => { loadCustomers() }, [])

  async function onCreated() {
    await loadCustomers()
    // Navigate to the newest customer
    const res = await fetch('/api/customers')
    if (res.ok) {
      const list: CustomerRecord[] = await res.json()
      if (list.length > 0) router.push(`/customers/${list[list.length - 1].slug}`)
    }
  }

  return (
    <>
      <aside className="flex h-screen w-64 flex-col border-r bg-card">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">OData Suite</span>
        </div>

        <Separator />

        {/* Customer list */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {customers.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              No customers yet.<br />Add one below.
            </p>
          )}
          {customers.map((c) => {
            const isActive = pathname.startsWith(`/customers/${c.slug}`)
            const color = customerColor(c.slug, c.color)
            const isDashboard = pathname === `/customers/${c.slug}/dashboard`
            const isOverview = isActive && !isDashboard
            return (
              <div key={c.slug}>
                {/* Customer row */}
                <Link
                  href={`/customers/${c.slug}`}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    isOverview ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground/80'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate leading-tight">{c.displayName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {c.lastSyncedAt ? formatRelativeTime(c.lastSyncedAt) : 'Never synced'}
                    </span>
                  </div>
                </Link>

                {/* Sub-nav when customer is active */}
                {isActive && (
                  <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
                    <Link
                      href={`/customers/${c.slug}/dashboard`}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                        isDashboard ? 'bg-accent/60 text-accent-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      Dashboard
                    </Link>
                    <Link
                      href={`/customers/${c.slug}`}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                        isOverview ? 'bg-accent/60 text-accent-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      <Table2 className="h-3 w-3" />
                      Entities
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <Separator />

        {/* Add customer */}
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-muted-foreground"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </aside>

      <AddCustomerSheet open={sheetOpen} onOpenChange={setSheetOpen} onCreated={onCreated} />
    </>
  )
}
