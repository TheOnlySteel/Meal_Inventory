import { NavLink } from 'react-router-dom'

const TABS = [
  {
    to: '/',
    label: 'Larder',
    icon: (
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5ZM9.5 20v-6h5v6" />
    ),
  },
  {
    to: '/planner',
    label: 'Planner',
    icon: (
      <path d="M7 3.5v3M17 3.5v3M4.5 5.5h15A0 0 0 0 1 19.5 5.5v13a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-13a0 0 0 0 1 0 0ZM4.5 10h15M9 14h2M13 14h2M9 17h2" />
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
