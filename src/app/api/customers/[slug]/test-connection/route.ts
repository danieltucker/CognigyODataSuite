import { NextRequest, NextResponse } from 'next/server'
import ky, { HTTPError } from 'ky'
import { getCustomer } from '@/lib/customers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Allow testing with body payload (from add-customer form before save)
  const body = await req.json().catch(() => null)
  const odataUrl = body?.odataUrl ?? getCustomer(slug)?.odataUrl
  const apiKey = body?.apiKey ?? getCustomer(slug)?.apiKey

  if (!odataUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: 'Missing odataUrl or apiKey' }, { status: 400 })
  }

  try {
    const url = `${odataUrl.replace(/\/$/, '')}/Analytics?$top=1&$count=true`
    const data = await ky
      .get(url, { headers: { apikey: apiKey }, timeout: 15_000, retry: 0 })
      .json<{ '@odata.count'?: number; value: unknown[] }>()

    return NextResponse.json({
      ok: true,
      recordCount: data['@odata.count'] ?? data.value?.length ?? 0,
    })
  } catch (err) {
    let message = 'Connection failed'
    if (err instanceof HTTPError) {
      message = `HTTP ${err.response.status}: ${err.response.statusText}`
    } else if (err instanceof Error) {
      message = err.message
    }
    return NextResponse.json({ ok: false, error: message })
  }
}
