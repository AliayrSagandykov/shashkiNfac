import type { Board, Move, Player } from './rules'
import { applyMove, checkWinner, getLegalMoves } from './rules'

// Eval is from white's perspective (positive = white better).
// Material: man = 100, king = 300; small positional bonus for advancement.

function materialEval(board: Board): number {
  let score = 0
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const p = board[r][c]
      if (!p) continue
      const base = p.type === 'king' ? 300 : 100
      const dir = p.player === 'white' ? 1 : -1
      // Small advancement bonus for men (encourage progress toward promotion).
      const advance = p.type === 'man' ? (p.player === 'white' ? r : 9 - r) * 2 : 0
      score += dir * (base + advance)
    }
  }
  return score
}

const WIN = 1_000_000

function hash(board: Board, toMove: Player): string {
  // Compact key: 100 chars + side. Fast enough for transposition table.
  let s = toMove
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const p = board[r][c]
      if (!p) s += '.'
      else if (p.player === 'white') s += p.type === 'king' ? 'W' : 'w'
      else s += p.type === 'king' ? 'B' : 'b'
    }
  }
  return s
}

type TTFlag = 'exact' | 'lower' | 'upper'
interface TTEntry {
  depth: number
  score: number
  flag: TTFlag
}

interface SearchCtx {
  tt: Map<string, TTEntry>
  nodes: number
  deadline: number
}

function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  toMove: Player,
  ctx: SearchCtx,
): number {
  ctx.nodes++
  if ((ctx.nodes & 4095) === 0 && Date.now() > ctx.deadline) {
    // Soft time-out: bail out with current material eval.
    const sign = toMove === 'white' ? 1 : -1
    return sign * materialEval(board)
  }

  const winner = checkWinner(board, toMove)
  if (winner !== null) {
    return winner === toMove ? WIN - (50 - depth) : -(WIN - (50 - depth))
  }
  if (depth === 0) {
    const sign = toMove === 'white' ? 1 : -1
    return sign * materialEval(board)
  }

  // Transposition table lookup with bound-aware semantics. The key is the
  // position only — the entry remembers the depth and bound type, so an
  // entry from a deeper search can still be reused at a shallower one.
  const alphaOrig = alpha
  const key = hash(board, toMove)
  const cached = ctx.tt.get(key)
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score
    if (cached.flag === 'lower' && cached.score >= beta) return cached.score
    if (cached.flag === 'upper' && cached.score <= alpha) return cached.score
    if (cached.flag === 'lower' && cached.score > alpha) alpha = cached.score
    else if (cached.flag === 'upper' && cached.score < beta) beta = cached.score
    if (alpha >= beta) return cached.score
  }

  const moves = getLegalMoves(board, toMove)
  if (moves.length === 0) {
    return -(WIN - (50 - depth))
  }

  const next: Player = toMove === 'white' ? 'black' : 'white'
  let best = -Infinity
  for (const move of moves) {
    const nb = applyMove(board, move)
    const score = -negamax(nb, depth - 1, -beta, -alpha, next, ctx)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }

  let flag: TTFlag
  if (best <= alphaOrig) flag = 'upper'
  else if (best >= beta) flag = 'lower'
  else flag = 'exact'
  ctx.tt.set(key, { depth, score: best, flag })
  return best
}

export type SharedTT = Map<string, TTEntry>
export function createSharedTT(): SharedTT {
  return new Map()
}

/**
 * Returns the best move and its score (in centipawns, from `toMove`'s view)
 * at the given search depth, with an overall wall-time budget. Pass a
 * `sharedTT` to reuse transposition data across calls (e.g. when analysing
 * a full game move-by-move).
 */
export function searchPosition(
  board: Board,
  toMove: Player,
  depth: number,
  timeBudgetMs = 3000,
  sharedTT?: SharedTT,
): { bestMove: Move | null; score: number } {
  const moves = getLegalMoves(board, toMove)
  if (moves.length === 0) {
    return { bestMove: null, score: -(WIN) }
  }

  const ctx: SearchCtx = {
    tt: sharedTT ?? new Map(),
    nodes: 0,
    deadline: Date.now() + timeBudgetMs,
  }
  const next: Player = toMove === 'white' ? 'black' : 'white'

  if (moves.length === 1) {
    // Forced; still produce a score by evaluating the resulting position.
    const nb = applyMove(board, moves[0])
    const score = -negamax(nb, Math.max(0, depth - 1), -Infinity, Infinity, next, ctx)
    return { bestMove: moves[0], score }
  }

  // Alpha-beta at the root too, so the root benefits from pruning.
  let bestMove: Move = moves[0]
  let bestScore = -Infinity
  let alpha = -Infinity
  const beta = Infinity

  for (const move of moves) {
    const nb = applyMove(board, move)
    const score = -negamax(nb, depth - 1, -beta, -alpha, next, ctx)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
    if (bestScore > alpha) alpha = bestScore
  }

  return { bestMove, score: bestScore }
}
