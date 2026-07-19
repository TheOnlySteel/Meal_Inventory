import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useRealtimeSync } from '../hooks/useMeals'
import TabBar from './TabBar'

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/larder': 'Larder',
  '/recipes': 'Recipes',
  '/chores': 'Chores',
  '/shopping': 'Shopping',
}

/** Shared shell for the tabbed phone app: realtime sync + bottom tab bar. */
export default function AppLayout() {
  useRealtimeSync()
  const { pathname } = useLocation()

  useEffect(() => {
    const page = TITLES[pathname]
    document.title = page ? `${page} · Larder` : 'Larder'
  }, [pathname])

  return (
    <>
      {/* The app's single scroll region — the document itself is a fixed
          shell (index.css), so a launch-time viewport mis-measure can never
          leave the page stuck at a phantom scroll offset. */}
      <div id="app-scroll" className="h-full overflow-y-auto overscroll-y-contain">
        <Outlet />
      </div>
      <TabBar />
    </>
  )
}
