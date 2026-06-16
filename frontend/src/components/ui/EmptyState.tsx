import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-[color:var(--color-nav-hover-bg)] flex items-center justify-center text-[color:var(--color-text-muted)] mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-[color:var(--color-text-secondary)]">{title}</p>
      {description && (
        <p className="text-xs text-[color:var(--color-text-muted)] mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
