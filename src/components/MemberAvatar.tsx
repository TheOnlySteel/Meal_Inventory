const PALETTE = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#5ac8fa']

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Initials circle with a colour derived from the user id (stable across devices). */
export default function MemberAvatar({
  userId,
  name,
  size = 24,
}: {
  userId: string
  name: string | null
  size?: number
}) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: PALETTE[hashCode(userId) % PALETTE.length],
      }}
    >
      {initials || '?'}
    </span>
  )
}
