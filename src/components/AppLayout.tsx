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
      <Outlet />
      <TabBar />
    </>
  )
}
