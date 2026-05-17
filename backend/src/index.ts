import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { setupGameHandlers } from './handlers/gameHandlers'
import { setupMatchmaking } from './matchmaking/matchmaker'
import { gameRooms } from './game/gameRoom'
import { endGame } from './handlers/timeoutWatcher'
import { registerGameRoutes } from './api/games'

const app = express()
const httpServer = createServer(app)

// Browsers send the Origin header without a trailing slash, but env vars
// are easy to mistype as 'https://foo.example/'. Normalise so a stray
// slash (or comma-separated list) doesn't break CORS.
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const corsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
})

app.use(cors({ origin: corsOrigin }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/leaderboard', async (_req, res) => {
  res.json({ players: [] })
})

registerGameRoutes(app)

const matchmaker = setupMatchmaking(io)

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)
  setupGameHandlers(socket, io, matchmaker)

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    matchmaker.removeFromQueue(socket.id)
    for (const room of gameRooms.values()) {
      if (room.status !== 'playing') continue
      if (room.playerBlack === socket.id) {
        endGame(io, room.id, 'white', 'resign')
      } else if (room.playerWhite === socket.id) {
        endGame(io, room.id, 'black', 'resign')
      }
    }
  })
})

const PORT = process.env.PORT ?? 3001
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
