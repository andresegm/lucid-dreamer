import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SettingsProvider } from '@/lib/settings'
import { AuthProvider, useAuth } from '@/lib/auth'
import { configError } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DreamsPage } from '@/pages/DreamsPage'
import { DreamDetailPage } from '@/pages/DreamDetailPage'
import { DreamFormPage } from '@/pages/DreamFormPage'
import { StatsPage } from '@/pages/StatsPage'
import { TagsPage } from '@/pages/TagsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { Spinner } from '@/components/ui'

function Gate() {
  const { session, loading } = useAuth()
  if (loading)
    return (
      <div className="min-h-full flex items-center justify-center text-muted">
        <Spinner />
      </div>
    )
  if (!session) return <LoginPage />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DreamsPage />} />
        <Route path="dream/:id" element={<DreamDetailPage />} />
        <Route path="dream/:id/edit" element={<DreamFormPage mode="edit" />} />
        <Route path="new" element={<DreamFormPage mode="new" />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function ConfigError({ message }: { message: string }) {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card max-w-md">
        <div className="font-semibold text-danger mb-1">App not configured</div>
        <p className="text-sm text-muted">{message}</p>
        <p className="text-sm text-muted mt-3">
          Copy <code>.env.example</code> to <code>.env</code> in the <code>app/</code> folder, fill in your Supabase values, and restart the dev server.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      {configError ? (
        <ConfigError message={configError} />
      ) : (
        <AuthProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </AuthProvider>
      )}
    </SettingsProvider>
  )
}
