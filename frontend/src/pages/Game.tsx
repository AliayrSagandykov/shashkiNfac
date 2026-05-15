import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import Board from '../components/Board'
import { applyMove, checkWinner, getLegalMoves, getInitialBoard } from '../engine/rules'
import { getBestMove } from '../engine/ai'
import type { Move, Board as BoardT, Player } from '../engine/rules'
import { getSocket, disconnectSocket } from '../services/socket'

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
    mode,
    endReason,
    setGame,
    selectCell,
    resetGame,
  } = useGameStore()

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

      setGame({
        board: newBoard,
        turn: nextTurn,
        legalMoves: nextLegalMoves,
        winner: w,
        status: w ? 'finished' : 'playing',
        selectedCell: null,
      })
    },
    [board, turn, setGame, mode, gameId]
  )

  // Online multiplayer: listen for server-authoritative updates
  useEffect(() => {
    if (mode !== 'random') return
    const s = getSocket()

    const onUpdate = (payload: {
      board: BoardT
      turn: Player
      lastMove: Move
      legalMoves: Move[]
    }) => {
      setGame({
        board: payload.board,
        turn: payload.turn,
        legalMoves: payload.legalMoves,
        selectedCell: null,
      })
    }

    const onEnd = (payload: { winner: Player; reason: 'no_moves' | 'resign' }) => {
      setGame({
        status: 'finished',
        winner: payload.winner,
        endReason: payload.reason,
        legalMoves: [],
        selectedCell: null,
      })
    }

    const onRejected = (payload: { reason: string }) => {
      console.warn('Move rejected:', payload.reason)
    }

    const onDisconnect = () => {
      setGame({
        status: 'finished',
        endReason: 'opponent_left',
        legalMoves: [],
      })
    }

    s.on('game_update', onUpdate)
    s.on('game_end', onEnd)
    s.on('move_rejected', onRejected)
    s.on('disconnect', onDisconnect)

    return () => {
      s.off('game_update', onUpdate)
      s.off('game_end', onEnd)
      s.off('move_rejected', onRejected)
      s.off('disconnect', onDisconnect)
    }
  }, [mode, setGame])

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

  const handleCellClick = (row: number, col: number) => {
    if (status !== 'playing') return
    if ((mode === 'bot' || mode === 'random') && turn !== myColor) return

    const state = useGameStore.getState()
    const sel = state.selectedCell
    const legal = state.legalMoves

    if (sel) {
      const [fr, fc] = sel
      const move = legal.find(
        (m) => m.from[0] === fr && m.from[1] === fc && m.to[0] === row && m.to[1] === col
      )
      if (move) {
        executeMove(move)
        return
      }
    }

    selectCell(row, col)
  }

  const handlePlayAgain = () => {
    const b = getInitialBoard()
    setGame({
      board: b,
      turn: 'black',
      legalMoves: getLegalMoves(b, 'black'),
      status: 'playing',
      winner: null,
      selectedCell: null,
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
    if (!confirm('Resign this game?')) return
    getSocket().emit('resign', { gameId })
  }

  if (!gameId) {
    navigate('/')
    return null
  }

  const youWon = status === 'finished' && winner === myColor
  const displayTurn =
    status === 'finished'
      ? endReason === 'opponent_left'
        ? 'Opponent disconnected'
        : `${winner === 'black' ? 'Black' : 'White'} wins!${
            mode === 'random' ? (youWon ? ' (you)' : ' (opponent)') : ''
          }${endReason === 'resign' ? ' — by resignation' : ''}`
      : turn === myColor && (mode === 'random' || mode === 'bot')
      ? 'Your turn'
      : mode === 'random'
      ? "Opponent's turn"
      : `${turn === 'black' ? 'Black' : 'White'}'s turn`

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={leaveGame}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            ← Back
          </button>
          <div className="text-white font-semibold flex items-center gap-3">
            <span>{opponentName}</span>
            {mode === 'random' && status === 'playing' && (
              <button
                onClick={handleResign}
                className="text-red-400 hover:text-red-300 text-sm border border-red-900 hover:border-red-500 px-3 py-1 rounded-lg transition-colors"
              >
                Resign
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#16213e] rounded-2xl p-4 border border-[#0f3460]">
          <div className="text-center mb-4">
            <span
              className={`text-lg font-bold ${
                status === 'finished' ? 'text-yellow-400' : 'text-white'
              }`}
            >
              {displayTurn}
            </span>
          </div>

          <Board
            board={board}
            legalMoves={legalMoves}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            perspective={myColor ?? 'black'}
          />

          {status === 'finished' && (
            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={leaveGame}
                className="bg-[#0f3460] hover:bg-[#1a4a7a] text-white px-6 py-2 rounded-xl transition-colors"
              >
                Home
              </button>
              {mode !== 'random' && (
              <button
                onClick={handlePlayAgain}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl transition-colors"
              >
                Play Again
              </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
