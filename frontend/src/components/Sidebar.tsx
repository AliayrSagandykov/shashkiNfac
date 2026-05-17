import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { t } from '../i18n'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { isPremiumActive } from '../services/profile'
import ThemeToggle from './ThemeToggle'

interface Item {
  to: string
  icon: string
  labelKey: 'play' | 'leaderboard' | 'news' | 'profile' | 'signUp' | 'premium'
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuthStore()
  const { profile, clear, update } = useProfileStore()
  const [open, setOpen] = useState(false)

  const isGuest = !!user?.id?.startsWith('guest-')

  const premium = isPremiumActive(profile)

  const items: Item[] = isGuest
    ? [
        { to: '/', icon: '▶', labelKey: 'play' },
        { to: '/signup', icon: '→', labelKey: 'signUp' },
        { to: '/news', icon: '📰', labelKey: 'news' },
      ]
    : [
        { to: '/', icon: '▶', labelKey: 'play' },
        { to: '/leaderboard', icon: '🏆', labelKey: 'leaderboard' },
        { to: '/news', icon: '📰', labelKey: 'news' },
        { to: '/profile', icon: '👤', labelKey: 'profile' },
        { to: '/premium', icon: '👑', labelKey: 'premium' },
      ]

  const username = profile?.username ?? user?.user_metadata?.username ?? user?.email ?? 'Player'

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleSignOut = async () => {
    await signOut()
    clear()
    navigate('/login')
  }

  const handleSignUpClick = async () => {
    await signOut()
    clear()
    navigate('/login')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="lg:hidden fixed top-3 left-3 z-30 w-10 h-10 rounded-lg bg-card border border-line text-fg flex items-center justify-center text-xl shadow-lg hover:bg-hover"
      >
        ☰
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          h-screen w-64 lg:w-56 shrink-0
          bg-sidebar border-r border-line
          flex flex-col
          transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 text-fg font-bold text-lg">
            <span className="text-2xl">♟</span>
            <span>Checkers</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle
              onChange={
                profile
                  ? (next) => update({ theme: next }).then(() => undefined)
                  : undefined
              }
            />
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="lg:hidden text-muted hover:text-fg text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {items.map((it) =>
            it.labelKey === 'signUp' ? (
              <button
                key={it.to}
                onClick={handleSignUpClick}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm text-muted hover:text-fg hover:bg-hover transition-colors"
              >
                <span className="text-lg w-5 text-center">{it.icon}</span>
                <span className="font-medium">{t('signUp')}</span>
              </button>
            ) : (
              <NavLink
                key={it.to}
                to={it.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                    isActive
                      ? 'bg-card text-fg border-l-2 border-blue-500'
                      : 'text-muted hover:text-fg hover:bg-hover'
                  }`
                }
              >
                <span className="text-lg w-5 text-center">{it.icon}</span>
                <span className="font-medium">{t(it.labelKey)}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="border-t border-line p-3">
          <button
            onClick={() => (isGuest ? handleSignUpClick() : navigate('/profile'))}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-hover transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-fg font-bold text-sm shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                username.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-fg text-sm font-medium truncate">
                {isGuest ? 'Guest' : username}
              </div>
              {profile && !isGuest && (
                <div className="text-muted text-xs">⭐ {profile.rating}</div>
              )}
              {isGuest && <div className="text-muted text-xs">→ {t('signUp')}</div>}
            </div>
          </button>
          <button
            onClick={isGuest ? handleSignUpClick : handleSignOut}
            className="w-full mt-2 text-faint hover:text-fg text-xs px-2 py-1.5 transition-colors text-left"
          >
            {isGuest ? t('signUp') : t('signOut')}
          </button>
        </div>
      </aside>
    </>
  )
}
