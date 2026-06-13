import { ReactNode } from 'react'
import { Card } from '../ui/Card'

interface StatCardProps {
  label: string
  value: string
  icon?: ReactNode
  subtext?: string
  accent?: 'green' | 'red' | 'yellow' | 'blue' | 'default'
}

const accentColors = {
  green: 'text-accent-green',
  red: 'text-accent-red',
  yellow: 'text-accent-yellow',
  blue: 'text-blue-400',
  default: 'text-white',
}

export function StatCard({ label, value, icon, subtext, accent = 'default' }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold font-mono ${accentColors[accent]}`}>{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg bg-dark-600 ${accentColors[accent]}`}>{icon}</div>
        )}
      </div>
    </Card>
  )
}
