import { useState } from 'react'
import { t } from '../i18n'
import { LEVEL_STARTING_RATING, type Level } from '../services/profile'

interface Props {
  defaultUsername: string
  onSubmit: (username: string, level: Level) => Promise<boolean>
}

const LEVELS: Level[] = ['beginner', 'amateur', 'experienced', 'expert']

export default function OnboardingModal({ defaultUsername, onSubmit }: Props) {
  const [username, setUsername] = useState(defaultUsername)
  const [level, setLevel] = useState<Level>('amateur')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = async () => {
    if (!username.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const ok = await onSubmit(username.trim(), level)
      if (!ok) {
        setError(
          'Could not save profile. Run supabase/migrations/001_profiles.sql in your Supabase SQL editor, then refresh.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const labelFor = (l: Level): string =>
    l === 'beginner'
      ? t('levelBeginner')
      : l === 'amateur'
      ? t('levelAmateur')
      : l === 'experienced'
      ? t('levelExperienced')
      : t('levelExpert')

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#16213e] border border-[#0f3460] rounded-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">♟</div>
          <h2 className="text-white text-2xl font-bold">{t('onboardingTitle')}</h2>
          <p className="text-gray-400 mt-1 text-sm">{t('onboardingSub')}</p>
        </div>

        <label className="block text-gray-400 text-sm mb-2">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          className="w-full bg-[#0f3460] text-white placeholder-gray-400 py-3 px-4 rounded-xl border border-[#1a4a7a] focus:outline-none focus:border-blue-500 mb-5"
        />

        <div className="space-y-2 mb-6">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between ${
                level === l
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-[#0f1e3d] border-[#0f3460] text-gray-200 hover:border-blue-500'
              }`}
            >
              <span className="font-semibold">{labelFor(l)}</span>
              <span className={`text-sm ${level === l ? 'text-blue-100' : 'text-gray-400'}`}>
                {t('starts')} {LEVEL_STARTING_RATING[l]}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 text-xs rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handle}
          disabled={submitting || !username.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
        >
          {submitting ? '…' : t('confirm')}
        </button>
      </div>
    </div>
  )
}
