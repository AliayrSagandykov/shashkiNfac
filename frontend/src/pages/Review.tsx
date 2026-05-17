import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Board from '../components/Board'
import EvalGraph from '../components/EvalGraph'
import Avatar from '../components/Avatar'
import { fetchGame, requestAnalysis, type GameAnalysis, type SavedGame, type MoveClass } from '../services/games'
import { applyMove, getInitialBoard } from '../engine/rules'
import { useAuthStore } from '../store/authStore'
import { t } from '../i18n'

const CLASS_COLOR: Record<MoveClass, string> = {
  best: 'text-emerald-400',
  good: 'text-fg2',
  inaccuracy: 'text-yellow-300',
  mistake: 'text-orange-400',
  blunder: 'text-red-400',
}

const CLASS_LABEL: Record<MoveClass, string> = {
  best: '★',
  good: '·',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

function notate(m: { from: [number, number]; to: [number, number]; captures: [number, number][] }) {
  const col = (c: number) => String.fromCharCode(97 + c)
  const from = `${col(m.from[1])}${10 - m.from[0]}`
  const to = `${col(m.to[1])}${10 - m.to[0]}`
  return `${from}${m.captures.length > 0 ? 'x' : '-'}${to}`
}

export default function Review() {
  const navigate = useNavigate()
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuthStore()

  const [game, setGame] = useState<SavedGame | null>(null)
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ply, setPly] = useState(-1) // -1 = initial position

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    fetchGame(gameId).then((r) => {
      setLoading(false)
      if (!r) {
        setError('Game not found')
        return
      }
      setGame(r.game)
      setAnalysis(r.analysis)
    })
  }, [gameId])

  const boardAtPly = useMemo(() => {
    if (!game) return getInitialBoard()
    let b = getInitialBoard()
    for (let i = 0; i <= ply; i++) {
      const m = game.moves[i]
      if (!m) break
      b = applyMove(b, m)
    }
    return b
  }, [game, ply])

  const lastMove = ply >= 0 && game ? game.moves[ply] : null

  const handleRun = async () => {
    if (!gameId) return
    setRunning(true)
    setError(null)
    const result = await requestAnalysis(gameId, user?.id)
    setRunning(false)
    if (!result) setError('Analysis failed')
    else setAnalysis(result)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-muted">…</main>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-app flex">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-muted">
          {error ?? 'Not found'}
        </main>
      </div>
    )
  }

  const winnerText =
    game.winner === 'draw'
      ? t('drawResult')
      : game.winner === 'white'
      ? t('whiteWins')
      : t('blackWins')

  return (
    <div className="min-h-screen bg-app flex">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-16 lg:pt-8 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-muted hover:text-fg text-sm mb-3"
          >
            ← {t('home_')}
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4">
            {/* Left: board + players */}
            <div>
              <div className="bg-card rounded-xl border border-line p-3 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={game.black_name} size={32} />
                  <div>
                    <div className="text-fg text-sm font-medium">{game.black_name}</div>
                    <div className="text-muted text-xs">
                      ⭐ {game.black_rating ?? '?'}
                      {game.black_rating_after != null && game.black_rating != null && (
                        <span className={game.black_rating_after >= game.black_rating ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
                          ({game.black_rating_after >= game.black_rating ? '+' : ''}
                          {game.black_rating_after - game.black_rating})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-fg2 text-xs">● Black</div>
              </div>

              <div className="bg-card2 rounded-2xl p-3 border border-line2">
                <Board
                  board={boardAtPly}
                  legalMoves={[]}
                  selectedCell={null}
                  lastMove={lastMove}
                  onCellClick={() => {}}
                  perspective="black"
                />
              </div>

              <div className="bg-card rounded-xl border border-line p-3 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={game.white_name} size={32} />
                  <div>
                    <div className="text-fg text-sm font-medium">{game.white_name}</div>
                    <div className="text-muted text-xs">
                      ⭐ {game.white_rating ?? '?'}
                      {game.white_rating_after != null && game.white_rating != null && (
                        <span className={game.white_rating_after >= game.white_rating ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
                          ({game.white_rating_after >= game.white_rating ? '+' : ''}
                          {game.white_rating_after - game.white_rating})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-fg2 text-xs">○ White</div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setPly(-1)}
                  className="bg-elev hover:bg-hover text-fg px-3 py-1.5 rounded-lg text-sm"
                >
                  ⏮
                </button>
                <button
                  onClick={() => setPly(Math.max(-1, ply - 1))}
                  className="bg-elev hover:bg-hover text-fg px-3 py-1.5 rounded-lg text-sm"
                >
                  ◀
                </button>
                <button
                  onClick={() => setPly(Math.min(game.moves.length - 1, ply + 1))}
                  className="bg-elev hover:bg-hover text-fg px-3 py-1.5 rounded-lg text-sm"
                >
                  ▶
                </button>
                <button
                  onClick={() => setPly(game.moves.length - 1)}
                  className="bg-elev hover:bg-hover text-fg px-3 py-1.5 rounded-lg text-sm"
                >
                  ⏭
                </button>
                <div className="self-center text-muted text-xs ml-2">
                  {ply + 1} / {game.moves.length} · {winnerText}
                </div>
              </div>
            </div>

            {/* Right: analysis */}
            <aside className="space-y-3">
              {analysis ? (
                <>
                  <div className="bg-card rounded-xl border border-line p-3">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <div className="text-muted text-xs">{t('whiteWins').replace(/ wins?/i, '')} ○</div>
                        <div className="text-fg text-2xl font-bold">{analysis.whiteAccuracy}%</div>
                      </div>
                      <div>
                        <div className="text-muted text-xs">{t('blackWins').replace(/ wins?/i, '')} ●</div>
                        <div className="text-fg text-2xl font-bold">{analysis.blackAccuracy}%</div>
                      </div>
                    </div>
                  </div>

                  <EvalGraph
                    evals={analysis.evalGraph}
                    currentPly={ply}
                    onSeek={(p) => setPly(p)}
                  />

                  {analysis.keyMoments.length > 0 && (
                    <div className="bg-card rounded-xl border border-line p-3">
                      <div className="text-fg2 text-sm font-semibold mb-2">Key moments</div>
                      <div className="space-y-1">
                        {analysis.keyMoments.map((m) => (
                          <button
                            key={m.ply}
                            onClick={() => setPly(m.ply)}
                            className="w-full flex items-center justify-between text-sm hover:bg-hover rounded px-2 py-1"
                          >
                            <span className="text-fg2">
                              {Math.floor(m.ply / 2) + 1}. {m.player === 'black' ? '●' : '○'} {notate(analysis.moves[m.ply].played)}
                            </span>
                            <span className={CLASS_COLOR[m.classification]}>
                              {CLASS_LABEL[m.classification]} −{(m.loss / 100).toFixed(1)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-card rounded-xl border border-line p-2 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-1 text-xs text-faint px-1 py-1">
                      <div>#</div>
                      <div>● Black</div>
                      <div>○ White</div>
                    </div>
                    {Array.from({ length: Math.ceil(analysis.moves.length / 2) }).map((_, i) => {
                      const b = analysis.moves[i * 2]
                      const w = analysis.moves[i * 2 + 1]
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[2.5rem_1fr_1fr] gap-1 text-sm px-1 py-0.5"
                        >
                          <span className="text-faint">{i + 1}.</span>
                          {b ? (
                            <button
                              onClick={() => setPly(b.ply)}
                              className={`text-left px-1 rounded font-mono ${
                                ply === b.ply ? 'bg-blue-900/40' : 'hover:bg-hover'
                              } ${CLASS_COLOR[b.classification]}`}
                            >
                              {notate(b.played)} {CLASS_LABEL[b.classification]}
                            </button>
                          ) : (
                            <span />
                          )}
                          {w ? (
                            <button
                              onClick={() => setPly(w.ply)}
                              className={`text-left px-1 rounded font-mono ${
                                ply === w.ply ? 'bg-blue-900/40' : 'hover:bg-hover'
                              } ${CLASS_COLOR[w.classification]}`}
                            >
                              {notate(w.played)} {CLASS_LABEL[w.classification]}
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="bg-card rounded-xl border border-line p-6 text-center">
                  <div className="text-fg font-semibold mb-1">Game review</div>
                  <p className="text-muted text-sm mb-4">
                    Run the engine on every move to find blunders, inaccuracies and the best line.
                  </p>
                  {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                  <button
                    onClick={handleRun}
                    disabled={running}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-fg py-3 rounded-xl font-semibold"
                  >
                    {running ? 'Analyzing… (this can take a minute)' : 'Analyze game'}
                  </button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
