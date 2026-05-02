'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type TestResult = { ok: true; recordCount: number } | { ok: false; error: string } | null

export function AddCustomerSheet({ open, onOpenChange, onCreated }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [odataUrl, setOdataUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [syncIntervalHours, setSyncIntervalHours] = useState('4')
  const [testResult, setTestResult] = useState<TestResult>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setDisplayName('')
    setOdataUrl('')
    setApiKey('')
    setSyncIntervalHours('4')
    setTestResult(null)
    setError(null)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/customers/__test__/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odataUrl, apiKey }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, error: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!displayName || !odataUrl || !apiKey) {
      setError('All fields are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, odataUrl, apiKey, syncIntervalHours: Number(syncIntervalHours) }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to save')
        return
      }
      reset()
      onOpenChange(false)
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Customer</SheetTitle>
          <SheetDescription>
            Connect to a Cognigy OData endpoint. Data is stored locally on this machine.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Customer Name</Label>
            <Input
              id="displayName"
              placeholder="Acme Corp"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="odataUrl">OData URL</Label>
            <Input
              id="odataUrl"
              placeholder="https://odata-acme.cognigy.ai"
              value={odataUrl}
              onChange={(e) => setOdataUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Your Cognigy API key"
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

          {testResult && (
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              testResult.ok
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {testResult.ok ? (
                <>
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Connected — {testResult.recordCount.toLocaleString()} analytics records found
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 shrink-0" />
                  {testResult.error}
                </>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !odataUrl || !apiKey}
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Customer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
