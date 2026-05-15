import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { getInitialBoard, getLegalMoves } from '../engine/rules'
import { useEffect, useRef, useState } from 'react'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'
import { supabase } from '../services/supabase'
import type { Board, Player } from '../engine/rules'

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { setGame } = useGameStore()
  const [showBotLevels, setShowBotLevels] = useState(false)
  const [botLevel, setBotLevel] = useState(5)
  const [searching, setSearching] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<number | null>(null)

  const isGuest = user?.id?.startsWith('guest-')
  const username = user?.user_metadata?.username ?? user?.email ?? 'Player'

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

  const findRandomMatch = async () => {
    setQueueError(null)
    setSearching(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token ?? ''
      const s = connectSocket(token)

      let myColor: Player | null = null

      const onMatchFound = (payload: { gameId: string; blackId: string; whiteId: string }) => {
        myColor = payload.blackId === s.id ? 'black' : 'white'
      }
      const onGameStart = (payload: { gameId: string; board: Board; turn: Player }) => {
        setGame({
          gameId: payload.gameId,
          board: payload.board,
          turn: payload.turn,
          legalMoves: getLegalMoves(payload.board, payload.turn),
          status: 'playing',
          winner: null,
          myColor: myColor ?? 'black',
          mode: 'random',
          opponentName: 'Opponent',
          selectedCell: null,
          endReason: null,
        })
        cleanup()
        setSearching(false)
        navigate(`/game/${payload.gameId}`)
      }

      const cleanup = () => {
        s.off('match_found', onMatchFound)
        s.off('game_start', onGameStart)
      }

      s.on('match_found', onMatchFound)
      s.on('game_start', onGameStart)

      s.emit('join_queue', { userId: user?.id ?? s.id, rating: 1200 })
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

  const startGame = (mode: 'self' | 'bot', level?: number) => {
    const board = getInitialBoard()
    const gameId = `local-${Date.now()}`
    const lvl = level ?? botLevel
    setGame({
      gameId,
      board,
      turn: 'black',
      legalMoves: getLegalMoves(board, 'black'),
      status: 'playing',
      winner: null,
      myColor: 'black',
      mode,
      opponentName: mode === 'bot' ? `Bot (Level ${lvl})` : 'You (White)',
    })
    navigate(`/game/${gameId}`)
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#0f3460]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="text-white font-bold text-lg">Checkers</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{username}</span>
          <button
            onClick={() => signOut()}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-white text-2xl font-bold text-center mb-8">Play</h2>

          <div className="space-y-3">
            {!isGuest && (
              <>
                <button
                  className="w-full bg-[#16213e] hover:bg-[#1a2a4e] border border-[#0f3460] hover:border-blue-500 text-white py-4 px-6 rounded-xl font-semibold transition-all text-left flex items-center gap-4"
                  onClick={findRandomMatch}
                >
                  <span className="text-3xl">🌐</span>
                  <div>
                    <div className="font-bold">Play Random Player</div>
                    <div className="text-gray-400 text-sm">Online matchmaking</div>
                  </div>
                </button>
                {queueError && (
                  <p className="text-red-400 text-sm text-center">{queueError}</p>
                )}

                <button
                  className="w-full bg-[#16213e] hover:bg-[#1a2a4e] border border-[#0f3460] hover:border-blue-500 text-white py-4 px-6 rounded-xl font-semibold transition-all text-left flex items-center gap-4"
                  onClick={() => alert('AI coming soon!')}
                >
                  <span className="text-3xl">🤖</span>
                  <div>
                    <div className="font-bold">Play vs AI</div>
                    <div className="text-gray-400 text-sm">Adaptive difficulty</div>
                  </div>
                </button>
              </>
            )}

            <div>
              <button
                className="w-full bg-[#16213e] hover:bg-[#1a2a4e] border border-[#0f3460] hover:border-blue-500 text-white py-4 px-6 rounded-xl font-semibold transition-all text-left flex items-center gap-4"
                onClick={() => setShowBotLevels(!showBotLevels)}
              >
                <span className="text-3xl">🎮</span>
                <div>
                  <div className="font-bold">Play vs Bot</div>
                  <div className="text-gray-400 text-sm">Minimax AI, level {botLevel}</div>
                </div>
              </button>

              {showBotLevels && (
                <div className="mt-2 bg-[#0f1e3d] rounded-xl p-4 border border-[#0f3460]">
                  <p className="text-gray-400 text-sm mb-3">Select difficulty</p>
                  <div className="flex flex-wrap gap-2">
                    {([1, 5, 10, 15, 20, 25] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setBotLevel(lvl)
                          setShowBotLevels(false)
                          startGame('bot', lvl)
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          botLevel === lvl
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#16213e] text-gray-300 hover:bg-[#1a2a4e]'
                        }`}
                      >
                        {lvl === 1 ? 'Beginner' : lvl === 5 ? 'Easy' : lvl === 10 ? 'Medium' : lvl === 15 ? 'Hard' : lvl === 20 ? 'Expert' : 'Master'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              className="w-full bg-[#16213e] hover:bg-[#1a2a4e] border border-[#0f3460] hover:border-blue-500 text-white py-4 px-6 rounded-xl font-semibold transition-all text-left flex items-center gap-4"
              onClick={() => startGame('self')}
            >
              <span className="text-3xl">⚔️</span>
              <div>
                <div className="font-bold">Play Yourself</div>
                <div className="text-gray-400 text-sm">Practice mode</div>
              </div>
            </button>
          </div>

          {isGuest && (
            <p className="text-center text-gray-500 text-sm mt-6">
              Sign in to unlock online multiplayer
            </p>
          )}
        </div>
      </main>

      {searching && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#16213e] border border-[#0f3460] rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-5xl mb-4 animate-pulse">🌐</div>
            <h3 className="text-white text-xl font-bold mb-2">Searching for opponent…</h3>
            <p className="text-gray-400 text-sm mb-1">Matching by rating</p>
            <p className="text-gray-500 text-xs mb-6">
              {Math.floor(elapsed / 60).toString().padStart(2, '0')}:
              {(elapsed % 60).toString().padStart(2, '0')}
            </p>
            <button
              onClick={cancelSearch}
              className="w-full bg-[#0f3460] hover:bg-[#1a4a7a] text-white py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
