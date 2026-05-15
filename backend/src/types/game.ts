import type { Board, Move, Player } from '../engine/rules'

export interface GameRoom {
  id: string
  playerBlack: string
  playerWhite: string
  board: Board
  turn: Player
  status: 'playing' | 'finished'
  winner: Player | null
  moves: Move[]
  createdAt: number
}

export interface QueueEntry {
  socketId: string
  userId: string
  rating: number
  joinedAt: number
}
