import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { StoreProvider, useAuth } from './lib/store'
import { Login } from './screens/Login'
import { Logo } from './components/Logo'

registerSW({ immediate: true })

function Root() {
  const { state } = useAuth()
  if (state === 'loading') {
    return <div className="grid min-h-full place-items-center"><div className="animate-pulse"><Logo size={72} /></div></div>
  }
  if (state === 'signed-out') return <Login />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <Root />
    </StoreProvider>
  </StrictMode>,
)
