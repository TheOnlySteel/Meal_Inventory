import type { ReactNode } from 'react'

/**
 * SF Symbols-style glyphs, hand-drawn on a 24×24 grid (round caps/joins,
 * 1.8pt default stroke). Apple's symbol font can't be embedded on the web,
 * so these follow the same visual language without shipping Apple assets.
 */
export type IconName =
  | 'snowflake'
  | 'fridge'
  | 'jar'
  | 'sunrise'
  | 'sun'
  | 'moon'
  | 'apple'
  | 'checklist'
  | 'chefhat'
  | 'calendar'
  | 'book'
  | 'cart'
  | 'takeout'
  | 'repeat'
  | 'house'
  | 'person'
  | 'sparkle'

const GLYPHS: Record<IconName, ReactNode> = {
  snowflake: (
    <path d="M12 3v18M12 3l-2.2 2.2M12 3l2.2 2.2M12 21l-2.2-2.2M12 21l2.2-2.2M4.2 7.5l15.6 9M4.2 7.5l3 .3M4.2 16.5l3-.3M4.2 16.5l15.6-9M19.8 7.5l-3 .3M19.8 16.5l-3-.3" />
  ),
  fridge: (
    <>
      <rect x="6.5" y="2.9" width="11" height="18.2" rx="2" />
      <path d="M6.5 9.4h11M14.9 5.4v1.7M14.9 12v2.6" />
    </>
  ),
  jar: (
    <>
      <path d="M8.5 3.25h7" />
      <path d="M8.25 6h7.5M8.55 6c-1.6 1.2-2.55 3-2.55 5v6.75A3.25 3.25 0 0 0 9.25 21h5.5A3.25 3.25 0 0 0 18 17.75V11c0-2-.95-3.8-2.55-5" />
    </>
  ),
  sunrise: (
    <path d="M12 3.4v2.4M5.7 6.2l1.7 1.7M18.3 6.2l-1.7 1.7M7.9 14.25a4.1 4.1 0 0 1 8.2 0M2.9 14.25h2.6M18.5 14.25h2.6M4.75 18.5h14.5" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.9V5M12 19v2.1M2.9 12H5M19 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
    </>
  ),
  moon: (
    <path d="M19.6 14.6A8.25 8.25 0 0 1 9.4 4.4 8.25 8.25 0 1 0 19.6 14.6Z" />
  ),
  apple: (
    <>
      <path d="M12 6.9c-1-1-2.2-1.5-3.6-1.3C5.8 6 4.1 8.4 4.6 11.2c.6 3.7 3 7.3 5 7.3.9 0 1.5-.55 2.4-.55s1.5.55 2.4.55c2 0 4.4-3.6 5-7.3.5-2.8-1.2-5.2-3.8-5.6-1.4-.2-2.6.3-3.6 1.3Z" />
      <path d="M12 6.9c0-1.9 1.2-3.2 2.9-3.75" />
    </>
  ),
  checklist: (
    <path d="M3.9 6.4 5.5 8l2.9-3.1M3.9 12.4 5.5 14l2.9-3.1M3.9 18.4 5.5 20l2.9-3.1M12.4 6.5h7.7M12.4 12.5h7.7M12.4 18.5h7.7" />
  ),
  chefhat: (
    <>
      <path d="M7.4 13.3c-2.2-.3-3.75-1.9-3.75-3.9 0-2.1 1.75-3.8 3.95-3.8.3 0 .6.03.9.1C9.25 4.2 10.55 3.25 12 3.25s2.75.95 3.5 2.45c.3-.07.6-.1.9-.1 2.2 0 3.95 1.7 3.95 3.8 0 2-1.55 3.6-3.75 3.9" />
      <path d="M7.4 13.2v4.9a2.65 2.65 0 0 0 2.65 2.65h3.9a2.65 2.65 0 0 0 2.65-2.65v-4.9M7.4 16.9h9.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.9" y="4.9" width="16.2" height="15.4" rx="2.4" />
      <path d="M3.9 9.6h16.2M8.1 2.9v3.5M15.9 2.9v3.5" />
    </>
  ),
  book: (
    <path d="M12 6.4C10 4.7 7 4.3 4.5 5.1v13.3c2.5-.8 5.5-.4 7.5 1.3 2-1.7 5-2.1 7.5-1.3V5.1C17 4.3 14 4.7 12 6.4Zm0 0v13.3" />
  ),
  cart: (
    <path d="M3.4 4.4h2.1l2.2 11.3a1.5 1.5 0 0 0 1.47 1.2h8.2a1.5 1.5 0 0 0 1.46-1.16L20.6 8.4H6.3M9.9 20.6a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3ZM17.2 20.6a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3Z" />
  ),
  takeout: (
    <>
      <path d="M4.4 8.4h15.2M5 8.4l1.5 11.2a1.6 1.6 0 0 0 1.6 1.4h7.8a1.6 1.6 0 0 0 1.6-1.4L19 8.4M6.1 8.4l1.3-3.1a2 2 0 0 1 1.85-1.2h5.5a2 2 0 0 1 1.85 1.2l1.3 3.1" />
      <path d="M9.6 12.4l2.4 2.3 2.4-2.3" />
    </>
  ),
  repeat: (
    <path d="M4.9 12a7.1 7.1 0 0 1 12-5.1M19.1 12a7.1 7.1 0 0 1-12 5.1M16.6 3.5l.4 3.5-3.5.4M7.4 20.5 7 17l3.5-.4" />
  ),
  house: (
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5ZM9.5 20v-6h5v6" />
  ),
  person: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="9.9" r="2.9" />
      <path d="M6.5 18.1c1.3-2.1 3.2-3.3 5.5-3.3s4.2 1.2 5.5 3.3" />
    </>
  ),
  sparkle: (
    <path d="M12 4.5c.5 3.4 2.1 5 5.5 5.5-3.4.5-5 2.1-5.5 5.5-.5-3.4-2.1-5-5.5-5.5 3.4-.5 5-2.1 5.5-5.5ZM6 15.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z" />
  ),
}

interface Props {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  /** SF-style emphasis for selected states: heavier stroke */
  emphasized?: boolean
}

export default function Icon({ name, size = 18, strokeWidth = 1.8, className, emphasized }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={emphasized ? strokeWidth + 0.6 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className ?? ''}`}
    >
      {GLYPHS[name]}
    </svg>
  )
}
