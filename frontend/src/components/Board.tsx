import type { Board as BoardType, Move, Player } from '../engine/rules'
import Piece from './Piece'

interface Props {
  board: BoardType
  legalMoves: Move[]
  selectedCell: [number, number] | null
  lastMove?: Move | null
  onCellClick: (row: number, col: number) => void
  perspective: Player
}

export default function Board({
  board,
  legalMoves,
  selectedCell,
  lastMove,
  onCellClick,
  perspective,
}: Props) {
  const rows = perspective === 'black' ? [...Array(10).keys()] : [...Array(10).keys()].reverse()
  const cols = perspective === 'black' ? [...Array(10).keys()] : [...Array(10).keys()].reverse()

  const validTargets = new Set<string>()
  if (selectedCell) {
    const [fr, fc] = selectedCell
    for (const m of legalMoves) {
      if (m.from[0] === fr && m.from[1] === fc) {
        validTargets.add(`${m.to[0]},${m.to[1]}`)
      }
    }
  }

  const movablePieces = new Set<string>()
  for (const m of legalMoves) {
    movablePieces.add(`${m.from[0]},${m.from[1]}`)
  }

  const lastFromKey = lastMove ? `${lastMove.from[0]},${lastMove.from[1]}` : null
  const lastToKey = lastMove ? `${lastMove.to[0]},${lastMove.to[1]}` : null

  const DARK = 'bg-[#739552]'
  const LIGHT = 'bg-[#ebecd0]'
  const DARK_HIGHLIGHT = 'bg-[#baca44]'
  const LIGHT_HIGHLIGHT = 'bg-[#f6f680]'

  return (
    <div className="w-full aspect-square select-none">
      <div
        className="grid w-full h-full rounded-md overflow-hidden shadow-lg"
        style={{ gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(10, 1fr)' }}
      >
        {rows.map((row) =>
          cols.map((col) => {
            const isDark = (row + col) % 2 === 1
            const piece = board[row][col]
            const isSelected = selectedCell?.[0] === row && selectedCell?.[1] === col
            const isTarget = validTargets.has(`${row},${col}`)
            const isMovable = movablePieces.has(`${row},${col}`)
            const cellKey = `${row},${col}`
            const isLast = cellKey === lastFromKey || cellKey === lastToKey

            const bg = isLast
              ? isDark
                ? DARK_HIGHLIGHT
                : LIGHT_HIGHLIGHT
              : isDark
              ? DARK
              : LIGHT

            return (
              <div
                key={`${row}-${col}`}
                onClick={() => (isDark ? onCellClick(row, col) : undefined)}
                className={[
                  'relative flex items-center justify-center',
                  bg,
                  isDark ? 'cursor-pointer' : '',
                  isSelected ? 'ring-4 ring-yellow-300 ring-inset z-10' : '',
                ].join(' ')}
              >
                {piece && (
                  <Piece
                    piece={piece}
                    isMovable={isMovable && !selectedCell}
                    isSelected={isSelected}
                  />
                )}
                {isTarget && !piece && (
                  <div className="w-1/3 h-1/3 rounded-full bg-black/30" />
                )}
                {isTarget && piece && (
                  <div className="absolute inset-1 rounded-full ring-4 ring-black/30" />
                )}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}
