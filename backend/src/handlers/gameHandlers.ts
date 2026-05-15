import type { Socket, Server } from 'socket.io'
import type { Matchmaker } from '../matchmaking/matchmaker'
import type { Move } from '../engine/rules'
import { getLegalMoves, applyMove, checkWinner } from '../engine/rules'
import { gameRooms } from '../game/gameRoom'

export function setupGameHandlers(socket: Socket, io: Server, matchmaker: Matchmaker) {
  socket.on('join_queue', (data: { userId: string; rating: number }) => {
    matchmaker.addToQueue({
      socketId: socket.id,
      userId: data?.userId ?? socket.id,
      rating: data?.rating ?? 1200,
      joinedAt: Date.now(),
    })
    socket.emit('queue_joined')
  })

  socket.on('leave_queue', () => {
    matchmaker.removeFromQueue(socket.id)
    socket.emit('queue_left')
  })

  socket.on('make_move', (data: { gameId: string; move: Move }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing') return

    const isBlack = room.playerBlack === socket.id
    const isWhite = room.playerWhite === socket.id
    if (!isBlack && !isWhite) return
    if (isBlack && room.turn !== 'black') return
    if (isWhite && room.turn !== 'white') return

    const legalMoves = getLegalMoves(room.board, room.turn)
    const isLegal = legalMoves.some(
      (m) =>
        m.from[0] === data.move.from[0] &&
        m.from[1] === data.move.from[1] &&
        m.to[0] === data.move.to[0] &&
        m.to[1] === data.move.to[1]
    )
    if (!isLegal) {
      socket.emit('move_rejected', { reason: 'illegal_move' })
      return
    }

    const newBoard = applyMove(room.board, data.move)
    const nextTurn = room.turn === 'black' ? 'white' : 'black'
    const winner = checkWinner(newBoard, nextTurn)

    room.board = newBoard
    room.turn = nextTurn
    room.moves.push(data.move)

    if (winner) {
      room.status = 'finished'
      room.winner = winner
    }

    io.to(room.id).emit('game_update', {
      board: newBoard,
      turn: nextTurn,
      lastMove: data.move,
      legalMoves: winner ? [] : getLegalMoves(newBoard, nextTurn),
    })

    if (winner) {
      io.to(room.id).emit('game_end', { winner, reason: 'no_moves' })
    }
  })

  socket.on('resign', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing') return

    const winner = room.playerBlack === socket.id ? 'white' : 'black'
    room.status = 'finished'
    room.winner = winner

    io.to(room.id).emit('game_end', { winner, reason: 'resign' })
  })
}
