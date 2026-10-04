import { Navigate, Route, Routes } from 'react-router-dom'
import PassesPage from '../features/passes/PassesPage'
import PrivacyPage from '../features/legal/PrivacyPage'
import TermsPage from '../features/legal/TermsPage'
import SettingsPage from '../features/settings/SettingsPage'
import { Layout } from './Layout'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PassesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
