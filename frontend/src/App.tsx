import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Sidebar } from './components/layout/Sidebar'
import { ToastStack } from './components/ui/Toast'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Stats } from './pages/Stats'
import { SettingsPage } from './pages/Settings'
import { AutoClosePage } from './pages/AutoClose'
import { AnalyticsPage } from './pages/Analytics'
import { ReviewPage } from './pages/Review'
import { SystemStatusPage } from './pages/SystemStatus'
import { TestLabPage } from './pages/TestLab'
import { SignalIntelligencePage } from './pages/SignalIntelligence'
import { BancaPage } from './pages/Banca'

function Layout() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <Routes>
            <Route path="/"                    element={<Dashboard />} />
            <Route path="/historico"           element={<History />} />
            <Route path="/estatisticas"        element={<Stats />} />
            <Route path="/auto-close"          element={<AutoClosePage />} />
            <Route path="/analytics"           element={<AnalyticsPage />} />
            <Route path="/revisao"             element={<ReviewPage />} />
            <Route path="/system-status"       element={<SystemStatusPage />} />
            <Route path="/test-lab"            element={<TestLabPage />} />
            <Route path="/configuracoes"       element={<SettingsPage />} />
            <Route path="/signal-intelligence" element={<SignalIntelligencePage />} />
            <Route path="/banca"               element={<BancaPage />} />
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
      <ThemeProvider>
        <AppProvider>
          <Layout />
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
