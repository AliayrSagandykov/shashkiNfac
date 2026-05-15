import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import { fetchTopProfiles, type Profile } from '../services/profile'
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
    <div className="min-h-screen bg-[#0f1419] flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-white text-3xl font-bold mb-1">{t('topPlayers')}</h1>
          <p className="text-gray-500 text-sm mb-6">Top 30 · {t('rating')}</p>

          {profiles === null ? (
            <div className="text-gray-400">…</div>
          ) : profiles.length === 0 ? (
            <div className="text-gray-500 text-sm">{t('noPlayersYet')}</div>
          ) : (
            <div className="bg-[#1f2937] border border-[#374151] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[3rem_1fr_5rem_5rem] text-gray-400 text-xs uppercase tracking-wide border-b border-[#374151] px-4 py-2">
                <div>{t('rank')}</div>
                <div>{t('player')}</div>
                <div className="text-right">{t('games')}</div>
                <div className="text-right">{t('rating')}</div>
              </div>
              {profiles.map((p, i) => {
                const rank = i + 1
                const isMe = user?.id === p.id
                const winRate =
                  p.games_played > 0
                    ? Math.round((p.wins / p.games_played) * 100)
                    : 0
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/u/${p.id}`)}
                    className={`w-full grid grid-cols-[3rem_1fr_5rem_5rem] items-center px-4 py-3 border-b border-[#374151]/50 last:border-0 text-left hover:bg-[#2a3441] transition-colors ${
                      isMe ? 'bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="text-white font-bold text-base">
                      {medal(rank)}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={p.username ?? '?'} url={p.avatar_url} size={36} />
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">
                          {p.username ?? 'Unnamed'}
                          {isMe && (
                            <span className="ml-2 text-xs text-blue-300">you</span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs capitalize">{p.level}</div>
                      </div>
                    </div>
                    <div className="text-right text-gray-300 text-sm">
                      {p.games_played}
                      <div className="text-gray-500 text-xs">{winRate}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-300 font-bold">{p.rating}</div>
                      <div className="text-gray-500 text-xs">best {p.best_rating}</div>
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
