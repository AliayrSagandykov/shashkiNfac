import type { Express, Request, Response } from 'express'
import { getSupabase } from '../services/supabase'
import { analyzeGame } from '../analysis/analyzer'
import type { Move } from '../engine/rules'

const ANALYSIS_DEPTH_DEFAULT = 6
const ANALYSIS_TIME_BUDGET_PER_PLY = 600
// Render free tier kills any HTTP request that takes more than ~100s, with
// no response (so the browser sees a missing CORS header). Stop analysing
// before that so we always return *something*.
const ANALYSIS_TOTAL_BUDGET_MS = 75_000

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
      .from('match_history')
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
      .from('match_history')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!game) return res.status(404).json({ error: 'not_found' })
    const { data: analysis } = await supabase
      .from('match_analyses')
      .select('depth, data, created_at')
      .eq('match_id', req.params.id)
      .maybeSingle()
    res.json({ game, analysis: analysis ?? null })
  })

  app.post('/api/games/:id/analyze', async (req: Request, res: Response) => {
    const supabase = getSupabase()
    if (!supabase) return res.status(503).json({ error: 'storage_unavailable' })
    const gameId = req.params.id

    // Already analyzed?
    const existing = await supabase
      .from('match_analyses')
      .select('depth, data, created_at')
      .eq('match_id', gameId)
      .maybeSingle()
    if (existing.data) {
      return res.json({ analysis: existing.data, cached: true })
    }

    // Already running? Register the in-flight slot BEFORE any awaits below
    // so concurrent callers can dedupe instead of starting parallel work.
    let promise = inFlight.get(gameId)
    if (!promise) {
      const depth = Number(req.body?.depth) || ANALYSIS_DEPTH_DEFAULT
      promise = (async () => {
        const { data: game, error: gameErr } = await supabase
          .from('match_history')
          .select('moves')
          .eq('id', gameId)
          .maybeSingle()
        if (gameErr) throw new Error(gameErr.message)
        if (!game) throw new Error('not_found')
        const moves = (game.moves as Move[]) ?? []
        const analysis = await analyzeGame(
          moves,
          depth,
          ANALYSIS_TIME_BUDGET_PER_PLY,
          undefined,
          ANALYSIS_TOTAL_BUDGET_MS,
        )
        const { error: saveErr } = await supabase
          .from('match_analyses')
          .insert({ match_id: gameId, depth, data: analysis })
        if (saveErr) console.error('save analysis error', saveErr)
        return analysis
      })()
      inFlight.set(gameId, promise)
    }

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
