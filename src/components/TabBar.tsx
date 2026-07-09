import { NavLink } from 'react-router-dom'

const TABS = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5ZM9.5 20v-6h5v6" />
    ),
  },
  {
    to: '/larder',
    label: 'Larder',
    icon: (
      // lidded jar
      <path d="M8.5 3.5h7M7.5 6.5h9M8 6.5c-1.6 1.3-2.5 3-2.5 5v6.5A2.5 2.5 0 0 0 8 20.5h8a2.5 2.5 0 0 0 2.5-2.5V11.5c0-2-.9-3.7-2.5-5M5.5 13.5h13" />
    ),
  },
  {
    to: '/recipes',
    label: 'Recipes',
    icon: (
      // open book
      <path d="M12 6.5C10 4.8 7 4.4 4.5 5.2v13.3c2.5-.8 5.5-.4 7.5 1.3 2-1.7 5-2.1 7.5-1.3V5.2C17 4.4 14 4.8 12 6.5Zm0 0v13.3" />
    ),
  },
  {
    to: '/chores',
    label: 'Chores',
    icon: (
      // checklist
      <path d="M4 6.5 5.6 8 8.5 5M4 12.5 5.6 14 8.5 11M4 18.5 5.6 20 8.5 17M12 6.5h8M12 12.5h8M12 18.5h8" />
    ),
  },
  {
    to: '/shopping',
    label: 'Shopping',
    icon: (
      <path d="M3.5 4.5h2l2.2 11.2a1.5 1.5 0 0 0 1.47 1.2h8.13a1.5 1.5 0 0 0 1.46-1.15L20.5 8.5H6.4M10 20.5a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2ZM17 20.5a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Z" />
    ),
  },
]

/** iOS-style bottom tab bar for the phone app (kiosk dashboard stays tab-less). */
export default function TabBar() {
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-sep safe-b">
      <div className="mx-auto flex max-w-2xl items-stretch">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `pressable flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 ${
                isActive ? 'text-tint' : 'text-ink2'
              }`
            }
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tab.icon}
            </svg>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
