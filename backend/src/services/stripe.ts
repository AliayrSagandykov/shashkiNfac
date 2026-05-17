import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe | null {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  cached = new Stripe(key, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion })
  return cached
}

export interface StripeConfig {
  priceMonthly: string
  priceLifetime: string
  webhookSecret: string
  successUrl: string
  cancelUrl: string
}

export function getStripeConfig(frontendUrl: string): StripeConfig | null {
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY
  const priceLifetime = process.env.STRIPE_PRICE_LIFETIME
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!priceMonthly || !priceLifetime || !webhookSecret) return null
  return {
    priceMonthly,
    priceLifetime,
    webhookSecret,
    successUrl: `${frontendUrl}/premium?success=1`,
    cancelUrl: `${frontendUrl}/premium?canceled=1`,
  }
}
