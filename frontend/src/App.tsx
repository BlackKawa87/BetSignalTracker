import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { Sidebar } from './components/layout/Sidebar'
import { ToastStack } from './components/ui/Toast'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Stats } from './pages/Stats'
import { SettingsPage } from './pages/Settings'
import { AutoClosePage } from './pages/AutoClose'

function Layout() {
  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/historico"   element={<History />} />
            <Route path="/estatisticas" element={<Stats />} />
            <Route path="/auto-close"  element={<AutoClosePage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
      <ToastStack />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout />
      </AppProvider>
    </BrowserRouter>
  )
}
