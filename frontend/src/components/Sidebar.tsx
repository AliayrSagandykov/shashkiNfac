import { NavLink, useNavigate } from 'react-router-dom'
import { t } from '../i18n'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'

interface Item {
  to: string
  icon: string
  labelKey: 'play' | 'leaderboard' | 'news' | 'profile'
}

const items: Item[] = [
  { to: '/', icon: '▶', labelKey: 'play' },
  { to: '/leaderboard', icon: '🏆', labelKey: 'leaderboard' },
  { to: '/news', icon: '📰', labelKey: 'news' },
  { to: '/profile', icon: '👤', labelKey: 'profile' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { profile, clear } = useProfileStore()

  const username = profile?.username ?? user?.user_metadata?.username ?? user?.email ?? 'Player'

  const handleSignOut = async () => {
    await signOut()
    clear()
    navigate('/login')
  }

  return (
    <aside className="w-56 shrink-0 bg-[#111827] border-r border-[#1f2937] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-2 text-white font-bold text-lg">
          <span className="text-2xl">♟</span>
          <span>Checkers</span>
        </div>
      </div>

      <nav className="flex-1 py-3 space-y-0.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-[#1f2937] text-white border-l-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a2333]'
              }`
            }
          >
            <span className="text-lg w-5 text-center">{it.icon}</span>
            <span className="font-medium">{t(it.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#1f2937] p-3">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#1a2333] transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium truncate">{username}</div>
            {profile && (
              <div className="text-gray-400 text-xs">⭐ {profile.rating}</div>
            )}
          </div>
        </button>
        <button
          onClick={handleSignOut}
          className="w-full mt-2 text-gray-500 hover:text-white text-xs px-2 py-1.5 transition-colors text-left"
        >
          {t('signOut')}
        </button>
      </div>
    </aside>
  )
}
