import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useNavigate } from 'react-router-dom'
import { fetchProfile, uploadAvatar, type Profile as ProfileT } from '../services/profile'
import { fetchRecentGames, type SavedGame } from '../services/games'
import { t } from '../i18n'
import LanguageToggle from '../components/LanguageToggle'

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
      : 'text-fg'
  return (
    <div className="bg-card rounded-2xl border border-line p-5">
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-faint text-xs mt-1">{sub}</div>}
    </div>
  )
}

export default function Profile() {
  const { id: routeId } = useParams<{ id?: string }>()
  const { user } = useAuthStore()
  const { profile: ownProfile, update } = useProfileStore()

  const navigate = useNavigate()
  const viewingOwn = !routeId || routeId === user?.id
  const [otherProfile, setOtherProfile] = useState<ProfileT | null>(null)
  const [games, setGames] = useState<SavedGame[]>([])
  const [otherLoading, setOtherLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftBio, setDraftBio] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (viewingOwn) {
      setOtherProfile(null)
      return
    }
    setOtherLoading(true)
    fetchProfile(routeId!).then((p) => {
      setOtherProfile(p)
      setOtherLoading(false)
    })
  }, [routeId, viewingOwn])

  useEffect(() => {
    const id = viewingOwn ? user?.id : routeId
    if (!id || id.startsWith('guest-')) {
      setGames([])
      return
    }
    void fetchRecentGames(id, 10).then(setGames)
  }, [viewingOwn, user?.id, routeId])

  const profile: ProfileT | null = viewingOwn ? ownProfile : otherProfile

  useEffect(() => {
    if (profile && editing) {
      setDraftName(profile.username ?? '')
      setDraftBio(profile.bio ?? '')
    }
  }, [profile, editing])

  if (!viewingOwn && otherLoading) {
    return (
      <div className="min-h-screen bg-app flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-muted">…</main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-app flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-muted">
          {viewingOwn && user?.id?.startsWith('guest-')
            ? t('signInToUnlock')
            : viewingOwn
            ? t('profile')
            : 'Profile not found'}
        </main>
      </div>
    )
  }

  const username = profile.username ?? user?.email ?? 'Player'
  const winRate =
    profile.games_played > 0
      ? Math.round((profile.wins / profile.games_played) * 100)
      : 0

  const handleSave = async () => {
    setSaveStatus('saving')
    const ok = await update({
      username: draftName.trim() || profile.username,
      bio: draftBio.trim() || null,
    })
    if (ok) {
      setSaveStatus('saved')
      setEditing(false)
      setTimeout(() => setSaveStatus('idle'), 1500)
    } else {
      setSaveStatus('error')
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !viewingOwn) return
    if (file.size > 4 * 1024 * 1024) {
      alert('Image too large (max 4 MB)')
      return
    }
    setUploading(true)
    const url = await uploadAvatar(user.id, file)
    if (url) {
      await update({ avatar_url: url })
    } else {
      alert(t('saveError'))
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-app flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 pt-16 lg:pt-8 pb-8">
          <div className="relative bg-card border border-line rounded-2xl p-6 mb-4">
            {viewingOwn && (
              <div className="absolute top-3 right-3">
                <LanguageToggle
                  onChange={(lang) => update({ language: lang }).then(() => undefined)}
                />
              </div>
            )}
            <div className="flex items-start gap-5">
              <div className="relative">
                <Avatar
                  name={username}
                  url={profile.avatar_url}
                  size={88}
                  className="!w-22 !h-22"
                />
                {viewingOwn && (
                  <>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-fg text-xs rounded-full w-7 h-7 flex items-center justify-center border-2 border-line"
                      title={t('uploadAvatar')}
                    >
                      {uploading ? '…' : '📷'}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {editing && viewingOwn ? (
                  <>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      maxLength={20}
                      className="bg-field text-fg text-2xl font-bold py-1 px-2 rounded-lg border border-line focus:outline-none focus:border-blue-500 w-full max-w-xs"
                    />
                    <textarea
                      value={draftBio}
                      onChange={(e) => setDraftBio(e.target.value)}
                      maxLength={200}
                      rows={3}
                      placeholder={t('bioPlaceholder')}
                      className="bg-field text-fg2 text-sm py-2 px-3 mt-2 rounded-lg border border-line focus:outline-none focus:border-blue-500 w-full resize-none"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-fg text-sm px-4 py-1.5 rounded-lg"
                      >
                        {saveStatus === 'saving' ? t('saving') : t('save')}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="bg-elev hover:bg-hover text-fg text-sm px-4 py-1.5 rounded-lg"
                      >
                        {t('cancel')}
                      </button>
                      {saveStatus === 'error' && (
                        <span className="text-red-400 text-xs self-center">
                          {t('saveError')}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="text-fg text-3xl font-bold">{username}</h1>
                    <p className="text-muted text-sm capitalize">{profile.level}</p>
                    {profile.bio && (
                      <p className="text-fg2 text-sm mt-3 whitespace-pre-line">
                        {profile.bio}
                      </p>
                    )}
                    {viewingOwn && (
                      <button
                        onClick={() => setEditing(true)}
                        className="mt-3 bg-elev hover:bg-hover text-fg text-xs px-3 py-1.5 rounded-lg"
                      >
                        ✎ {t('editProfile')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <StatTile label={t('rating')} value={profile.rating} accent="blue" />
            <StatTile
              label={t('bestRating')}
              value={profile.best_rating}
              accent="yellow"
            />
            <StatTile label={t('streak')} value={profile.daily_streak} accent="green" />
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

          {games.length > 0 && (
            <div className="mt-4 bg-card border border-line rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line text-fg2 text-sm font-semibold">
                Recent games
              </div>
              <div>
                {games.map((g) => {
                  const meIsWhite = g.white_id === (viewingOwn ? user?.id : routeId)
                  const opp = meIsWhite ? g.black_name : g.white_name
                  const result =
                    g.winner === 'draw'
                      ? '½'
                      : (meIsWhite && g.winner === 'white') || (!meIsWhite && g.winner === 'black')
                      ? 'W'
                      : 'L'
                  const color =
                    result === 'W'
                      ? 'text-emerald-400'
                      : result === 'L'
                      ? 'text-red-400'
                      : 'text-muted'
                  return (
                    <button
                      key={g.id}
                      onClick={() => navigate(`/review/${g.id}`)}
                      className="w-full grid grid-cols-[2rem_1fr_5rem_3rem] items-center px-4 py-2.5 border-b border-line/40 last:border-0 hover:bg-hover text-left"
                    >
                      <span className={`font-bold ${color}`}>{result}</span>
                      <span className="text-fg text-sm truncate">vs {opp}</span>
                      <span className="text-muted text-xs">{g.time_control}</span>
                      <span className="text-muted text-xs text-right">
                        {new Date(g.played_at).toLocaleDateString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
