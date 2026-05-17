import type { Board, Move, Player } from '../engine/rules'
import { applyMove, getInitialBoard } from '../engine/rules'
import { searchPosition, createSharedTT } from '../engine/ai'

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface MoveAnalysis {
  ply: number
  player: Player
  played: Move
  best: Move | null
  evalBeforeWhite: number   // centipawn score from white POV BEFORE the move
  evalAfterWhite: number    // centipawn score from white POV AFTER the move
  loss: number              // how much eval shifted against the mover (>=0)
  classification: MoveClass
}

export interface KeyMoment {
  ply: number
  player: Player
  classification: MoveClass
  loss: number
}

export interface GameAnalysis {
  depth: number
  moves: MoveAnalysis[]
  evalGraph: number[]              // white-POV centipawn after each ply (length = moves+1, includes initial 0)
  whiteAccuracy: number            // 0-100
  blackAccuracy: number
  keyMoments: KeyMoment[]
}

function classify(loss: number): MoveClass {
  if (loss <= 25) return 'best'
  if (loss <= 75) return 'good'
  if (loss <= 175) return 'inaccuracy'
  if (loss <= 400) return 'mistake'
  return 'blunder'
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function accuracyFromLosses(losses: number[]): number {
  if (losses.length === 0) return 100
  // Lichess-style: convert each loss to a per-move accuracy then average.
  let acc = 0
  for (const l of losses) {
    // Map loss in cp to a 0..100 score. 0 cp loss -> 100; 400 cp -> ~30; 1000+ -> ~5.
    const pct = clamp(100 * Math.exp(-l / 200), 0, 100)
    acc += pct
  }
  return Math.round(acc / losses.length)
}

export interface ProgressCb {
  (done: number, total: number): void
}

export async function analyzeGame(
  moves: Move[],
  depth: number,
  timeBudgetMs = 2000,
  progress?: ProgressCb,
  totalBudgetMs = Number.POSITIVE_INFINITY,
): Promise<GameAnalysis> {
  let board: Board = getInitialBoard()
  let toMove = 'black' as Player // international draughts starts with black
  const deadline = Date.now() + totalBudgetMs

  const out: MoveAnalysis[] = []
  const evalGraph: number[] = []

  // Shared TT across all searches in the game: transpositions reached
  // through different move orders only get searched once.
  const tt = createSharedTT()

  // Initial position eval; we'll keep `current` rolling so each move only
  // needs a single fresh search (for the position AFTER the played move),
  // because that result becomes the BEFORE search for the next move.
  let current = searchPosition(board, toMove, Math.min(depth, 6), timeBudgetMs, tt)
  let currentWhite = toMove === 'white' ? current.score : -current.score
  evalGraph.push(clamp(currentWhite, -2000, 2000))

  for (let i = 0; i < moves.length; i++) {
    const played = moves[i]
    const beforeWhite = currentWhite
    const beforeBest = current.bestMove

    const nextBoard = applyMove(board, played)
    const nextToMove: Player = toMove === 'white' ? 'black' : 'white'
    // Shrink the per-ply budget as we approach the overall deadline so the
    // total analysis always finishes before the hosting platform's request
    // timeout. Once we run out of time, fall back to a depth-1 search so
    // the remaining plies still get *some* eval.
    const remaining = deadline - Date.now()
    const pliesLeft = moves.length - i
    const perPlyMs = Math.max(50, Math.min(timeBudgetMs, Math.floor(remaining / pliesLeft)))
    const effectiveDepth = remaining <= 0 ? 1 : depth
    const after = searchPosition(nextBoard, nextToMove, effectiveDepth, perPlyMs, tt)
    const afterWhite = nextToMove === 'white' ? after.score : -after.score

    // Loss is measured for the player who just moved, in their POV.
    const mySign = toMove === 'white' ? 1 : -1
    const loss = Math.max(0, mySign * (beforeWhite - afterWhite))

    out.push({
      ply: i,
      player: toMove,
      played,
      best: beforeBest,
      evalBeforeWhite: clamp(beforeWhite, -2000, 2000),
      evalAfterWhite: clamp(afterWhite, -2000, 2000),
      loss,
      classification: classify(loss),
    })
    evalGraph.push(clamp(afterWhite, -2000, 2000))

    board = nextBoard
    toMove = nextToMove
    current = after
    currentWhite = afterWhite

    if (progress) progress(i + 1, moves.length)
    // Yield control occasionally so the event loop can serve other requests.
    if (i % 4 === 3) await new Promise<void>((r) => setImmediate(r))
  }

  const whiteLosses = out.filter((m) => m.player === 'white').map((m) => m.loss)
  const blackLosses = out.filter((m) => m.player === 'black').map((m) => m.loss)

  const keyMoments: KeyMoment[] = out
    .filter((m) => m.classification === 'blunder' || m.classification === 'mistake')
    .map((m) => ({
      ply: m.ply,
      player: m.player,
      classification: m.classification,
      loss: m.loss,
    }))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 5)

  return {
    depth,
    moves: out,
    evalGraph,
    whiteAccuracy: accuracyFromLosses(whiteLosses),
    blackAccuracy: accuracyFromLosses(blackLosses),
    keyMoments,
  }
}
