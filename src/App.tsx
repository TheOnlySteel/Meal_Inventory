import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import { HouseholdGate, HouseholdProvider } from './hooks/useHousehold'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Manager from './pages/Manager'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Shopping from './pages/Shopping'

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return (
    <HouseholdProvider>
      <HouseholdGate>{children}</HouseholdGate>
    </HouseholdProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<Manager />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/shopping" element={<Shopping />} />
      </Route>
      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
