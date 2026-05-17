import type { Express, Request, Response } from 'express'
import express from 'express'
import type Stripe from 'stripe'
import { getStripe, getStripeConfig } from '../services/stripe'
import { getSupabase } from '../services/supabase'

type Plan = 'monthly' | 'lifetime'

async function ensureCustomer(
  stripe: Stripe,
  userId: string,
): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id, username')
    .eq('id', userId)
    .maybeSingle()
  if (!prof) return null

  if (prof.stripe_customer_id) return prof.stripe_customer_id

  const customer = await stripe.customers.create({
    metadata: { userId },
    name: prof.username ?? undefined,
  })
  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)
  return customer.id
}

async function applyCheckoutCompletion(session: Stripe.Checkout.Session): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const userId =
    (session.metadata?.userId as string | undefined) ??
    (typeof session.client_reference_id === 'string' ? session.client_reference_id : null)
  if (!userId) {
    console.error('checkout.session.completed without userId metadata', session.id)
    return
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

  const now = new Date().toISOString()
  let premiumUntil: string | null = null

  if (session.mode === 'subscription' && typeof session.subscription === 'string') {
    const stripe = getStripe()
    if (stripe) {
      const sub = await stripe.subscriptions.retrieve(session.subscription)
      premiumUntil = new Date(sub.current_period_end * 1000).toISOString()
    }
  } else if (session.mode === 'payment') {
    // Lifetime: no expiry.
    premiumUntil = null
  }

  await supabase
    .from('profiles')
    .update({
      is_premium: true,
      premium_since: now,
      premium_until: premiumUntil,
      stripe_customer_id: customerId,
    })
    .eq('id', userId)
}

async function applySubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, premium_until')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (!prof) return

  const active = sub.status === 'active' || sub.status === 'trialing'
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  // Lifetime customers may also have a subscription history; never overwrite
  // their NULL premium_until (which means "forever") with a period end.
  const keepLifetime = prof.premium_until === null && active

  await supabase
    .from('profiles')
    .update({
      is_premium: active,
      premium_until: keepLifetime ? null : active ? periodEnd : null,
    })
    .eq('id', prof.id)
}

/**
 * The webhook handler MUST receive the raw request body for signature
 * verification, so it has its own express.raw middleware and must be
 * mounted BEFORE app.use(express.json()).
 */
export function registerStripeWebhook(app: Express, frontendUrl: string): void {
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const stripe = getStripe()
      const cfg = getStripeConfig(frontendUrl)
      if (!stripe || !cfg) return res.status(503).json({ error: 'stripe_not_configured' })

      const sig = req.headers['stripe-signature']
      if (!sig || Array.isArray(sig)) return res.status(400).json({ error: 'no_signature' })

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, cfg.webhookSecret)
      } catch (err) {
        console.error('stripe webhook signature failed', err)
        return res.status(400).json({ error: 'bad_signature' })
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed':
            await applyCheckoutCompletion(event.data.object as Stripe.Checkout.Session)
            break
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            await applySubscriptionChange(event.data.object as Stripe.Subscription)
            break
          default:
            break
        }
        res.json({ received: true })
      } catch (err) {
        console.error('stripe webhook handler error', err)
        res.status(500).json({ error: 'handler_failed' })
      }
    },
  )

}

/**
 * Checkout + portal routes. These read JSON bodies, so they must be
 * mounted AFTER app.use(express.json()) — otherwise req.body is undefined
 * and every request 400s with userId_required.
 */
export function registerBillingApi(app: Express, frontendUrl: string): void {
  app.post('/api/billing/checkout', async (req: Request, res: Response) => {
    const stripe = getStripe()
    const cfg = getStripeConfig(frontendUrl)
    if (!stripe || !cfg) return res.status(503).json({ error: 'stripe_not_configured' })

    const userId = String(req.body?.userId ?? '')
    const plan = req.body?.plan as Plan | undefined
    if (!userId) return res.status(400).json({ error: 'userId_required' })
    if (plan !== 'monthly' && plan !== 'lifetime') {
      return res.status(400).json({ error: 'plan_required' })
    }

    const customerId = await ensureCustomer(stripe, userId)
    if (!customerId) return res.status(404).json({ error: 'profile_not_found' })

    const isSub = plan === 'monthly'
    const session = await stripe.checkout.sessions.create({
      mode: isSub ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [
        {
          price: isSub ? cfg.priceMonthly : cfg.priceLifetime,
          quantity: 1,
        },
      ],
      success_url: cfg.successUrl,
      cancel_url: cfg.cancelUrl,
      client_reference_id: userId,
      metadata: { userId, plan },
      allow_promotion_codes: true,
    })

    res.json({ url: session.url })
  })

  app.post('/api/billing/portal', async (req: Request, res: Response) => {
    const stripe = getStripe()
    const cfg = getStripeConfig(frontendUrl)
    if (!stripe || !cfg) return res.status(503).json({ error: 'stripe_not_configured' })

    const userId = String(req.body?.userId ?? '')
    if (!userId) return res.status(400).json({ error: 'userId_required' })

    const customerId = await ensureCustomer(stripe, userId)
    if (!customerId) return res.status(404).json({ error: 'profile_not_found' })

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/premium`,
    })

    res.json({ url: session.url })
  })
}
