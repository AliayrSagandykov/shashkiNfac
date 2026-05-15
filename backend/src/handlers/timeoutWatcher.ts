import type { Server } from 'socket.io'
import { gameRooms, computeElo } from '../game/gameRoom'

export function endGame(
  io: Server,
  gameId: string,
  winner: 'black' | 'white' | 'draw',
  reason: 'no_moves' | 'resign' | 'timeout' | 'draw_agreed',
): void {
  const room = gameRooms.get(gameId)
  if (!room || room.status !== 'playing') return

  room.status = 'finished'
  room.winner = winner

  if (room.timeoutTimer) {
    clearTimeout(room.timeoutTimer)
    room.timeoutTimer = null
  }

  const scoreBlack = winner === 'draw' ? 0.5 : winner === 'black' ? 1 : 0
  const elo = computeElo(room.ratingBlack, room.ratingWhite, scoreBlack as 0 | 0.5 | 1)

  io.to(room.id).emit('game_end', {
    winner,
    reason,
    ratings: {
      black: {
        userId: room.userIdBlack,
        old: room.ratingBlack,
        new: elo.newA,
        delta: elo.deltaA,
      },
      white: {
        userId: room.userIdWhite,
        old: room.ratingWhite,
        new: elo.newB,
        delta: elo.deltaB,
      },
    },
  })
}

export function scheduleTimeout(io: Server, gameId: string): void {
  const room = gameRooms.get(gameId)
  if (!room || room.status !== 'playing') return
  if (room.timeoutTimer) clearTimeout(room.timeoutTimer)
  const base = room.turn === 'black' ? room.timeBlackMs : room.timeWhiteMs
  if (!isFinite(base)) return
  const elapsed = Date.now() - room.lastMoveAt
  const remaining = Math.max(0, base - elapsed)
  room.timeoutTimer = setTimeout(() => {
    const r = gameRooms.get(gameId)
    if (!r || r.status !== 'playing') return
    const flagged = r.turn
    if (flagged === 'black') r.timeBlackMs = 0
    else r.timeWhiteMs = 0
    const winner = flagged === 'black' ? 'white' : 'black'
    endGame(io, gameId, winner, 'timeout')
  }, remaining + 50)
}
