import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore, type TimeControl } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { getInitialBoard, getLegalMoves } from '../engine/rules'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'
import { supabase } from '../services/supabase'
import type { Board, Player } from '../engine/rules'
import Sidebar from '../components/Sidebar'
import OnboardingModal from '../components/OnboardingModal'
import { t } from '../i18n'
import type { Level } from '../services/profile'

const TIME_OPTIONS = [
  { tc: '1+0' as TimeControl, label: 'play1' as const, category: 'bullet' as const },
  { tc: '3+0' as TimeControl, label: 'play3' as const, category: 'blitz' as const },
  { tc: '5+0' as TimeControl, label: 'play5' as const, category: 'blitz' as const },
  { tc: '10+0' as TimeControl, label: 'play10' as const, category: 'rapid' as const },
]

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { setGame } = useGameStore()
  const { profile, needsOnboarding, onboard, load: loadProfile } = useProfileStore()
  const [showBotLevels, setShowBotLevels] = useState(false)
  const [botLevel, setBotLevel] = useState(5)
  const [searching, setSearching] = useState(false)
  const [queueTc, setQueueTc] = useState<TimeControl>('5+0')
  const [queueError, setQueueError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<number | null>(null)

  const isGuest = user?.id?.startsWith('guest-')
  const username = profile?.username ?? user?.user_metadata?.username ?? user?.email ?? 'Player'
  const rating = profile?.rating ?? 1200

  useEffect(() => {
    if (!searching) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    setElapsed(0)
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [searching])

  const handleOnboard = async (name: string, level: Level): Promise<boolean> => {
    if (!user) return false
    return await onboard(user.id, name, level)
  }

  const startBotGame = (level: number) => {
    const board = getInitialBoard()
    const gameId = `local-${Date.now()}`
    setGame({
      gameId,
      board,
      turn: 'black',
      legalMoves: getLegalMoves(board, 'black'),
      status: 'playing',
      winner: null,
      myColor: 'black',
      mode: 'bot',
      opponentName: `Bot L${level}`,
      myName: username,
      timeControl: 'unlimited',
      timeBlackMs: Number.POSITIVE_INFINITY,
      timeWhiteMs: Number.POSITIVE_INFINITY,
      moves: [],
    })
    navigate(`/game/${gameId}`)
  }

  const startSelfGame = () => {
    const board = getInitialBoard()
    const gameId = `local-${Date.now()}`
    setGame({
      gameId,
      board,
      turn: 'black',
      legalMoves: getLegalMoves(board, 'black'),
      status: 'playing',
      winner: null,
      myColor: 'black',
      mode: 'self',
      opponentName: 'You (White)',
      myName: username,
      timeControl: 'unlimited',
      timeBlackMs: Number.POSITIVE_INFINITY,
      timeWhiteMs: Number.POSITIVE_INFINITY,
      moves: [],
    })
    navigate(`/game/${gameId}`)
  }

  const findMatch = async (tc: TimeControl) => {
    if (!user || isGuest) return
    setQueueTc(tc)
    setQueueError(null)
    setSearching(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token ?? ''
      const s = connectSocket(token)

      let myColor: Player | null = null
      let opponentName = 'Opponent'
      let opponentRating = 1200

      const onMatchFound = (payload: {
        gameId: string
        blackId: string
        whiteId: string
        blackName: string
        whiteName: string
        blackRating: number
        whiteRating: number
        timeControl: TimeControl
      }) => {
        myColor = payload.blackId === s.id ? 'black' : 'white'
        opponentName = myColor === 'black' ? payload.whiteName : payload.blackName
        opponentRating = myColor === 'black' ? payload.whiteRating : payload.blackRating
      }
      const onGameStart = (payload: {
        gameId: string
        board: Board
        turn: Player
        timeBlackMs: number
        timeWhiteMs: number
        timeControl: TimeControl
      }) => {
        setGame({
          gameId: payload.gameId,
          board: payload.board,
          turn: payload.turn,
          legalMoves: getLegalMoves(payload.board, payload.turn),
          status: 'playing',
          winner: null,
          myColor: myColor ?? 'black',
          mode: 'random',
          myName: username,
          opponentName,
          opponentRating,
          myRating: rating,
          timeControl: payload.timeControl,
          timeBlackMs: payload.timeBlackMs,
          timeWhiteMs: payload.timeWhiteMs,
          serverLastMoveAt: Date.now(),
          lastServerSyncAt: Date.now(),
          moves: [],
          chat: [],
          drawOfferFrom: null,
          rematchOfferFrom: null,
          rematchDeclined: false,
          endReason: null,
          ratingChange: null,
          selectedCell: null,
        })
        cleanup()
        setSearching(false)
        navigate(`/game/${payload.gameId}`)
      }

      const onConnectError = (err: Error) => {
        setQueueError(`Server unreachable: ${err.message}`)
        cleanup()
        disconnectSocket()
        setSearching(false)
      }

      const cleanup = () => {
        s.off('match_found', onMatchFound)
        s.off('game_start', onGameStart)
        s.off('connect_error', onConnectError)
      }

      s.on('connect_error', onConnectError)
      s.on('match_found', onMatchFound)
      s.on('game_start', onGameStart)

      s.emit('join_queue', {
        userId: user.id,
        username,
        rating,
        timeControl: tc,
      })
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to join queue')
      setSearching(false)
    }
  }

  const cancelSearch = () => {
    const s = getSocket()
    s.emit('leave_queue')
    s.off('match_found')
    s.off('game_start')
    disconnectSocket()
    setSearching(false)
  }

  return (
    <div className="min-h-screen bg-[#0f1419] flex">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white text-lg font-bold flex items-center gap-2">
                {username}
                {profile && (
                  <span className="text-sm text-gray-400 font-normal">⭐ {profile.rating}</span>
                )}
              </div>
              <div className="text-gray-500 text-xs">{t('welcomeBack')}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-1 bg-[#1f2937] rounded-2xl p-5 border border-[#374151] flex items-center gap-3">
              <div className="text-4xl">🔥</div>
              <div>
                <div className="text-gray-400 text-xs">{t('streak')}</div>
                <div className="text-white text-lg font-bold">
                  {profile?.daily_streak ?? 0}
                </div>
                <div className="text-gray-500 text-[11px]">
                  {profile && profile.best_daily_streak > 0
                    ? `${t('bestRating')} ${profile.best_daily_streak}`
                    : t('streakSub')}
                </div>
              </div>
            </div>
            <div className="bg-[#1f2937] rounded-2xl p-5 border border-[#374151] flex items-center gap-3">
              <div className="text-4xl">⭐</div>
              <div>
                <div className="text-gray-400 text-xs">{t('bestRating')}</div>
                <div className="text-white text-lg font-bold">{profile?.best_rating ?? 1200}</div>
                <div className="text-gray-500 text-[11px]">
                  {t('rating')} {profile?.rating ?? 1200}
                </div>
              </div>
            </div>
            <div className="bg-[#1f2937] rounded-2xl p-5 border border-[#374151] flex items-center gap-3">
              <div className="text-4xl">📊</div>
              <div>
                <div className="text-gray-400 text-xs">{t('games')}</div>
                <div className="text-white text-lg font-bold">{profile?.games_played ?? 0}</div>
                <div className="text-gray-500 text-[11px]">
                  {profile && profile.games_played > 0
                    ? `${Math.round((profile.wins / profile.games_played) * 100)}% ${t('winRate')}`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#1f2937] rounded-2xl border border-[#374151] p-6">
            <h2 className="text-white text-xl font-bold mb-4">{t('play')}</h2>

            {!isGuest && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.tc}
                      onClick={() => findMatch(opt.tc)}
                      className="bg-[#374151] hover:bg-[#4b5563] border border-[#4b5563] hover:border-blue-500 rounded-xl py-4 px-3 text-center transition-all group"
                    >
                      <div className="text-2xl mb-1">
                        {opt.category === 'bullet' ? '⚡' : opt.category === 'blitz' ? '🔥' : '🐢'}
                      </div>
                      <div className="text-white font-bold">{t(opt.label)}</div>
                      <div className="text-gray-400 text-xs capitalize">{t(opt.category as 'bullet' | 'blitz' | 'rapid')}</div>
                    </button>
                  ))}
                </div>
                {queueError && (
                  <p className="text-red-400 text-sm mb-3">{queueError}</p>
                )}
              </>
            )}

            <div className="space-y-2">
              <div>
                <button
                  onClick={() => setShowBotLevels(!showBotLevels)}
                  className="w-full bg-[#374151] hover:bg-[#4b5563] border border-[#4b5563] hover:border-blue-500 rounded-xl py-3 px-4 transition-all flex items-center gap-3 text-left"
                >
                  <span className="text-2xl">🤖</span>
                  <div className="flex-1">
                    <div className="text-white font-bold">{t('bots')}</div>
                    <div className="text-gray-400 text-xs">
                      {t('minimaxAi')} · L{botLevel}
                    </div>
                  </div>
                </button>
                {showBotLevels && (
                  <div className="mt-2 bg-[#111827] rounded-xl p-3 border border-[#374151] flex flex-wrap gap-2">
                    {[1, 5, 10, 15, 20, 25].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setBotLevel(lvl)
                          setShowBotLevels(false)
                          startBotGame(lvl)
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1f2937] hover:bg-blue-600 text-gray-200 hover:text-white transition-colors"
                      >
                        L{lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={startSelfGame}
                className="w-full bg-[#374151] hover:bg-[#4b5563] border border-[#4b5563] hover:border-blue-500 rounded-xl py-3 px-4 transition-all flex items-center gap-3 text-left"
              >
                <span className="text-2xl">⚔️</span>
                <div>
                  <div className="text-white font-bold">{t('playYourself')}</div>
                  <div className="text-gray-400 text-xs">{t('practiceMode')}</div>
                </div>
              </button>
            </div>

            {isGuest && (
              <p className="text-center text-gray-500 text-sm mt-4">
                {t('signInToUnlock')}
              </p>
            )}
          </div>
        </div>
      </main>

      {searching && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1f2937] border border-[#374151] rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-5xl mb-4 animate-pulse">🌐</div>
            <h3 className="text-white text-xl font-bold mb-2">{t('searching')}</h3>
            <p className="text-gray-400 text-sm mb-1">
              {queueTc} ·{' '}
              {elapsed < 15
                ? `${t('matchByRating')} (±200)`
                : elapsed < 40
                ? t('wideningRange')
                : t('anyOpponent')}
            </p>
            <p className="text-gray-500 text-xs mb-6">
              {Math.floor(elapsed / 60).toString().padStart(2, '0')}:
              {(elapsed % 60).toString().padStart(2, '0')}
            </p>
            <button
              onClick={cancelSearch}
              className="w-full bg-[#374151] hover:bg-[#4b5563] text-white py-3 rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {!isGuest && user && needsOnboarding && (
        <OnboardingModal
          defaultUsername={username}
          onSubmit={async (name, lvl) => {
            const ok = await handleOnboard(name, lvl)
            if (ok) await loadProfile(user.id)
            return ok
          }}
        />
      )}
    </div>
  )
}
