import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { setupGameHandlers } from './handlers/gameHandlers'
import { setupMatchmaking } from './matchmaking/matchmaker'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
})

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/leaderboard', async (_req, res) => {
  res.json({ players: [] })
})

const matchmaker = setupMatchmaking(io)

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)
  setupGameHandlers(socket, io, matchmaker)

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    matchmaker.removeFromQueue(socket.id)
  })
})

const PORT = process.env.PORT ?? 3001
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
