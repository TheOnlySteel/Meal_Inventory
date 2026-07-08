import { Outlet } from 'react-router-dom'
import { useRealtimeSync } from '../hooks/useMeals'
import TabBar from './TabBar'

/** Shared shell for the tabbed phone app: realtime sync + bottom tab bar. */
export default function AppLayout() {
  useRealtimeSync()
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}
