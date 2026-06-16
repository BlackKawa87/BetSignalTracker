import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, History, BarChart2, Settings, Zap,
  Bot, TrendingUp, AlertTriangle, Activity, FlaskConical,
  Brain, Wallet, type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { ThemeToggle } from '../ui/ThemeToggle'
import { formatCurrency } from '../../utils/helpers'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

interface NavSection {
  heading: string
  items: NavItem[]
}

export function Sidebar() {
  const { settings, stats } = useApp()
  const [advancedMode] = useState(() => localStorage.getItem('bst_advanced') === 'true')

  const navSections: NavSection[] = [
    {
      heading: 'Principal',
      items: [
        { to: '/',                    label: 'Central de Sinais',      icon: LayoutDashboard, end: true },
        { to: '/revisao',             label: 'Revisão de Sinais',      icon: AlertTriangle,   badge: stats?.needsReview },
        { to: '/signal-intelligence', label: 'Inteligência do Sinal',  icon: Brain },
        { to: '/analytics',           label: 'Desempenho',             icon: TrendingUp },
        { to: '/auto-close',          label: 'Fechamento Automático',  icon: Bot },
      ],
    },
    {
      heading: 'Gestão',
      items: [
        { to: '/banca',     label: 'Banca',     icon: Wallet },
        { to: '/historico', label: 'Histórico', icon: History },
      ],
    },
    {
      heading: 'Sistema',
      items: [
        { to: '/configuracoes',  label: 'Configurações',        icon: Settings },
        { to: '/system-status',  label: 'Status da Plataforma', icon: Activity },
        ...(advancedMode ? [
          { to: '/estatisticas', label: 'Estatísticas',         icon: BarChart2 },
          { to: '/test-lab',     label: 'Laboratório',          icon: FlaskConical },
        ] : []),
      ],
    },
  ]

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col min-h-screen border-r"
      style={{
        background: 'var(--color-sidebar-bg)',
        borderColor: 'var(--color-sidebar-border)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
            <Zap size={15} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none" style={{ color: 'var(--color-text-primary)' }}>BetSignal</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Tracker</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Bankroll summary */}
      {settings && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-sidebar-border)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Banca atual
          </p>
          <p className="text-lg font-bold font-mono text-brand">
            {formatCurrency(settings.current_bankroll)}
          </p>
          {stats && (
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: stats.totalProfitLoss >= 0 ? '#00d084' : '#ff4757' }}
            >
              {stats.totalProfitLoss >= 0 ? '+' : ''}
              {formatCurrency(stats.totalProfitLoss)} total
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.heading}>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {section.heading}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--color-nav-active-bg)] text-[var(--color-nav-active-text)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-nav-hover-bg)]'
                    }`
                  }
                >
                  <Icon size={15} />
                  <span className="flex-1">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="text-[10px] font-bold bg-orange-100 text-orange-600 dark:bg-orange-400/20 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-mono">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer stats */}
      {stats && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'var(--color-sidebar-border)' }}
        >
          <div className="flex justify-between text-xs font-mono">
            <span className="text-brand font-semibold">{stats.greens}W</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{stats.winRate.toFixed(0)}% acerto</span>
            <span className="text-accent-red font-semibold">{stats.reds}L</span>
          </div>
        </div>
      )}
    </aside>
  )
}
