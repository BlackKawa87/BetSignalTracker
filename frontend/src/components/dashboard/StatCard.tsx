import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  icon?: ReactNode
  subtext?: string
  accent?: 'green' | 'red' | 'yellow' | 'blue' | 'default'
  trend?: 'up' | 'down' | 'neutral'
}

const accentValue: Record<NonNullable<StatCardProps['accent']>, string> = {
  green:   '#00d084',
  red:     '#ff4757',
  yellow:  '#f59e0b',
  blue:    '#3b82f6',
  default: 'var(--color-text-primary)',
}

const accentBg: Record<NonNullable<StatCardProps['accent']>, string> = {
  green:   'rgba(0,208,132,0.08)',
  red:     'rgba(255,71,87,0.08)',
  yellow:  'rgba(245,158,11,0.08)',
  blue:    'rgba(59,130,246,0.08)',
  default: 'var(--color-nav-hover-bg)',
}

export function StatCard({ label, value, icon, subtext, accent = 'default' }: StatCardProps) {
  const color = accentValue[accent]
  const bg    = accentBg[accent]
  return (
    <div className="bg-[color:var(--color-card)] border border-[color:var(--color-border)] rounded-xl shadow-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[color:var(--color-text-muted)] uppercase tracking-wider mb-2">
            {label}
          </p>
          <p className="text-2xl font-bold font-mono truncate" style={{ color }}>
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-[color:var(--color-text-muted)] mt-1.5">{subtext}</p>
          )}
        </div>
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
            style={{ background: bg, color }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
