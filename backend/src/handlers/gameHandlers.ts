import type { Socket, Server } from 'socket.io'
import type { Matchmaker } from '../matchmaking/matchmaker'
import type { Move } from '../engine/rules'
import type { TimeControl, GameRoom } from '../types/game'
import { getLegalMoves, applyMove, checkWinner, getInitialBoard } from '../engine/rules'
import { gameRooms, timeLeftFor } from '../game/gameRoom'
import { endGame, scheduleTimeout } from './timeoutWatcher'
import { timeControlToMs } from '../types/game'

function colorOf(socketId: string, room: GameRoom | undefined): 'black' | 'white' | null {
  if (!room) return null
  if (room.playerBlack === socketId) return 'black'
  if (room.playerWhite === socketId) return 'white'
  return null
}

export function setupGameHandlers(socket: Socket, io: Server, matchmaker: Matchmaker) {
  socket.on(
    'join_queue',
    (data: {
      userId: string
      username?: string
      avatarUrl?: string | null
      rating?: number
      timeControl?: TimeControl
    }) => {
      matchmaker.addToQueue({
        socketId: socket.id,
        userId: data?.userId ?? socket.id,
        username: data?.username ?? 'Player',
        avatarUrl: data?.avatarUrl ?? null,
        rating: data?.rating ?? 1200,
        joinedAt: Date.now(),
        timeControl: data?.timeControl ?? '5+0',
      })
      socket.emit('queue_joined')
    },
  )

  socket.on('leave_queue', () => {
    matchmaker.removeFromQueue(socket.id)
    socket.emit('queue_left')
  })

  socket.on('make_move', (data: { gameId: string; move: Move }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing') return

    const color = colorOf(socket.id, room)
    if (!color || color !== room.turn) return

    const legalMoves = getLegalMoves(room.board, room.turn)
    const isLegal = legalMoves.some(
      (m) =>
        m.from[0] === data.move.from[0] &&
        m.from[1] === data.move.from[1] &&
        m.to[0] === data.move.to[0] &&
        m.to[1] === data.move.to[1],
    )
    if (!isLegal) {
      socket.emit('move_rejected', { reason: 'illegal_move' })
      return
    }

    const now = Date.now()
    const elapsed = now - room.lastMoveAt
    if (isFinite(room.timeBlackMs) && isFinite(room.timeWhiteMs)) {
      if (color === 'black') room.timeBlackMs = Math.max(0, room.timeBlackMs - elapsed)
      else room.timeWhiteMs = Math.max(0, room.timeWhiteMs - elapsed)
    }

    const newBoard = applyMove(room.board, data.move)
    const nextTurn = room.turn === 'black' ? 'white' : 'black'
    const noMovesWinner = checkWinner(newBoard, nextTurn)

    room.board = newBoard
    room.turn = nextTurn
    room.moves.push(data.move)
    room.lastMoveAt = now
    room.drawOfferBy = null

    io.to(room.id).emit('game_update', {
      board: newBoard,
      turn: nextTurn,
      lastMove: data.move,
      legalMoves: noMovesWinner ? [] : getLegalMoves(newBoard, nextTurn),
      timeBlackMs: timeLeftFor(room, 'black'),
      timeWhiteMs: timeLeftFor(room, 'white'),
      lastMoveAt: room.lastMoveAt,
    })

    if (noMovesWinner) {
      endGame(io, room.id, noMovesWinner, 'no_moves')
    } else {
      scheduleTimeout(io, room.id)
    }
  })

  socket.on('resign', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing') return
    const color = colorOf(socket.id, room)
    if (!color) return
    const winner = color === 'black' ? 'white' : 'black'
    endGame(io, room.id, winner, 'resign')
  })

  socket.on('offer_draw', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing') return
    const color = colorOf(socket.id, room)
    if (!color) return
    room.drawOfferBy = color
    io.to(room.id).emit('draw_offered', { from: color })
  })

  socket.on('decline_draw', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing' || !room.drawOfferBy) return
    const color = colorOf(socket.id, room)
    if (!color || color === room.drawOfferBy) return
    room.drawOfferBy = null
    io.to(room.id).emit('draw_declined')
  })

  socket.on('accept_draw', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'playing' || !room.drawOfferBy) return
    const color = colorOf(socket.id, room)
    if (!color || color === room.drawOfferBy) return
    endGame(io, room.id, 'draw', 'draw_agreed')
  })

  socket.on('chat_message', (data: { gameId: string; text: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room) return
    const color = colorOf(socket.id, room)
    if (!color) return
    const text = (data.text ?? '').trim().slice(0, 200)
    if (!text) return
    const msg = { from: color, text, ts: Date.now() } as const
    room.chat.push({ ...msg })
    io.to(room.id).emit('chat_message', msg)
  })

  socket.on('request_rematch', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room || room.status !== 'finished') return
    const color = colorOf(socket.id, room)
    if (!color) return

    room.rematchVotes.add(color)
    io.to(room.id).emit('rematch_requested', { from: color })

    if (room.rematchVotes.size === 2) {
      const newBlackSocket = room.playerWhite
      const newWhiteSocket = room.playerBlack
      const newBlackUserId = room.userIdWhite
      const newWhiteUserId = room.userIdBlack
      const newBlackName = room.usernameWhite
      const newWhiteName = room.usernameBlack
      const newBlackAvatar = room.avatarWhite
      const newWhiteAvatar = room.avatarBlack
      const newBlackRating = room.ratingWhite
      const newWhiteRating = room.ratingBlack

      const ms = timeControlToMs(room.timeControl)
      const now = Date.now()
      room.playerBlack = newBlackSocket
      room.playerWhite = newWhiteSocket
      room.userIdBlack = newBlackUserId
      room.userIdWhite = newWhiteUserId
      room.usernameBlack = newBlackName
      room.usernameWhite = newWhiteName
      room.avatarBlack = newBlackAvatar
      room.avatarWhite = newWhiteAvatar
      room.ratingBlack = newBlackRating
      room.ratingWhite = newWhiteRating
      room.board = getInitialBoard()
      room.turn = 'black'
      room.status = 'playing'
      room.winner = null
      room.moves = []
      room.timeBlackMs = ms
      room.timeWhiteMs = ms
      room.lastMoveAt = now
      room.drawOfferBy = null
      room.rematchVotes.clear()
      room.chat = []

      io.to(room.id).emit('rematch_started', {
        gameId: room.id,
        board: room.board,
        turn: room.turn,
        blackId: room.playerBlack,
        whiteId: room.playerWhite,
        blackName: room.usernameBlack,
        whiteName: room.usernameWhite,
        blackAvatar: room.avatarBlack,
        whiteAvatar: room.avatarWhite,
        blackRating: room.ratingBlack,
        whiteRating: room.ratingWhite,
        timeBlackMs: room.timeBlackMs,
        timeWhiteMs: room.timeWhiteMs,
        timeControl: room.timeControl,
      })

      scheduleTimeout(io, room.id)
    }
  })

  socket.on('decline_rematch', (data: { gameId: string }) => {
    const room = gameRooms.get(data.gameId)
    if (!room) return
    room.rematchVotes.clear()
    io.to(room.id).emit('rematch_declined')
  })
}
