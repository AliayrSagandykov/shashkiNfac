import Sidebar from '../components/Sidebar'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { t } from '../i18n'

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'red' | 'yellow' | 'blue'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'red'
      ? 'text-red-400'
      : accent === 'yellow'
      ? 'text-yellow-300'
      : accent === 'blue'
      ? 'text-blue-400'
      : 'text-white'
  return (
    <div className="bg-[#1f2937] rounded-2xl border border-[#374151] p-5">
      <div className="text-gray-400 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export default function Profile() {
  const { user } = useAuthStore()
  const { profile } = useProfileStore()

  const username = profile?.username ?? user?.user_metadata?.username ?? user?.email ?? 'Player'

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-gray-400">
          {user?.id?.startsWith('guest-') ? t('signInToUnlock') : t('profile')}
        </main>
      </div>
    )
  }

  const winRate =
    profile.games_played > 0
      ? Math.round((profile.wins / profile.games_played) * 100)
      : 0

  return (
    <div className="min-h-screen bg-[#0f1419] flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-white text-3xl font-bold">{username}</h1>
              <p className="text-gray-400 text-sm capitalize">{profile.level}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatTile label={t('rating')} value={profile.rating} accent="blue" />
            <StatTile
              label={t('bestRating')}
              value={profile.best_rating}
              accent="yellow"
            />
            <StatTile label={t('streak')} value={profile.win_streak} accent="green" />
            <StatTile
              label={t('games')}
              value={profile.games_played}
              sub={`${winRate}% ${t('winRate')}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatTile label={t('wins')} value={profile.wins} accent="green" />
            <StatTile label={t('losses')} value={profile.losses} accent="red" />
            <StatTile label={t('draws')} value={profile.draws} />
          </div>
        </div>
      </main>
    </div>
  )
}
