import type { Server } from 'socket.io'
import { gameRooms, computeElo } from '../game/gameRoom'
import { getSupabase } from '../services/supabase'

async function persistGame(
  roomId: string,
  winner: 'white' | 'black' | 'draw',
  reason: 'no_moves' | 'resign' | 'timeout' | 'draw_agreed',
  newRatingBlack: number,
  newRatingWhite: number,
  oldRatingBlack: number,
  oldRatingWhite: number,
): Promise<string | null> {
  const room = gameRooms.get(roomId)
  if (!room) return null
  const supabase = getSupabase()
  if (!supabase) return null

  const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

  const row = {
    white_id: isUuid(room.userIdWhite) ? room.userIdWhite : null,
    black_id: isUuid(room.userIdBlack) ? room.userIdBlack : null,
    white_name: room.usernameWhite,
    black_name: room.usernameBlack,
    white_rating: oldRatingWhite,
    black_rating: oldRatingBlack,
    white_rating_after: newRatingWhite,
    black_rating_after: newRatingBlack,
    time_control: room.timeControl,
    mode: 'random',
    winner,
    end_reason: reason,
    moves: room.moves,
  }
  const { data, error } = await supabase
    .from('games')
    .insert(row)
    .select('id')
    .single()
  if (error) {
    console.error('persistGame insert error', error)
    return null
  }
  return (data as { id: string }).id
}

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

  const oldBlack = room.ratingBlack
  const oldWhite = room.ratingWhite
  room.ratingBlack = elo.newA
  room.ratingWhite = elo.newB

  io.to(room.id).emit('game_end', {
    winner,
    reason,
    ratings: {
      black: {
        userId: room.userIdBlack,
        old: oldBlack,
        new: elo.newA,
        delta: elo.deltaA,
      },
      white: {
        userId: room.userIdWhite,
        old: oldWhite,
        new: elo.newB,
        delta: elo.deltaB,
      },
    },
  })

  // Fire-and-forget persistence — never blocks the game-end response.
  void persistGame(gameId, winner, reason, elo.newA, elo.newB, oldBlack, oldWhite).then((dbId) => {
    if (dbId) io.to(gameId).emit('game_persisted', { dbId })
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
