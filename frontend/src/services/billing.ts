const BASE = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001') as string

export type Plan = 'monthly' | 'lifetime'

export type BillingResult = { url: string } | { error: string }

async function callBilling(path: string, body: unknown): Promise<BillingResult> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    return { error: `network: ${e instanceof Error ? e.message : 'fetch failed'}` }
  }
  let parsed: { url?: string; error?: string } = {}
  try {
    parsed = await res.json()
  } catch {
    // empty / non-JSON body — fall through to status-based message.
  }
  if (!res.ok) {
    return { error: parsed.error ?? `http_${res.status}` }
  }
  if (!parsed.url) return { error: 'no_url' }
  return { url: parsed.url }
}

export function startCheckout(userId: string, plan: Plan): Promise<BillingResult> {
  return callBilling('/api/billing/checkout', { userId, plan })
}

export function openCustomerPortal(userId: string): Promise<BillingResult> {
  return callBilling('/api/billing/portal', { userId })
}
