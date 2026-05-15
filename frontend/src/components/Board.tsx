import type { Board as BoardType, Move, Player } from '../engine/rules'
import Piece from './Piece'

interface Props {
  board: BoardType
  legalMoves: Move[]
  selectedCell: [number, number] | null
  onCellClick: (row: number, col: number) => void
  perspective: Player
}

export default function Board({ board, legalMoves, selectedCell, onCellClick, perspective }: Props) {
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

  return (
    <div className="w-full aspect-square">
      <div
        className="grid w-full h-full"
        style={{ gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(10, 1fr)' }}
      >
        {rows.map((row) =>
          cols.map((col) => {
            const isDark = (row + col) % 2 === 1
            const piece = board[row][col]
            const isSelected = selectedCell?.[0] === row && selectedCell?.[1] === col
            const isTarget = validTargets.has(`${row},${col}`)
            const isMovable = movablePieces.has(`${row},${col}`)

            return (
              <div
                key={`${row}-${col}`}
                onClick={() => isDark ? onCellClick(row, col) : undefined}
                className={[
                  'relative flex items-center justify-center',
                  isDark ? 'cursor-pointer bg-[#5d4037]' : 'bg-[#d7ccc8]',
                  isSelected ? 'ring-4 ring-yellow-400 ring-inset z-10' : '',
                  isTarget ? 'ring-4 ring-green-400 ring-inset' : '',
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
                  <div className="w-1/3 h-1/3 rounded-full bg-green-400 opacity-60" />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
