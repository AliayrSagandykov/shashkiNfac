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
        'w-[78%] h-[78%] rounded-full flex items-center justify-center transition-transform duration-150',
        isBlack
          ? 'bg-gradient-to-b from-[#3a3a3a] to-[#0a0a0a] shadow-[inset_0_-6px_10px_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.5)]'
          : 'bg-gradient-to-b from-white to-[#d6d2c4] shadow-[inset_0_-6px_10px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.4)]',
        isMovable ? 'ring-2 ring-yellow-300/80 ring-offset-1 ring-offset-transparent' : '',
        isSelected ? 'scale-105' : 'hover:scale-[1.03]',
      ].join(' ')}
    >
      <div
        className={[
          'w-[55%] h-[55%] rounded-full flex items-center justify-center',
          isBlack ? 'ring-1 ring-white/10' : 'ring-1 ring-black/10',
        ].join(' ')}
      >
        {isKing && (
          <span className={`text-xl leading-none ${isBlack ? 'text-yellow-300' : 'text-yellow-700'}`}>
            ♛
          </span>
        )}
      </div>
    </div>
  )
}
