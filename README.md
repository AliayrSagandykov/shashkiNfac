# Checkers Platform

International draughts platform built with React, Node.js, and Supabase.

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS + Zustand
- **Backend**: Node.js + TypeScript + Express + Socket.io
- **Database/Auth**: Supabase (PostgreSQL + Google OAuth)

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project

### Frontend

```bash
cd frontend
cp .env.example .env
# Fill in your Supabase URL and anon key
npm install
npm run dev
```

### Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase service key
npm install
npm run dev
```

## Game Modes

| Mode | Auth Required |
|------|--------------|
| Play Yourself | No |
| Play vs Bot | No |
| Play Random Player | Yes |
| Play vs AI | Yes |

## Project Structure

```
frontend/src/
  pages/         Login, Home, Game
  components/    Board, Piece, Timer
  engine/        rules.ts (international draughts), ai.ts (minimax)
  store/         authStore, gameStore (Zustand)
  services/      supabase.ts, socket.ts

backend/src/
  engine/        rules.ts (server-authoritative validation)
  game/          gameRoom.ts
  handlers/      gameHandlers.ts (socket events)
  matchmaking/   matchmaker.ts
  types/         game.ts
```
