import type { Server } from 'socket.io'
import type { QueueEntry } from '../types/game'
import { createGameRoom, gameRooms } from '../game/gameRoom'

export interface Matchmaker {
  addToQueue: (entry: QueueEntry) => void
  removeFromQueue: (socketId: string) => void
}

export function setupMatchmaking(io: Server): Matchmaker {
  const queue: QueueEntry[] = []

  const tick = () => {
    queue.sort((a, b) => a.rating - b.rating)
    const paired = new Set<string>()

    for (let i = 0; i < queue.length - 1; i++) {
      if (paired.has(queue[i].socketId)) continue
      for (let j = i + 1; j < queue.length; j++) {
        if (paired.has(queue[j].socketId)) continue
        if (Math.abs(queue[i].rating - queue[j].rating) <= 200) {
          paired.add(queue[i].socketId)
          paired.add(queue[j].socketId)
          createMatch(queue[i], queue[j])
          break
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
    const room = createGameRoom(black.socketId, white.socketId)
    gameRooms.set(room.id, room)

    io.sockets.sockets.get(black.socketId)?.join(room.id)
    io.sockets.sockets.get(white.socketId)?.join(room.id)

    io.to(room.id).emit('match_found', {
      gameId: room.id,
      blackId: black.socketId,
      whiteId: white.socketId,
    })

    io.to(room.id).emit('game_start', {
      gameId: room.id,
      board: room.board,
      turn: room.turn,
    })
  }

  setInterval(tick, 2000)

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
