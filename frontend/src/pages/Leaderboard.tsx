import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import { fetchTopProfiles, isPremiumActive, type Profile } from '../services/profile'
import { useAuthStore } from '../store/authStore'
import { t } from '../i18n'

export default function Leaderboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)

  useEffect(() => {
    void fetchTopProfiles(30).then(setProfiles)
  }, [])

  const medal = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return rank
  }

  return (
    <div className="min-h-screen bg-app flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 pt-16 lg:pt-8 pb-8">
          <h1 className="text-fg text-3xl font-bold mb-1">{t('topPlayers')}</h1>
          <p className="text-faint text-sm mb-6">Top 30 · {t('rating')}</p>

          {profiles === null ? (
            <div className="text-muted">…</div>
          ) : profiles.length === 0 ? (
            <div className="text-faint text-sm">{t('noPlayersYet')}</div>
          ) : (
            <div className="bg-card border border-line rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem] sm:grid-cols-[3rem_1fr_5rem_5rem] text-muted text-xs uppercase tracking-wide border-b border-line px-4 py-2">
                <div>{t('rank')}</div>
                <div>{t('player')}</div>
                <div className="text-right">{t('games')}</div>
                <div className="text-right">{t('rating')}</div>
              </div>
              {profiles.map((p, i) => {
                const rank = i + 1
                const isMe = user?.id === p.id
                const premium = isPremiumActive(p)
                const winRate =
                  p.games_played > 0
                    ? Math.round((p.wins / p.games_played) * 100)
                    : 0
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/u/${p.id}`)}
                    className={`w-full grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem] sm:grid-cols-[3rem_1fr_5rem_5rem] items-center px-4 py-3 border-b border-line/50 last:border-0 text-left hover:bg-hover transition-colors ${
                      premium
                        ? 'bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent'
                        : ''
                    } ${isMe ? 'bg-blue-900/30' : ''}`}
                  >
                    <div className="text-fg font-bold text-base">
                      {medal(rank)}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={
                          premium
                            ? 'rounded-full p-[2px] bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-[0_0_8px_rgba(250,204,21,0.45)]'
                            : ''
                        }
                      >
                        <Avatar name={p.username ?? '?'} url={p.avatar_url} size={36} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-fg font-medium truncate flex items-center gap-1.5">
                          <span className="truncate">{p.username ?? 'Unnamed'}</span>
                          {premium && (
                            <span
                              title="Premium"
                              className="text-yellow-300 text-sm leading-none"
                            >
                              👑
                            </span>
                          )}
                          {isMe && (
                            <span className="ml-1 text-xs text-blue-300">you</span>
                          )}
                        </div>
                        <div className="text-faint text-xs capitalize">{p.level}</div>
                      </div>
                    </div>
                    <div className="text-right text-fg2 text-sm">
                      {p.games_played}
                      <div className="text-faint text-xs">{winRate}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-300 font-bold">{p.rating}</div>
                      <div className="text-faint text-xs">best {p.best_rating}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
