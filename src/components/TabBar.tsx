import { NavLink } from 'react-router-dom'
import type { IconName } from './Icon'
import Icon from './Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'house' },
  { to: '/larder', label: 'Larder', icon: 'jar' },
  { to: '/recipes', label: 'Recipes', icon: 'book' },
  { to: '/chores', label: 'Chores', icon: 'checklist' },
  { to: '/shopping', label: 'Shopping', icon: 'cart' },
]

/** Floating liquid-glass tab capsule; the active tab sits in its own lozenge. */
export default function TabBar() {
  return (
    <nav
      aria-label="Tabs"
      className="tab-glass fixed bottom-[calc(env(safe-area-inset-bottom)+0.625rem)] left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-full border border-sep float-shadow"
    >
      <div className="flex items-stretch gap-0.5 p-1.5">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `pressable flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 transition-colors ${
                isActive ? 'bg-card text-tint card-shadow' : 'text-ink2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={tab.icon} size={22} emphasized={isActive} />
                <span className="text-[10px] leading-none font-semibold">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
