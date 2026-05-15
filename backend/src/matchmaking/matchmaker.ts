import type { Server } from 'socket.io'
import type { QueueEntry, TimeControl } from '../types/game'
import { createGameRoom, gameRooms } from '../game/gameRoom'
import { scheduleTimeout } from '../handlers/timeoutWatcher'

export interface Matchmaker {
  addToQueue: (entry: QueueEntry) => void
  removeFromQueue: (socketId: string) => void
}

export function setupMatchmaking(io: Server): Matchmaker {
  const queue: QueueEntry[] = []

  const tick = () => {
    const byTc = new Map<TimeControl, QueueEntry[]>()
    for (const e of queue) {
      const arr = byTc.get(e.timeControl) ?? []
      arr.push(e)
      byTc.set(e.timeControl, arr)
    }

    const paired = new Set<string>()

    for (const bucket of byTc.values()) {
      bucket.sort((a, b) => a.rating - b.rating)
      for (let i = 0; i < bucket.length - 1; i++) {
        if (paired.has(bucket[i].socketId)) continue
        for (let j = i + 1; j < bucket.length; j++) {
          if (paired.has(bucket[j].socketId)) continue
          const waitedSec = (Date.now() - bucket[i].joinedAt) / 1000
          const tolerance = 200 + Math.floor(waitedSec / 5) * 100
          if (Math.abs(bucket[i].rating - bucket[j].rating) <= tolerance) {
            paired.add(bucket[i].socketId)
            paired.add(bucket[j].socketId)
            createMatch(bucket[i], bucket[j])
            break
          }
        }
      }
    }

    for (const id of paired) {
      const idx = queue.findIndex((e) => e.socketId === id)
      if (idx !== -1) queue.splice(idx, 1)
    }
  }

  const createMatch = (p1: QueueEntry, p2: QueueEntry) => {
    const [black, white] = Math.random() < 0.5 ? [p1, p2] : [p2, p1]
    const room = createGameRoom({
      blackSocketId: black.socketId,
      whiteSocketId: white.socketId,
      userIdBlack: black.userId,
      userIdWhite: white.userId,
      usernameBlack: black.username,
      usernameWhite: white.username,
      ratingBlack: black.rating,
      ratingWhite: white.rating,
      timeControl: black.timeControl,
    })
    gameRooms.set(room.id, room)

    io.sockets.sockets.get(black.socketId)?.join(room.id)
    io.sockets.sockets.get(white.socketId)?.join(room.id)

    io.to(room.id).emit('match_found', {
      gameId: room.id,
      blackId: black.socketId,
      whiteId: white.socketId,
      blackName: black.username,
      whiteName: white.username,
      blackRating: black.rating,
      whiteRating: white.rating,
      timeControl: room.timeControl,
    })

    io.to(room.id).emit('game_start', {
      gameId: room.id,
      board: room.board,
      turn: room.turn,
      timeBlackMs: room.timeBlackMs,
      timeWhiteMs: room.timeWhiteMs,
      timeControl: room.timeControl,
    })

    scheduleTimeout(io, room.id)
  }

  setInterval(tick, 1000)

  return {
    addToQueue: (entry) => {
      if (!queue.find((e) => e.socketId === entry.socketId)) queue.push(entry)
    },
    removeFromQueue: (socketId) => {
      const idx = queue.findIndex((e) => e.socketId === socketId)
      if (idx !== -1) queue.splice(idx, 1)
    },
  }
}
