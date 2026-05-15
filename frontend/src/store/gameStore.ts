import { create } from 'zustand'
import type { Board, Move, Player } from '../engine/rules'

export type GameMode = 'random' | 'ai' | 'bot' | 'self'
export type GameStatus = 'waiting' | 'playing' | 'finished'

interface GameState {
  gameId: string | null
  board: Board
  turn: Player
  legalMoves: Move[]
  selectedCell: [number, number] | null
  status: GameStatus
  winner: Player | null
  myColor: Player | null
  opponentName: string | null
  myRating: number
  opponentRating: number
  ratingChange: number | null
  mode: GameMode | null

  setGame: (payload: Partial<GameState>) => void
  selectCell: (row: number, col: number) => void
  resetGame: () => void
}

import { getInitialBoard, getLegalMoves } from '../engine/rules'

const initialBoard = getInitialBoard()

export const useGameStore = create<GameState>((set, get) => ({
  gameId: null,
  board: initialBoard,
  turn: 'black',
  legalMoves: [],
  selectedCell: null,
  status: 'waiting',
  winner: null,
  myColor: null,
  opponentName: null,
  myRating: 1200,
  opponentRating: 1200,
  ratingChange: null,
  mode: null,

  setGame: (payload) => set((s) => ({ ...s, ...payload })),

  selectCell: (row, col) => {
    const { legalMoves, selectedCell, board, turn } = get()
    const piece = board[row][col]

    if (selectedCell) {
      const [fr, fc] = selectedCell
      const move = legalMoves.find(
        (m) => m.from[0] === fr && m.from[1] === fc && m.to[0] === row && m.to[1] === col
      )
      if (move) {
        set({ selectedCell: null })
        return move
      }
    }

    if (piece && piece.player === turn) {
      const movesForPiece = legalMoves.filter((m) => m.from[0] === row && m.from[1] === col)
      if (movesForPiece.length > 0) {
        set({ selectedCell: [row, col] })
      }
    } else {
      set({ selectedCell: null })
    }

    return null
  },

  resetGame: () =>
    set({
      gameId: null,
      board: getInitialBoard(),
      turn: 'black',
      legalMoves: [],
      selectedCell: null,
      status: 'waiting',
      winner: null,
      myColor: null,
      opponentName: null,
      ratingChange: null,
      mode: null,
    }),
}))
