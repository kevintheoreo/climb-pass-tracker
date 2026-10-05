import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PassesPage from '../features/passes/PassesPage'
import { Layout } from './Layout'

// Only the main screen is in the first download; the other screens load when they are opened
// (the service worker has them cached, so this works offline too).
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))
const PrivacyPage = lazy(() => import('../features/legal/PrivacyPage'))
const TermsPage = lazy(() => import('../features/legal/TermsPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PassesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
