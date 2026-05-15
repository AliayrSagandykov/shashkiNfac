import type { Board, Move, Player } from '../engine/rules'

export type TimeControl = '1+0' | '3+0' | '5+0' | '10+0' | 'unlimited'

export interface ChatMessage {
  from: Player | 'system'
  text: string
  ts: number
}

export interface GameRoom {
  id: string
  playerBlack: string
  playerWhite: string
  userIdBlack: string
  userIdWhite: string
  usernameBlack: string
  usernameWhite: string
  ratingBlack: number
  ratingWhite: number
  board: Board
  turn: Player
  status: 'playing' | 'finished'
  winner: Player | 'draw' | null
  moves: Move[]
  createdAt: number
  timeControl: TimeControl
  timeBlackMs: number
  timeWhiteMs: number
  lastMoveAt: number
  drawOfferBy: Player | null
  rematchVotes: Set<Player>
  chat: ChatMessage[]
  timeoutTimer: NodeJS.Timeout | null
}

export interface QueueEntry {
  socketId: string
  userId: string
  username: string
  rating: number
  joinedAt: number
  timeControl: TimeControl
}

export function timeControlToMs(tc: TimeControl): number {
  switch (tc) {
    case '1+0': return 60_000
    case '3+0': return 180_000
    case '5+0': return 300_000
    case '10+0': return 600_000
    case 'unlimited': return Number.POSITIVE_INFINITY
  }
}
