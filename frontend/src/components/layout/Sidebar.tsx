import { NavLink } from 'react-router-dom'
import { LayoutDashboard, History, BarChart2, Settings, Zap } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { formatCurrency } from '../../utils/helpers'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/historico', label: 'Histórico', icon: History, end: false },
  { to: '/estatisticas', label: 'Estatísticas', icon: BarChart2, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export function Sidebar() {
  const { settings, stats } = useApp()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-dark-800 border-r border-dark-600 min-h-screen">
      <div className="px-5 py-5 border-b border-dark-600">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
            <Zap size={14} className="text-accent-green" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">BetSignal</p>
            <p className="text-[10px] text-gray-500 font-mono">Tracker</p>
          </div>
        </div>
      </div>

      {settings && (
        <div className="px-4 py-3 border-b border-dark-600">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Banca</p>
          <p className="text-base font-bold font-mono text-accent-green mt-0.5">
            {formatCurrency(settings.current_bankroll)}
          </p>
          {stats && (
            <p className={`text-[10px] font-mono mt-0.5 ${stats.totalProfitLoss >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {stats.totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(stats.totalProfitLoss)} total
            </p>
          )}
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {stats && (
        <div className="px-4 py-3 border-t border-dark-600">
          <div className="flex justify-between text-xs font-mono text-gray-600">
            <span className="text-accent-green">{stats.greens}W</span>
            <span className="text-gray-500">{stats.winRate.toFixed(0)}%</span>
            <span className="text-accent-red">{stats.reds}L</span>
          </div>
        </div>
      )}
    </aside>
  )
}
