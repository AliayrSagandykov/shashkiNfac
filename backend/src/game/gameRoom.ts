import type { GameRoom, TimeControl } from '../types/game'
import { getInitialBoard } from '../engine/rules'
import { timeControlToMs } from '../types/game'

export const gameRooms = new Map<string, GameRoom>()

export interface CreateGameRoomInput {
  blackSocketId: string
  whiteSocketId: string
  userIdBlack: string
  userIdWhite: string
  usernameBlack: string
  usernameWhite: string
  ratingBlack: number
  ratingWhite: number
  timeControl: TimeControl
}

export function createGameRoom(input: CreateGameRoomInput): GameRoom {
  const board = getInitialBoard()
  const ms = timeControlToMs(input.timeControl)
  const now = Date.now()
  return {
    id: `game-${now}-${Math.random().toString(36).slice(2, 7)}`,
    playerBlack: input.blackSocketId,
    playerWhite: input.whiteSocketId,
    userIdBlack: input.userIdBlack,
    userIdWhite: input.userIdWhite,
    usernameBlack: input.usernameBlack,
    usernameWhite: input.usernameWhite,
    ratingBlack: input.ratingBlack,
    ratingWhite: input.ratingWhite,
    board,
    turn: 'black',
    status: 'playing',
    winner: null,
    moves: [],
    createdAt: now,
    timeControl: input.timeControl,
    timeBlackMs: ms,
    timeWhiteMs: ms,
    lastMoveAt: now,
    drawOfferBy: null,
    rematchVotes: new Set(),
    chat: [],
    timeoutTimer: null,
  }
}

export function timeLeftFor(room: GameRoom, color: 'black' | 'white'): number {
  const base = color === 'black' ? room.timeBlackMs : room.timeWhiteMs
  if (!isFinite(base)) return base
  if (room.status !== 'playing') return base
  if (room.turn !== color) return base
  const elapsed = Date.now() - room.lastMoveAt
  return Math.max(0, base - elapsed)
}

export function computeElo(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 0.5 | 1,
  k = 32,
): { newA: number; newB: number; deltaA: number; deltaB: number } {
  const expA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  const expB = 1 - expA
  const scoreB = (1 - scoreA) as 0 | 0.5 | 1
  const deltaA = Math.round(k * (scoreA - expA))
  const deltaB = Math.round(k * (scoreB - expB))
  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
    deltaA,
    deltaB,
  }
}
