import type { Move } from '../engine/rules'

const BASE = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001') as string

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface MoveAnalysis {
  ply: number
  player: 'white' | 'black'
  played: Move
  best: Move | null
  evalBeforeWhite: number
  evalAfterWhite: number
  loss: number
  classification: MoveClass
}

export interface KeyMoment {
  ply: number
  player: 'white' | 'black'
  classification: MoveClass
  loss: number
}

export interface GameAnalysis {
  depth: number
  moves: MoveAnalysis[]
  evalGraph: number[]
  whiteAccuracy: number
  blackAccuracy: number
  keyMoments: KeyMoment[]
}

export interface SavedGame {
  id: string
  played_at: string
  white_id: string | null
  black_id: string | null
  white_name: string
  black_name: string
  white_rating: number | null
  black_rating: number | null
  white_rating_after: number | null
  black_rating_after: number | null
  time_control: string
  mode: string
  winner: 'white' | 'black' | 'draw' | null
  end_reason: string | null
  moves: Move[]
}

export async function fetchRecentGames(userId: string, limit = 20): Promise<SavedGame[]> {
  const res = await fetch(`${BASE}/api/games/recent?userId=${encodeURIComponent(userId)}&limit=${limit}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.games as SavedGame[]
}

export async function fetchGame(id: string): Promise<{ game: SavedGame; analysis: GameAnalysis | null } | null> {
  const res = await fetch(`${BASE}/api/games/${id}`)
  if (!res.ok) return null
  return (await res.json()) as { game: SavedGame; analysis: GameAnalysis | null }
}

export type AnalysisError =
  | { kind: 'quota_exceeded'; nextAvailableAt?: string }
  | { kind: 'failed'; message?: string }

export async function requestAnalysis(
  id: string,
  userId?: string,
  depth?: number,
): Promise<{ analysis: GameAnalysis } | { error: AnalysisError }> {
  const res = await fetch(`${BASE}/api/games/${id}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, depth }),
  })
  if (res.status === 402) {
    const body = await res.json().catch(() => ({}))
    return { error: { kind: 'quota_exceeded', nextAvailableAt: body?.nextAvailableAt } }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: { kind: 'failed', message: body?.error } }
  }
  const data = await res.json()
  return { analysis: data.analysis as GameAnalysis }
}
