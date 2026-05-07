'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { AddCustomerSheet } from '@/components/customers/add-customer-sheet'
import { EditCustomerSheet } from '@/components/customers/edit-customer-sheet'
import { customerColor, formatRelativeTime } from '@/lib/utils'
import {
  Plus, Database, LayoutDashboard, Table2, Settings,
  Sun, Moon, Monitor, Menu, MessageSquareText, FileSpreadsheet, FlaskConical,
} from 'lucide-react'
import type { CustomerRecord } from '@/lib/customers'

type ThemeOption = 'light' | 'dark' | 'system'

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const options: { value: ThemeOption; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="h-3.5 w-3.5" />, label: 'Auto' },
  ]

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {options.map(({ value, icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] transition-colors ${
            (theme === value || (value === 'system' && !['light', 'dark'].includes(theme ?? '')))
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

interface SidebarContentProps {
  customers: CustomerRecord[]
  pathname: string
  onNavigate?: () => void
  onEdit: (c: CustomerRecord) => void
  onAdd: () => void
}

function SidebarContent({ customers, pathname, onNavigate, onEdit, onAdd }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15">
          <Database className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold tracking-tight text-sm">OData Suite</span>
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
          const isAgentEvals = pathname.startsWith(`/customers/${c.slug}/agent-evaluations`)
          const isEntities =
            pathname.startsWith(`/customers/${c.slug}/entities`) ||
            pathname.startsWith(`/customers/${c.slug}/data`)
          const isTranscripts = pathname.startsWith(`/customers/${c.slug}/transcripts`)
          const isReports = pathname.startsWith(`/customers/${c.slug}/reports`)
          const lastSync = c.lastSyncedAt
            ? `Synced ${formatRelativeTime(c.lastSyncedAt).toLowerCase()}`
            : 'Never synced'

          return (
            <div key={c.slug}>
              <div className={`group flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent/60 ${
                isActive ? 'bg-accent/40' : ''
              }`}>
                <Link
                  href={`/customers/${c.slug}/dashboard`}
                  className="flex flex-1 min-w-0 items-center gap-2.5"
                  onClick={onNavigate}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="flex min-w-0 flex-col">
                    <span className={`truncate leading-tight text-sm ${isActive ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                      {c.displayName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{lastSync}</span>
                  </div>
                </Link>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(c) }}
                  className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                  title="Edit customer"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>

              {isActive && (
                <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
                  {/* Analytics group */}
                  <Link
                    href={`/customers/${c.slug}/dashboard`}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent/60 hover:text-accent-foreground ${
                      isDashboard ? 'bg-accent/50 text-accent-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <LayoutDashboard className="h-3 w-3" />
                    Dashboard
                  </Link>
                  <Link
                    href={`/customers/${c.slug}/agent-evaluations`}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent/60 hover:text-accent-foreground ${
                      isAgentEvals ? 'bg-accent/50 text-accent-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <FlaskConical className="h-3 w-3" />
                    Agent Evaluations
                  </Link>
                  <Link
                    href={`/customers/${c.slug}/transcripts`}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent/60 hover:text-accent-foreground ${
                      isTranscripts ? 'bg-accent/50 text-accent-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <MessageSquareText className="h-3 w-3" />
                    Transcripts
                  </Link>
                  <Link
                    href={`/customers/${c.slug}/reports`}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent/60 hover:text-accent-foreground ${
                      isReports ? 'bg-accent/50 text-accent-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                    Reports
                  </Link>

                  {/* Divider before admin items */}
                  <div className="mx-3 my-1 border-t border-border/40" />

                  {/* Admin group — visually lighter */}
                  <Link
                    href={`/customers/${c.slug}/entities`}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent/60 hover:text-accent-foreground ${
                      isEntities ? 'bg-accent/50 text-accent-foreground font-medium' : 'text-muted-foreground/60 hover:text-muted-foreground'
                    }`}
                  >
                    <Table2 className="h-3 w-3" />
                    Sync Status
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="flex flex-col gap-2 p-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
        <a
          href="https://github.com/danieltucker/CognigyODataSuite"
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors pb-1"
        >
          v0.8.0
        </a>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<CustomerRecord | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function loadCustomers() {
    const res = await fetch('/api/customers')
    if (res.ok) setCustomers(await res.json())
  }

  useEffect(() => { loadCustomers() }, [])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function onCreated() {
    await loadCustomers()
    const res = await fetch('/api/customers')
    if (res.ok) {
      const list: CustomerRecord[] = await res.json()
      if (list.length > 0) router.push(`/customers/${list[list.length - 1].slug}/dashboard`)
    }
  }

  async function onUpdated() { await loadCustomers() }
  async function onDeleted() { await loadCustomers(); router.push('/') }

  function cycleTheme() {
    const order: ThemeOption[] = ['light', 'dark', 'system']
    const current = (resolvedTheme === 'dark' ? 'dark' : 'light') as ThemeOption
    const idx = order.indexOf(current)
    setTheme(order[(idx + 1) % order.length])
  }

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun

  const contentProps: SidebarContentProps = {
    customers,
    pathname,
    onNavigate: () => setMobileOpen(false),
    onEdit: setEditCustomer,
    onAdd: () => setAddOpen(true),
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15">
            <Database className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">OData Suite</span>
        </div>
        {mounted && (
          <button
            onClick={cycleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r bg-card">
        <SidebarContent {...contentProps} onNavigate={undefined} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent {...contentProps} />
        </SheetContent>
      </Sheet>

      <AddCustomerSheet open={addOpen} onOpenChange={setAddOpen} onCreated={onCreated} />
      <EditCustomerSheet
        customer={editCustomer}
        open={!!editCustomer}
        onOpenChange={(v) => { if (!v) setEditCustomer(null) }}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    </>
  )
}
