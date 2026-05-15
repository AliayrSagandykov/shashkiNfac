import { create } from 'zustand'
import type { Board, Move, Player } from '../engine/rules'
import { getInitialBoard, getLegalMoves } from '../engine/rules'

export type GameMode = 'random' | 'ai' | 'bot' | 'self'
export type GameStatus = 'waiting' | 'playing' | 'finished'
export type TimeControl = '1+0' | '3+0' | '5+0' | '10+0' | 'unlimited'

export interface ChatMsg {
  from: Player | 'system'
  text: string
  ts: number
}

export interface RatingChange {
  old: number
  new: number
  delta: number
  userId: string
}

interface GameState {
  gameId: string | null
  board: Board
  turn: Player
  legalMoves: Move[]
  selectedCell: [number, number] | null
  status: GameStatus
  winner: Player | 'draw' | null
  myColor: Player | null
  opponentName: string | null
  myName: string | null
  myRating: number
  opponentRating: number
  ratingChange: { mine: number; opponent: number } | null
  mode: GameMode | null
  endReason: 'no_moves' | 'resign' | 'opponent_left' | 'timeout' | 'draw_agreed' | null
  moves: Move[]

  timeControl: TimeControl
  timeBlackMs: number
  timeWhiteMs: number
  lastServerSyncAt: number
  serverLastMoveAt: number

  chat: ChatMsg[]

  drawOfferFrom: Player | null
  rematchOfferFrom: Player | null
  rematchDeclined: boolean

  setGame: (payload: Partial<GameState>) => void
  pushChat: (msg: ChatMsg) => void
  pushMove: (m: Move) => void
  selectCell: (row: number, col: number) => void
  resetGame: () => void
}

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
  myName: null,
  myRating: 1200,
  opponentRating: 1200,
  ratingChange: null,
  mode: null,
  endReason: null,
  moves: [],

  timeControl: 'unlimited',
  timeBlackMs: Number.POSITIVE_INFINITY,
  timeWhiteMs: Number.POSITIVE_INFINITY,
  lastServerSyncAt: 0,
  serverLastMoveAt: 0,

  chat: [],

  drawOfferFrom: null,
  rematchOfferFrom: null,
  rematchDeclined: false,

  setGame: (payload) => set((s) => ({ ...s, ...payload })),

  pushChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
  pushMove: (m) => set((s) => ({ moves: [...s.moves, m] })),

  selectCell: (row, col) => {
    const { legalMoves, selectedCell, board, turn } = get()
    const piece = board[row][col]

    if (selectedCell) {
      const [fr, fc] = selectedCell
      const move = legalMoves.find(
        (m) => m.from[0] === fr && m.from[1] === fc && m.to[0] === row && m.to[1] === col,
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
      endReason: null,
      moves: [],
      timeControl: 'unlimited',
      timeBlackMs: Number.POSITIVE_INFINITY,
      timeWhiteMs: Number.POSITIVE_INFINITY,
      chat: [],
      drawOfferFrom: null,
      rematchOfferFrom: null,
      rematchDeclined: false,
    }),
}))
