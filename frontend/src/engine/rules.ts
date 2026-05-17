// International draughts rules (10x10 board)

export type Player = 'black' | 'white'
export type PieceType = 'man' | 'king'

export interface Piece {
  player: Player
  type: PieceType
}

export type Cell = Piece | null
export type Board = Cell[][]

export interface Move {
  from: [number, number]
  to: [number, number]
  captures: [number, number][]
  isKingMove?: boolean
}

export function getInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(10).fill(null))

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 10; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { player: 'white', type: 'man' }
      }
    }
  }

  for (let row = 6; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { player: 'black', type: 'man' }
      }
    }
  }

  return board
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 10 && c >= 0 && c < 10
}

function opponent(p: Player): Player {
  return p === 'black' ? 'white' : 'black'
}

function getCaptures(
  board: Board,
  row: number,
  col: number,
  player: Player,
  isKing: boolean,
  captured: Set<string>
): Move[][] {
  const dirs = isKing
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : player === 'black'
    ? [[-1, -1], [-1, 1]]
    : [[1, -1], [1, 1]]

  const sequences: Move[][] = []

  for (const [dr, dc] of dirs) {
    if (isKing) {
      // Flying king: scan along diagonal for an enemy piece
      let r = row + dr
      let c = col + dc
      let enemyPos: [number, number] | null = null

      while (inBounds(r, c)) {
        const cell = board[r][c]
        if (cell) {
          if (cell.player === opponent(player) && !captured.has(`${r},${c}`)) {
            enemyPos = [r, c]
          }
          break
        }
        r += dr
        c += dc
      }

      if (enemyPos) {
        let lr = enemyPos[0] + dr
        let lc = enemyPos[1] + dc
        while (inBounds(lr, lc) && !board[lr][lc]) {
          const newCaptured = new Set(captured)
          newCaptured.add(`${enemyPos[0]},${enemyPos[1]}`)
          const sub = getCaptures(board, lr, lc, player, true, newCaptured)
          const baseMove: Move = {
            from: [row, col],
            to: [lr, lc],
            captures: [enemyPos],
            isKingMove: true,
          }
          if (sub.length === 0) {
            sequences.push([baseMove])
          } else {
            for (const seq of sub) {
              sequences.push([baseMove, ...seq])
            }
          }
          lr += dr
          lc += dc
        }
      }
    } else {
      const mr = row + dr
      const mc = col + dc
      const lr = row + 2 * dr
      const lc = col + 2 * dc
      if (
        inBounds(mr, mc) &&
        inBounds(lr, lc) &&
        board[mr][mc]?.player === opponent(player) &&
        !captured.has(`${mr},${mc}`) &&
        !board[lr][lc]
      ) {
        const newCaptured = new Set(captured)
        newCaptured.add(`${mr},${mc}`)
        const sub = getCaptures(board, lr, lc, player, isKing, newCaptured)
        const baseMove: Move = { from: [row, col], to: [lr, lc], captures: [[mr, mc]] }
        if (sub.length === 0) {
          sequences.push([baseMove])
        } else {
          for (const seq of sub) {
            sequences.push([baseMove, ...seq])
          }
        }
      }
    }
  }

  return sequences
}

// Returns a flat list of final-destination moves (captures merged)
export function getLegalMoves(board: Board, player: Player): Move[] {
  const allCaptures: Move[] = []
  const simpleMovesArr: Move[] = []

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const piece = board[row][col]
      if (!piece || piece.player !== player) continue

      const isKing = piece.type === 'king'

      // Capture sequences
      const seqs = getCaptures(board, row, col, player, isKing, new Set())
      for (const seq of seqs) {
        // Merge into a single move with all captures
        const allCaps: [number, number][] = []
        for (const step of seq) allCaps.push(...step.captures)
        allCaptures.push({
          from: seq[0].from,
          to: seq[seq.length - 1].to,
          captures: allCaps,
          isKingMove: isKing,
        })
      }

      // Simple moves (no capture)
      if (seqs.length === 0) {
        const dirs = isKing
          ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
          : player === 'black'
          ? [[-1, -1], [-1, 1]]
          : [[1, -1], [1, 1]]

        if (isKing) {
          for (const [dr, dc] of dirs) {
            let r = row + dr
            let c = col + dc
            while (inBounds(r, c) && !board[r][c]) {
              simpleMovesArr.push({ from: [row, col], to: [r, c], captures: [], isKingMove: true })
              r += dr
              c += dc
            }
          }
        } else {
          for (const [dr, dc] of dirs) {
            const r = row + dr
            const c = col + dc
            if (inBounds(r, c) && !board[r][c]) {
              simpleMovesArr.push({ from: [row, col], to: [r, c], captures: [] })
            }
          }
        }
      }
    }
  }

  // Capturing is mandatory in international draughts, and among all
  // capture options the player must pick one taking the maximum number
  // of pieces.
  if (allCaptures.length > 0) {
    let max = 0
    for (const m of allCaptures) if (m.captures.length > max) max = m.captures.length
    return allCaptures.filter((m) => m.captures.length === max)
  }
  return simpleMovesArr
}

export function applyMove(board: Board, move: Move): Board {
  const newBoard: Board = board.map((row) => [...row])
  const piece = newBoard[move.from[0]][move.from[1]]!
  newBoard[move.from[0]][move.from[1]] = null

  // Remove captured pieces
  for (const [cr, cc] of move.captures) {
    newBoard[cr][cc] = null
  }

  // Promotion
  let movedPiece: Piece = { ...piece }
  if (movedPiece.type === 'man') {
    if (movedPiece.player === 'black' && move.to[0] === 0) movedPiece = { ...movedPiece, type: 'king' }
    if (movedPiece.player === 'white' && move.to[0] === 9) movedPiece = { ...movedPiece, type: 'king' }
  }

  newBoard[move.to[0]][move.to[1]] = movedPiece
  return newBoard
}

export function checkWinner(board: Board, currentTurn: Player): Player | null {
  const moves = getLegalMoves(board, currentTurn)
  if (moves.length === 0) return opponent(currentTurn)

  const hasBlack = board.some((row) => row.some((c) => c?.player === 'black'))
  const hasWhite = board.some((row) => row.some((c) => c?.player === 'white'))
  if (!hasBlack) return 'white'
  if (!hasWhite) return 'black'
  return null
}
