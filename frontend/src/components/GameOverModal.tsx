import { t } from '../i18n'
import type { Player } from '../engine/rules'

interface Props {
  open: boolean
  myColor: Player | null
  winner: Player | 'draw' | null
  endReason: 'no_moves' | 'resign' | 'opponent_left' | 'timeout' | 'draw_agreed' | 'connection_lost' | null
  isOnline: boolean
  myName: string
  opponentName: string
  myRating: number
  opponentRating: number
  ratingDelta: number | null
  rematchOfferFromOpponent: boolean
  rematchPendingFromMe: boolean
  rematchDeclined: boolean
  onRematch: () => void
  onDeclineRematch: () => void
  onHome: () => void
}

function Avatar({ name, color }: { name: string; color: 'black' | 'white' }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
          color === 'black'
            ? 'bg-gradient-to-br from-gray-700 to-gray-900'
            : 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-900'
        }`}
      >
        {(name ?? '?').charAt(0).toUpperCase()}
      </div>
      <div className="text-white text-xs font-medium max-w-[6rem] truncate">{name}</div>
    </div>
  )
}

export default function GameOverModal(props: Props) {
  if (!props.open) return null

  const { myColor, winner, endReason, isOnline, ratingDelta } = props
  const opponentColor: Player = myColor === 'black' ? 'white' : 'black'

  const myResult: 'win' | 'loss' | 'draw' =
    winner === 'draw'
      ? 'draw'
      : winner === myColor
      ? 'win'
      : 'loss'

  const headline =
    myResult === 'win'
      ? t('youWon')
      : myResult === 'loss'
      ? t('youLost')
      : t('drawResult')

  const reasonLabel =
    endReason === 'resign'
      ? t('byResignation')
      : endReason === 'timeout'
      ? t('byTimeout')
      : endReason === 'no_moves'
      ? t('byNoMoves')
      : endReason === 'draw_agreed'
      ? t('byAgreement')
      : endReason === 'opponent_left'
      ? t('opponentLeft')
      : endReason === 'connection_lost'
      ? 'Connection lost'
      : ''

  const accentBg =
    myResult === 'win'
      ? 'from-emerald-600 to-emerald-700'
      : myResult === 'loss'
      ? 'from-red-700 to-red-800'
      : 'from-gray-600 to-gray-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-[#1f2937] rounded-2xl border border-[#374151] shadow-2xl overflow-hidden">
        <div className={`bg-gradient-to-br ${accentBg} px-6 py-5 text-center`}>
          <div className="text-white text-3xl font-extrabold tracking-tight">{headline}</div>
          {reasonLabel && (
            <div className="text-white/80 text-sm mt-1">{reasonLabel}</div>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <Avatar
              name={myColor === 'black' ? props.myName : props.opponentName}
              color="black"
            />
            <div className="text-gray-400 font-bold text-lg">vs</div>
            <Avatar
              name={myColor === 'white' ? props.myName : props.opponentName}
              color="white"
            />
          </div>

          {isOnline && ratingDelta != null && (
            <div className="text-center mb-5">
              <div className="text-gray-400 text-xs">{t('rating')}</div>
              <div className="text-white text-2xl font-bold">
                {props.myRating}
                <span
                  className={`ml-2 text-lg ${
                    ratingDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  ({ratingDelta >= 0 ? '+' : ''}
                  {ratingDelta})
                </span>
              </div>
            </div>
          )}

          {isOnline && props.rematchOfferFromOpponent && !props.rematchDeclined ? (
            <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3 mb-3 text-center">
              <div className="text-blue-200 text-sm mb-2">
                {props.opponentName} {t('rematchOffered')}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={props.onRematch}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold text-sm"
                >
                  ✓ {t('accept')}
                </button>
                <button
                  onClick={props.onDeclineRematch}
                  className="flex-1 bg-[#374151] hover:bg-[#4b5563] text-white py-2 rounded-lg text-sm"
                >
                  {t('decline')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {isOnline && !props.rematchDeclined && (
                <button
                  onClick={props.onRematch}
                  disabled={props.rematchPendingFromMe}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  🔄 {props.rematchPendingFromMe ? t('rematchOffered') : t('rematch')}
                </button>
              )}
              {!isOnline && (
                <button
                  onClick={props.onRematch}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  🔄 {t('rematch')}
                </button>
              )}
              <button
                onClick={props.onHome}
                className="flex-1 bg-[#374151] hover:bg-[#4b5563] text-white py-3 rounded-lg font-semibold transition-colors"
              >
                {t('home_')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
