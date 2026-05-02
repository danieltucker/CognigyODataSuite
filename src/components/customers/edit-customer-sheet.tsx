'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'

interface CustomerForEdit {
  slug: string
  displayName: string
  odataUrl: string
  syncIntervalHours: number
}

interface Props {
  customer: CustomerForEdit | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  onDeleted: () => void
}

export function EditCustomerSheet({ customer, open, onOpenChange, onUpdated, onDeleted }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [odataUrl, setOdataUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [syncIntervalHours, setSyncIntervalHours] = useState('4')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customer) {
      setDisplayName(customer.displayName)
      setOdataUrl(customer.odataUrl)
      setApiKey('')
      setSyncIntervalHours(String(customer.syncIntervalHours ?? 4))
      setConfirmDelete(false)
      setError(null)
    }
  }, [customer])

  async function handleSave() {
    if (!displayName || !odataUrl) {
      setError('Name and OData URL are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        displayName,
        odataUrl,
        syncIntervalHours: Number(syncIntervalHours),
      }
      if (apiKey) body.apiKey = apiKey

      const res = await fetch(`/api/customers/${customer!.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to save')
        return
      }
      onOpenChange(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/customers/${customer!.slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to delete')
        return
      }
      onOpenChange(false)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) setConfirmDelete(false); onOpenChange(v) }}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Customer</SheetTitle>
          <SheetDescription>
            Update connection details for {customer?.displayName ?? 'this customer'}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-displayName">Customer Name</Label>
            <Input
              id="edit-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-odataUrl">OData URL</Label>
            <Input
              id="edit-odataUrl"
              value={odataUrl}
              onChange={(e) => setOdataUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-apiKey">API Key</Label>
            <Input
              id="edit-apiKey"
              type="password"
              placeholder="Leave blank to keep current key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Sync Interval</Label>
            <Select value={syncIntervalHours} onValueChange={setSyncIntervalHours}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every hour</SelectItem>
                <SelectItem value="2">Every 2 hours</SelectItem>
                <SelectItem value="4">Every 4 hours</SelectItem>
                <SelectItem value="8">Every 8 hours</SelectItem>
                <SelectItem value="24">Every 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>

          <Separator className="my-1" />

          {!confirmDelete ? (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              Delete Customer
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                The customer will be removed. Local data files are kept.
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
