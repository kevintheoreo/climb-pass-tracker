import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { requestPersistentStorage } from './db/persist'
import { listenForInstallPrompt } from './features/install/env'
import './index.css'

// The browser can send its install prompt before the screen has loaded, so listen first.
listenForInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

void requestPersistentStorage()
