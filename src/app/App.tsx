import { Navigate, Route, Routes } from 'react-router-dom'
import PassesPage from '../features/passes/PassesPage'
import SettingsPage from '../features/settings/SettingsPage'
import { Layout } from './Layout'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PassesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
