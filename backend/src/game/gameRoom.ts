import type { GameRoom } from '../types/game'
import { getInitialBoard } from '../engine/rules'

export const gameRooms = new Map<string, GameRoom>()

export function createGameRoom(blackSocketId: string, whiteSocketId: string): GameRoom {
  const board = getInitialBoard()
  return {
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    playerBlack: blackSocketId,
    playerWhite: whiteSocketId,
    board,
    turn: 'black',
    status: 'playing',
    winner: null,
    moves: [],
    createdAt: Date.now(),
  }
}
