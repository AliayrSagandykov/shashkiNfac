import type { Express, Request, Response } from 'express'
import { getSupabase } from '../services/supabase'
import { analyzeGame } from '../analysis/analyzer'
import type { Move } from '../engine/rules'

const ANALYSIS_DEPTH_DEFAULT = 8
const ANALYSIS_TIME_BUDGET_PER_PLY = 1500

// In-flight analyses (gameId -> promise) so duplicate clicks share work.
const inFlight = new Map<string, Promise<unknown>>()

export function registerGameRoutes(app: Express): void {
  app.get('/api/games/recent', async (req: Request, res: Response) => {
    const supabase = getSupabase()
    if (!supabase) return res.json({ games: [] })
    const userId = String(req.query.userId ?? '')
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100)
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const { data, error } = await supabase
      .from('games')
      .select(
        'id, played_at, white_id, black_id, white_name, black_name, white_rating_after, black_rating_after, time_control, winner, end_reason',
      )
      .or(`white_id.eq.${userId},black_id.eq.${userId}`)
      .order('played_at', { ascending: false })
      .limit(limit)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ games: data ?? [] })
  })

  app.get('/api/games/:id', async (req: Request, res: Response) => {
    const supabase = getSupabase()
    if (!supabase) return res.status(503).json({ error: 'storage_unavailable' })
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!game) return res.status(404).json({ error: 'not_found' })
    const { data: analysis } = await supabase
      .from('game_analyses')
      .select('depth, data, created_at')
      .eq('game_id', req.params.id)
      .maybeSingle()
    res.json({ game, analysis: analysis ?? null })
  })

  app.post('/api/games/:id/analyze', async (req: Request, res: Response) => {
    const supabase = getSupabase()
    if (!supabase) return res.status(503).json({ error: 'storage_unavailable' })
    const gameId = req.params.id

    // Already analyzed?
    const existing = await supabase
      .from('game_analyses')
      .select('depth, data, created_at')
      .eq('game_id', gameId)
      .maybeSingle()
    if (existing.data) {
      return res.json({ analysis: existing.data, cached: true })
    }

    // Already running?
    const running = inFlight.get(gameId)
    if (running) {
      try {
        const result = await running
        return res.json({ analysis: result, cached: false })
      } catch (e) {
        return res.status(500).json({ error: e instanceof Error ? e.message : 'analysis_failed' })
      }
    }

    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('moves')
      .eq('id', gameId)
      .maybeSingle()
    if (gameErr) return res.status(500).json({ error: gameErr.message })
    if (!game) return res.status(404).json({ error: 'not_found' })

    const depth = Number(req.body?.depth) || ANALYSIS_DEPTH_DEFAULT
    const moves = (game.moves as Move[]) ?? []

    const promise = (async () => {
      const analysis = await analyzeGame(moves, depth, ANALYSIS_TIME_BUDGET_PER_PLY)
      const { error: saveErr } = await supabase
        .from('game_analyses')
        .insert({ game_id: gameId, depth, data: analysis })
      if (saveErr) console.error('save analysis error', saveErr)
      return analysis
    })()

    inFlight.set(gameId, promise)
    try {
      const analysis = await promise
      // Bump quota for the requester if they passed userId.
      const userId = String(req.body?.userId ?? '')
      if (userId) {
        // Best-effort increment; we don't have a stored function so do read/write.
        const { data: prof } = await supabase
          .from('profiles')
          .select('analyses_used')
          .eq('id', userId)
          .maybeSingle()
        if (prof) {
          await supabase
            .from('profiles')
            .update({ analyses_used: (prof.analyses_used ?? 0) + 1 })
            .eq('id', userId)
        }
      }
      res.json({ analysis, cached: false })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'analysis_failed' })
    } finally {
      inFlight.delete(gameId)
    }
  })
}
