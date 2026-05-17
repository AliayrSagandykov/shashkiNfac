const BASE = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001') as string

export type Plan = 'monthly' | 'lifetime'

export async function startCheckout(userId: string, plan: Plan): Promise<string | null> {
  const res = await fetch(`${BASE}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, plan }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.url as string) ?? null
}

export async function openCustomerPortal(userId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/billing/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.url as string) ?? null
}
