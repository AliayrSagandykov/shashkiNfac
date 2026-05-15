import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, type TimeControl } from '../store/gameStore'
import Board from '../components/Board'
import Clock from '../components/Clock'
import ChatPanel from '../components/ChatPanel'
import MoveList from '../components/MoveList'
import GameOverModal from '../components/GameOverModal'
import {
  applyMove,
  checkWinner,
  getLegalMoves,
  getInitialBoard,
} from '../engine/rules'
import { getBestMove } from '../engine/ai'
import type { Move, Board as BoardT, Player } from '../engine/rules'
import { getSocket, disconnectSocket } from '../services/socket'
import { useProfileStore } from '../store/profileStore'
import { t } from '../i18n'

interface EndPayload {
  winner: Player | 'draw'
  reason: 'no_moves' | 'resign' | 'timeout' | 'draw_agreed'
  ratings?: {
    black: { userId: string; old: number; new: number; delta: number }
    white: { userId: string; old: number; new: number; delta: number }
  }
}

export default function Game() {
  const navigate = useNavigate()
  const {
    gameId,
    board,
    turn,
    legalMoves,
    selectedCell,
    status,
    winner,
    myColor,
    opponentName,
    myName,
    myRating,
    opponentRating,
    ratingChange,
    mode,
    endReason,
    moves,
    timeControl,
    timeBlackMs,
    timeWhiteMs,
    serverLastMoveAt,
    chat,
    drawOfferFrom,
    rematchOfferFrom,
    rematchDeclined,
    setGame,
    pushChat,
    pushMove,
    selectCell,
    resetGame,
  } = useGameStore()

  const { profile, applyResult } = useProfileStore()
  const [, setTick] = useState(0)

  // Tick once per 100ms so live clock counts down for online games.
  useEffect(() => {
    if (mode !== 'random' || status !== 'playing') return
    const id = window.setInterval(() => setTick((n) => n + 1), 100)
    return () => window.clearInterval(id)
  }, [mode, status])

  const liveTime = (color: Player): number => {
    const base = color === 'black' ? timeBlackMs : timeWhiteMs
    if (!isFinite(base)) return base
    if (status !== 'playing') return base
    if (turn !== color) return base
    const elapsed = Date.now() - serverLastMoveAt
    return Math.max(0, base - elapsed)
  }

  const executeMove = useCallback(
    (move: Move) => {
      if (mode === 'random') {
        getSocket().emit('make_move', { gameId, move })
        setGame({ selectedCell: null })
        return
      }
      const newBoard = applyMove(board, move)
      const nextTurn = turn === 'black' ? 'white' : 'black'
      const w = checkWinner(newBoard, nextTurn)
      const nextLegalMoves = w ? [] : getLegalMoves(newBoard, nextTurn)
      pushMove(move)
      setGame({
        board: newBoard,
        turn: nextTurn,
        legalMoves: nextLegalMoves,
        winner: w,
        status: w ? 'finished' : 'playing',
        selectedCell: null,
        endReason: w ? 'no_moves' : null,
      })
    },
    [board, turn, setGame, pushMove, mode, gameId],
  )

  // Bot AI move
  useEffect(() => {
    if (mode !== 'bot' || status !== 'playing') return
    if (turn === myColor) return

    const timer = setTimeout(() => {
      const lvlMatch = opponentName?.match(/\d+/)
      const botLevel = lvlMatch ? parseInt(lvlMatch[0]) : 5
      const move = getBestMove(board, turn, botLevel)
      if (move) executeMove(move)
    }, 300)

    return () => clearTimeout(timer)
  }, [turn, mode, myColor, board, status, opponentName, executeMove])

  // Online listeners
  useEffect(() => {
    if (mode !== 'random') return
    const s = getSocket()

    const onUpdate = (payload: {
      board: BoardT
      turn: Player
      lastMove: Move
      legalMoves: Move[]
      timeBlackMs: number
      timeWhiteMs: number
      lastMoveAt: number
    }) => {
      pushMove(payload.lastMove)
      setGame({
        board: payload.board,
        turn: payload.turn,
        legalMoves: payload.legalMoves,
        timeBlackMs: payload.timeBlackMs,
        timeWhiteMs: payload.timeWhiteMs,
        serverLastMoveAt: Date.now(),
        lastServerSyncAt: Date.now(),
        selectedCell: null,
        drawOfferFrom: null,
      })
    }

    const onEnd = (payload: EndPayload) => {
      const myColorNow = useGameStore.getState().myColor
      let myResult: 'win' | 'loss' | 'draw' = 'draw'
      let myRC: { old: number; new: number; delta: number } | null = null
      let oppRC: { old: number; new: number; delta: number } | null = null
      if (payload.ratings) {
        if (myColorNow === 'black') {
          myRC = payload.ratings.black
          oppRC = payload.ratings.white
        } else {
          myRC = payload.ratings.white
          oppRC = payload.ratings.black
        }
        if (payload.winner === 'draw') myResult = 'draw'
        else myResult = payload.winner === myColorNow ? 'win' : 'loss'
        if (profile && myRC) {
          void applyResult(myResult, myRC.new)
        }
      }
      setGame({
        status: 'finished',
        winner: payload.winner,
        endReason: payload.reason,
        legalMoves: [],
        selectedCell: null,
        myRating: myRC?.new ?? useGameStore.getState().myRating,
        opponentRating: oppRC?.new ?? useGameStore.getState().opponentRating,
        ratingChange:
          myRC && oppRC ? { mine: myRC.delta, opponent: oppRC.delta } : null,
        drawOfferFrom: null,
      })
    }

    const onChat = (m: { from: Player | 'system'; text: string; ts: number }) => {
      pushChat(m)
    }

    const onDrawOffered = (p: { from: Player }) => setGame({ drawOfferFrom: p.from })
    const onDrawDeclined = () => setGame({ drawOfferFrom: null })

    const onRematchRequested = (p: { from: Player }) =>
      setGame({ rematchOfferFrom: p.from })
    const onRematchDeclined = () =>
      setGame({ rematchOfferFrom: null, rematchDeclined: true })

    const onRematchStarted = (payload: {
      gameId: string
      board: BoardT
      turn: Player
      blackId: string
      whiteId: string
      blackName: string
      whiteName: string
      blackRating: number
      whiteRating: number
      timeBlackMs: number
      timeWhiteMs: number
      timeControl: TimeControl
    }) => {
      const sId = s.id
      const newMyColor: Player = payload.blackId === sId ? 'black' : 'white'
      const newOpponentName =
        newMyColor === 'black' ? payload.whiteName : payload.blackName
      const newOpponentRating =
        newMyColor === 'black' ? payload.whiteRating : payload.blackRating
      const newMyRating =
        newMyColor === 'black' ? payload.blackRating : payload.whiteRating
      setGame({
        gameId: payload.gameId,
        board: payload.board,
        turn: payload.turn,
        legalMoves: getLegalMoves(payload.board, payload.turn),
        status: 'playing',
        winner: null,
        endReason: null,
        myColor: newMyColor,
        opponentName: newOpponentName,
        opponentRating: newOpponentRating,
        myRating: newMyRating,
        moves: [],
        chat: [],
        ratingChange: null,
        timeControl: payload.timeControl,
        timeBlackMs: payload.timeBlackMs,
        timeWhiteMs: payload.timeWhiteMs,
        serverLastMoveAt: Date.now(),
        lastServerSyncAt: Date.now(),
        drawOfferFrom: null,
        rematchOfferFrom: null,
        rematchDeclined: false,
        selectedCell: null,
      })
    }

    const onRejected = (payload: { reason: string }) => {
      console.warn('Move rejected:', payload.reason)
    }

    const onDisconnect = () => {
      // My own socket dropped. Server has already (or will) end the game from
      // its side, but I won't receive game_end. Show a connection-lost result.
      const cur = useGameStore.getState()
      if (cur.status === 'playing') {
        setGame({
          status: 'finished',
          endReason: 'connection_lost',
          legalMoves: [],
        })
      }
    }

    s.on('game_update', onUpdate)
    s.on('game_end', onEnd)
    s.on('chat_message', onChat)
    s.on('draw_offered', onDrawOffered)
    s.on('draw_declined', onDrawDeclined)
    s.on('rematch_requested', onRematchRequested)
    s.on('rematch_declined', onRematchDeclined)
    s.on('rematch_started', onRematchStarted)
    s.on('move_rejected', onRejected)
    s.on('disconnect', onDisconnect)

    return () => {
      s.off('game_update', onUpdate)
      s.off('game_end', onEnd)
      s.off('chat_message', onChat)
      s.off('draw_offered', onDrawOffered)
      s.off('draw_declined', onDrawDeclined)
      s.off('rematch_requested', onRematchRequested)
      s.off('rematch_declined', onRematchDeclined)
      s.off('rematch_started', onRematchStarted)
      s.off('move_rejected', onRejected)
      s.off('disconnect', onDisconnect)
    }
  }, [mode, setGame, pushChat, pushMove, profile, applyResult])

  const handleCellClick = (row: number, col: number) => {
    if (status !== 'playing') return
    if ((mode === 'bot' || mode === 'random') && turn !== myColor) return

    const state = useGameStore.getState()
    const sel = state.selectedCell
    const legal = state.legalMoves

    if (sel) {
      const [fr, fc] = sel
      const move = legal.find(
        (m) => m.from[0] === fr && m.from[1] === fc && m.to[0] === row && m.to[1] === col,
      )
      if (move) {
        executeMove(move)
        return
      }
    }

    selectCell(row, col)
  }

  const handlePlayAgainLocal = () => {
    const b = getInitialBoard()
    setGame({
      board: b,
      turn: 'black',
      legalMoves: getLegalMoves(b, 'black'),
      status: 'playing',
      winner: null,
      selectedCell: null,
      moves: [],
      endReason: null,
    })
  }

  const leaveGame = () => {
    if (mode === 'random') {
      if (status === 'playing') getSocket().emit('resign', { gameId })
      disconnectSocket()
    }
    resetGame()
    navigate('/')
  }

  const handleResign = () => {
    if (mode !== 'random' || status !== 'playing') return
    if (!confirm(t('resign') + '?')) return
    getSocket().emit('resign', { gameId })
  }

  const handleOfferDraw = () => {
    if (mode !== 'random' || status !== 'playing') return
    getSocket().emit('offer_draw', { gameId })
  }

  const handleAcceptDraw = () => getSocket().emit('accept_draw', { gameId })
  const handleDeclineDraw = () => getSocket().emit('decline_draw', { gameId })

  const handleRequestRematch = () => getSocket().emit('request_rematch', { gameId })
  const handleDeclineRematch = () => getSocket().emit('decline_rematch', { gameId })

  const handleSendChat = (text: string) => {
    if (mode !== 'random') return
    getSocket().emit('chat_message', { gameId, text })
  }

  if (!gameId) {
    navigate('/')
    return null
  }

  const opponentColor: Player = myColor === 'black' ? 'white' : 'black'
  const myTime = liveTime(myColor ?? 'black')
  const oppTime = liveTime(opponentColor)
  const isUnlimited = timeControl === 'unlimited' || mode !== 'random'

  const turnLabel = (() => {
    if (status !== 'playing') return ''
    if (mode === 'random' || mode === 'bot') {
      return turn === myColor ? t('yourTurn') : t('opponentTurn')
    }
    return turn === 'black' ? '● Black' : '○ White'
  })()

  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null

  const opponentAvatar = (opponentName ?? 'O').charAt(0).toUpperCase()
  const myAvatar = (myName ?? 'You').charAt(0).toUpperCase()

  const PlayerCard = ({
    side,
    name,
    rating,
    timeMs,
    active,
  }: {
    side: 'top' | 'bottom'
    name: string
    rating: number | null
    timeMs: number
    active: boolean
  }) => (
    <div className="flex items-center justify-between bg-[#1f2937] rounded-xl border border-[#374151] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {side === 'top' ? opponentAvatar : myAvatar}
        </div>
        <div className="min-w-0">
          <div className="text-white text-sm font-medium truncate">{name}</div>
          {rating != null && (
            <div className="text-gray-400 text-xs">⭐ {rating}</div>
          )}
        </div>
      </div>
      <Clock ms={timeMs} active={active} unlimited={isUnlimited} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f1419] flex flex-col lg:flex-row">
      <main className="flex-1 flex items-center justify-center p-3 lg:p-6">
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={leaveGame}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              ← {t('home_')}
            </button>
            {mode === 'random' && (
              <div className="text-gray-500 text-xs">{timeControl}</div>
            )}
          </div>

          <div className="space-y-2">
            <PlayerCard
              side="top"
              name={opponentName ?? 'Opponent'}
              rating={mode === 'random' ? opponentRating : null}
              timeMs={oppTime}
              active={status === 'playing' && turn === opponentColor}
            />

            <div className="bg-[#16213e] rounded-2xl p-3 border border-[#0f3460]">
              {status === 'playing' && (
                <div className="text-center mb-2">
                  <span className="text-base font-bold text-white">{turnLabel}</span>
                </div>
              )}

              <Board
                board={board}
                legalMoves={legalMoves}
                selectedCell={selectedCell}
                lastMove={lastMove}
                onCellClick={handleCellClick}
                perspective={myColor ?? 'black'}
              />
            </div>

            <PlayerCard
              side="bottom"
              name={myName ?? 'You'}
              rating={mode === 'random' ? myRating : null}
              timeMs={myTime}
              active={status === 'playing' && turn === myColor}
            />

            {status === 'playing' && mode === 'random' && (
              <div className="bg-[#1f2937] rounded-xl border border-[#374151] p-2 flex gap-2">
                <button
                  onClick={handleOfferDraw}
                  disabled={drawOfferFrom === myColor}
                  className="flex-1 bg-[#374151] hover:bg-[#4b5563] disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors"
                >
                  ½ {t('offerDraw')}
                </button>
                <button
                  onClick={handleResign}
                  className="flex-1 bg-[#374151] hover:bg-red-700 text-white text-sm py-2 rounded-lg transition-colors"
                >
                  🏳 {t('resign')}
                </button>
              </div>
            )}

            {drawOfferFrom && drawOfferFrom !== myColor && status === 'playing' && (
              <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl p-3 flex items-center justify-between">
                <span className="text-yellow-200 text-sm">½ {t('drawOffered')}</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptDraw}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg"
                  >
                    {t('accept')}
                  </button>
                  <button
                    onClick={handleDeclineDraw}
                    className="bg-[#374151] hover:bg-[#4b5563] text-white text-xs px-3 py-1.5 rounded-lg"
                  >
                    {t('decline')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Side panel: moves + chat (only for online) */}
      <aside
        className={`w-full lg:w-80 shrink-0 p-3 lg:py-6 lg:pr-6 lg:pl-0 flex flex-col gap-3 lg:h-screen lg:overflow-hidden`}
      >
        <div className={`min-h-0 ${mode === 'random' ? 'h-48 lg:flex-1' : 'h-72 lg:h-96'}`}>
          <MoveList moves={moves} />
        </div>
        {mode === 'random' && (
          <div className="h-64 lg:flex-1 min-h-0">
            <ChatPanel
              messages={chat}
              myColor={myColor}
              disabled={status === 'finished'}
              onSend={handleSendChat}
            />
          </div>
        )}
      </aside>

      <GameOverModal
        open={status === 'finished'}
        myColor={myColor}
        winner={winner}
        endReason={endReason}
        isOnline={mode === 'random'}
        myName={myName ?? 'You'}
        opponentName={opponentName ?? 'Opponent'}
        myRating={myRating}
        opponentRating={opponentRating}
        ratingDelta={ratingChange?.mine ?? null}
        rematchOfferFromOpponent={
          !!rematchOfferFrom && rematchOfferFrom !== myColor
        }
        rematchPendingFromMe={rematchOfferFrom === myColor}
        rematchDeclined={rematchDeclined}
        onRematch={mode === 'random' ? handleRequestRematch : handlePlayAgainLocal}
        onDeclineRematch={handleDeclineRematch}
        onHome={leaveGame}
      />
    </div>
  )
}
