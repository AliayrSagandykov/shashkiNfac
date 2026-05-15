import type { Board, Player, Move } from './rules'
import { getLegalMoves, applyMove, checkWinner } from './rules'

function evaluateBoard(board: Board, player: Player): number {
  let score = 0
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue
      const value = cell.type === 'king' ? 3 : 1
      score += cell.player === player ? value : -value
    }
  }
  return score
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: Player,
  currentPlayer: Player
): number {
  const winner = checkWinner(board, currentPlayer)
  if (winner !== null) return winner === aiPlayer ? 10000 : -10000
  if (depth === 0) return evaluateBoard(board, aiPlayer)

  const moves = getLegalMoves(board, currentPlayer)
  const nextPlayer: Player = currentPlayer === 'black' ? 'white' : 'black'

  if (maximizing) {
    let best = -Infinity
    for (const move of moves) {
      const newBoard = applyMove(board, move)
      const val = minimax(newBoard, depth - 1, alpha, beta, false, aiPlayer, nextPlayer)
      best = Math.max(best, val)
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const move of moves) {
      const newBoard = applyMove(board, move)
      const val = minimax(newBoard, depth - 1, alpha, beta, true, aiPlayer, nextPlayer)
      best = Math.min(best, val)
      beta = Math.min(beta, best)
      if (beta <= alpha) break
    }
    return best
  }
}

const LEVEL_TO_DEPTH: Record<number, number> = {
  1: 1, 5: 2, 10: 3, 15: 4, 20: 5, 25: 6,
}

function getDepth(level: number): number {
  const keys = Object.keys(LEVEL_TO_DEPTH).map(Number).sort((a, b) => a - b)
  let depth = 1
  for (const key of keys) {
    if (level >= key) depth = LEVEL_TO_DEPTH[key]
  }
  return depth
}

export function getBestMove(board: Board, player: Player, level: number): Move | null {
  const moves = getLegalMoves(board, player)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  const depth = getDepth(level)
  const nextPlayer: Player = player === 'black' ? 'white' : 'black'
  let bestMove = moves[0]
  let bestVal = -Infinity

  for (const move of moves) {
    const newBoard = applyMove(board, move)
    const val = minimax(newBoard, depth - 1, -Infinity, Infinity, false, player, nextPlayer)
    if (val > bestVal) {
      bestVal = val
      bestMove = move
    }
  }

  return bestMove
}
