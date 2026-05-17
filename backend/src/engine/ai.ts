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
      // Edge penalty: men stuck on the side files have fewer captures and
      // can never become a king on the wrong side.
      const edge = p.type === 'man' && (c === 0 || c === 9) ? -4 : 0
      // Back-rank guard: men still on their starting back rank block the
      // opponent's promotion squares; small bonus.
      const guard =
        p.type === 'man' &&
        ((p.player === 'white' && r === 0) || (p.player === 'black' && r === 9))
          ? 6
          : 0
      score += dir * (base + advance + edge + guard)
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

function moveEq(a: Move, b: Move): boolean {
  return (
    a.from[0] === b.from[0] &&
    a.from[1] === b.from[1] &&
    a.to[0] === b.to[0] &&
    a.to[1] === b.to[1]
  )
}

type TTFlag = 'exact' | 'lower' | 'upper'
interface TTEntry {
  depth: number
  score: number
  flag: TTFlag
  best?: Move
}

interface SearchCtx {
  tt: Map<string, TTEntry>
  nodes: number
  deadline: number
}

function orderMoves(moves: Move[], ttMove: Move | undefined): Move[] {
  if (!ttMove) return moves
  const idx = moves.findIndex((m) => moveEq(m, ttMove))
  if (idx <= 0) return moves
  const ordered = moves.slice()
  const [m] = ordered.splice(idx, 1)
  ordered.unshift(m)
  return ordered
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
  // The stored best move is used for move ordering even when the cached
  // score isn't usable for the current window.
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

  const rawMoves = getLegalMoves(board, toMove)
  if (rawMoves.length === 0) {
    return -(WIN - (50 - depth))
  }
  const moves = orderMoves(rawMoves, cached?.best)

  const next: Player = toMove === 'white' ? 'black' : 'white'
  let best = -Infinity
  let bestMove: Move | undefined
  for (const move of moves) {
    const nb = applyMove(board, move)
    const score = -negamax(nb, depth - 1, -beta, -alpha, next, ctx)
    if (score > best) {
      best = score
      bestMove = move
    }
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }

  let flag: TTFlag
  if (best <= alphaOrig) flag = 'upper'
  else if (best >= beta) flag = 'lower'
  else flag = 'exact'
  ctx.tt.set(key, { depth, score: best, flag, best: bestMove })
  return best
}

export type SharedTT = Map<string, TTEntry>
export function createSharedTT(): SharedTT {
  return new Map()
}

/**
 * Returns the best move and its score (in centipawns, from `toMove`'s view)
 * up to the given target depth, with an overall wall-time budget. Uses
 * iterative deepening: each shallower pass seeds the TT with a best-move
 * which the next deeper pass tries first, so alpha-beta prunes far more
 * effectively. If time runs out before the target depth completes, the
 * deepest *completed* iteration's result is returned. Pass a `sharedTT`
 * to reuse transposition data across calls.
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

  let bestMove: Move = moves[0]
  let bestScore = -Infinity
  let prevBest: Move | undefined

  for (let d = 1; d <= depth; d++) {
    // Always finish depth 1 (cheap, always useful); for deeper iterations
    // bail before starting if we've blown the budget.
    if (d > 1 && Date.now() > ctx.deadline) break

    const ordered = orderMoves(moves, prevBest)
    let alpha = -Infinity
    const beta = Infinity
    let iterBest: Move = ordered[0]
    let iterScore = -Infinity
    let timedOut = false

    for (const move of ordered) {
      if (d > 1 && Date.now() > ctx.deadline) {
        timedOut = true
        break
      }
      const nb = applyMove(board, move)
      const score = -negamax(nb, d - 1, -beta, -alpha, next, ctx)
      if (score > iterScore) {
        iterScore = score
        iterBest = move
      }
      if (iterScore > alpha) alpha = iterScore
    }

    if (timedOut) break
    bestMove = iterBest
    bestScore = iterScore
    prevBest = iterBest

    // Stop early on confirmed forced mate — deeper search won't change it.
    if (Math.abs(bestScore) > WIN - 100) break
  }

  return { bestMove, score: bestScore }
}
