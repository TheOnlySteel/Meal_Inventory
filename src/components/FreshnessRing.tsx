import type { Freshness } from '../lib/freshness'

/** Circular countdown showing shelf-life remaining, tinted by status. */
export default function FreshnessRing({
  freshness,
  size = 44,
}: {
  freshness: Freshness
  size?: number
}) {
  const stroke = Math.max(size * 0.09, 3)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = freshness.key === 'expired' ? 1 : Math.max(freshness.fraction, 0.04)

  return (
    <div
      role="img"
      aria-label={freshness.label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--card-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={freshness.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-semibold"
        style={{ color: freshness.textColor, fontSize: size * 0.3 }}
      >
        {freshness.key === 'expired' ? '!' : freshness.daysLeft}
      </div>
    </div>
  )
}
