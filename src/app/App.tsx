import { Navigate, Route, Routes } from 'react-router-dom'
import { EditGymPage, NewGymPage } from '../features/gyms/GymFormPage'
import GymDetailPage from '../features/gyms/GymDetailPage'
import GymsPage from '../features/gyms/GymsPage'
import TemplateFormPage from '../features/gyms/TemplateFormPage'
import HistoryPage from '../features/history/HistoryPage'
import PassesPage from '../features/passes/PassesPage'
import SettingsPage from '../features/settings/SettingsPage'
import { Layout } from './Layout'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PassesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="gyms">
          <Route index element={<GymsPage />} />
          <Route path="new" element={<NewGymPage />} />
          <Route path="user/:id/edit" element={<EditGymPage />} />
          <Route path=":kind/:id" element={<GymDetailPage />} />
          <Route path=":kind/:id/templates/new" element={<TemplateFormPage />} />
          <Route path=":kind/:id/templates/:templateId/edit" element={<TemplateFormPage />} />
        </Route>
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
