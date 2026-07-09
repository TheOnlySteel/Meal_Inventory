import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'

// Re-check for new builds hourly so the always-on kiosk picks up deploys
registerSW({
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})

// iOS standalone can launch with the document scrolled (page sits shifted up
// with a black band below). Scroll positions aren't meaningful across launches
// here, so pin the start position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.addEventListener('load', () => {
  requestAnimationFrame(() => window.scrollTo(0, 0))
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
