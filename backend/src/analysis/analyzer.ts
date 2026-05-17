import type { Board, Move, Player } from '../engine/rules'
import { applyMove, getInitialBoard } from '../engine/rules'
import { searchPosition } from '../engine/ai'

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
): Promise<GameAnalysis> {
  let board: Board = getInitialBoard()
  let toMove = 'black' as Player // international draughts starts with black

  const out: MoveAnalysis[] = []
  const evalGraph: number[] = []

  // Initial position eval.
  const initEval = searchPosition(board, toMove, Math.min(depth, 6), timeBudgetMs)
  const initScoreWhite = toMove === 'white' ? initEval.score : -initEval.score
  evalGraph.push(clamp(initScoreWhite, -2000, 2000))

  for (let i = 0; i < moves.length; i++) {
    const played = moves[i]
    const before = searchPosition(board, toMove, depth, timeBudgetMs)
    const beforeWhite = toMove === 'white' ? before.score : -before.score

    const nextBoard = applyMove(board, played)
    const nextToMove: Player = toMove === 'white' ? 'black' : 'white'
    // Eval the resulting position from the OTHER player's perspective, then flip.
    const after = searchPosition(nextBoard, nextToMove, depth, timeBudgetMs)
    const afterWhite = nextToMove === 'white' ? after.score : -after.score

    // Loss is measured for the player who just moved, in their POV.
    const mySign = toMove === 'white' ? 1 : -1
    const loss = Math.max(0, mySign * (beforeWhite - afterWhite))

    out.push({
      ply: i,
      player: toMove,
      played,
      best: before.bestMove,
      evalBeforeWhite: clamp(beforeWhite, -2000, 2000),
      evalAfterWhite: clamp(afterWhite, -2000, 2000),
      loss,
      classification: classify(loss),
    })
    evalGraph.push(clamp(afterWhite, -2000, 2000))

    board = nextBoard
    toMove = nextToMove

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
