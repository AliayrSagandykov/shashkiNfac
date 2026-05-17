interface Props {
  name: string
  url?: string | null
  size?: number
  className?: string
}

export default function Avatar({ name, url, size = 40, className }: Props) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size, fontSize: Math.max(12, Math.floor(size / 2.3)) }
  return (
    <div
      style={style}
      className={[
        'rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-fg font-bold shrink-0',
        className ?? '',
      ].join(' ')}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  )
}
