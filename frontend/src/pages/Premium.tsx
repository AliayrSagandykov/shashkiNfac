import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { isPremiumActive } from '../services/profile'
import { startCheckout, openCustomerPortal, type Plan } from '../services/billing'

export default function Premium() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuthStore()
  const { profile, load } = useProfileStore()
  const [busy, setBusy] = useState<Plan | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const justPaid = params.get('success') === '1'
  const premium = isPremiumActive(profile)

  // After Stripe redirects back with ?success=1, the webhook may take a
  // moment to flip is_premium. Poll the profile a few times so the UI
  // reflects the upgrade without a hard reload.
  useEffect(() => {
    if (!justPaid || !user?.id || premium) return
    let cancelled = false
    let tries = 0
    const tick = async () => {
      tries++
      await load(user.id)
      if (cancelled) return
      const p = useProfileStore.getState().profile
      if (isPremiumActive(p)) return
      if (tries < 8) setTimeout(tick, 1500)
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [justPaid, user?.id, premium, load])

  const handleBuy = async (plan: Plan) => {
    if (!user?.id) {
      navigate('/login')
      return
    }
    setBusy(plan)
    setError(null)
    const url = await startCheckout(user.id, plan)
    setBusy(null)
    if (!url) {
      setError("Couldn't reach Stripe. Try again in a moment.")
      return
    }
    window.location.href = url
  }

  const handlePortal = async () => {
    if (!user?.id) return
    setBusy('portal')
    setError(null)
    const url = await openCustomerPortal(user.id)
    setBusy(null)
    if (!url) {
      setError("Couldn't open the billing portal.")
      return
    }
    window.location.href = url
  }

  return (
    <div className="min-h-screen bg-app flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 pt-16 lg:pt-8 pb-8">
          <div className="text-center mb-8">
            <div className="inline-block text-5xl mb-3">👑</div>
            <h1 className="text-fg text-3xl sm:text-4xl font-bold mb-2">Checkers Premium</h1>
            <p className="text-muted text-sm sm:text-base">
              Unlimited engine analysis, a golden frame on the leaderboard, and a
              premium badge on your profile.
            </p>
          </div>

          {justPaid && !premium && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 mb-6 text-center text-sm">
              <div className="text-fg font-semibold mb-1">Thanks for upgrading!</div>
              <div className="text-muted">Activating your premium… this only takes a few seconds.</div>
            </div>
          )}

          {premium && (
            <div className="bg-gradient-to-br from-yellow-500/20 to-amber-700/10 border border-yellow-500/50 rounded-2xl p-5 mb-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-yellow-300 text-sm font-semibold uppercase tracking-wide">
                    Active
                  </div>
                  <div className="text-fg text-xl font-bold mt-1">
                    {profile?.premium_until === null ? 'Lifetime Premium' : 'Monthly Premium'}
                  </div>
                  {profile?.premium_until && (
                    <div className="text-muted text-xs mt-1">
                      Renews / expires {new Date(profile.premium_until).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={handlePortal}
                  disabled={busy === 'portal'}
                  className="bg-elev hover:bg-hover disabled:opacity-50 text-fg text-sm px-4 py-2 rounded-lg"
                >
                  {busy === 'portal' ? '…' : 'Manage'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-red-200 text-sm">
              {error}
            </div>
          )}

          {!premium && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PlanCard
                title="Monthly"
                price="$4.99"
                cadence="/month"
                tagline="Try it out, cancel anytime."
                features={[
                  'Unlimited game analysis',
                  'Golden frame on the leaderboard',
                  'Premium badge on your profile',
                  'Priority queue (planned)',
                ]}
                ctaLabel={busy === 'monthly' ? 'Redirecting…' : 'Subscribe'}
                onClick={() => handleBuy('monthly')}
                disabled={busy !== null}
              />
              <PlanCard
                title="Lifetime"
                price="$39"
                cadence="one-time"
                tagline="Pay once, premium forever."
                highlight
                features={[
                  'Everything in Monthly',
                  'No recurring charges',
                  'Locked-in price',
                ]}
                ctaLabel={busy === 'lifetime' ? 'Redirecting…' : 'Get lifetime'}
                onClick={() => handleBuy('lifetime')}
                disabled={busy !== null}
              />
            </div>
          )}

          <div className="text-faint text-xs text-center mt-6">
            Free accounts get 1 engine analysis every 24 hours. Re-opening an
            already analysed game is always free.
          </div>
        </div>
      </main>
    </div>
  )
}

function PlanCard({
  title,
  price,
  cadence,
  tagline,
  features,
  ctaLabel,
  onClick,
  disabled,
  highlight,
}: {
  title: string
  price: string
  cadence: string
  tagline: string
  features: string[]
  ctaLabel: string
  onClick: () => void
  disabled: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-5 border ${
        highlight
          ? 'bg-gradient-to-br from-yellow-500/15 to-amber-700/5 border-yellow-500/40'
          : 'bg-card border-line'
      }`}
    >
      <div className="text-muted text-xs uppercase tracking-wide font-semibold">{title}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className="text-fg text-3xl font-bold">{price}</div>
        <div className="text-muted text-sm">{cadence}</div>
      </div>
      <div className="text-faint text-xs mt-1 mb-4">{tagline}</div>

      <ul className="space-y-1.5 mb-5">
        {features.map((f) => (
          <li key={f} className="text-fg2 text-sm flex items-start gap-2">
            <span className="text-emerald-400">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          highlight
            ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
            : 'bg-blue-600 hover:bg-blue-700 text-fg'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  )
}
