import type { Piece as PieceType } from '../engine/rules'

interface Props {
  piece: PieceType
  isMovable: boolean
  isSelected: boolean
}

export default function Piece({ piece, isMovable, isSelected }: Props) {
  const isBlack = piece.player === 'black'
  const isKing = piece.type === 'king'

  return (
    <div
      className={[
        'w-4/5 h-4/5 rounded-full flex items-center justify-center transition-transform duration-150',
        isBlack
          ? 'bg-gray-900 shadow-[inset_0_-4px_8px_rgba(255,255,255,0.1)]'
          : 'bg-gray-100 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.2)]',
        isMovable ? 'ring-2 ring-blue-400 ring-offset-1' : '',
        isSelected ? 'scale-110' : 'hover:scale-105',
      ].join(' ')}
    >
      {isKing && (
        <span className={`text-lg leading-none ${isBlack ? 'text-yellow-400' : 'text-yellow-600'}`}>
          ♛
        </span>
      )}
    </div>
  )
}
