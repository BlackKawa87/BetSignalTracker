import { SignalStatus } from '../../types'

const STATUS_CONFIG: Record<SignalStatus, { label: string; className: string }> = {
  pending:      { label: 'Aguardando',    className: 'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-400/10  dark:text-amber-400  dark:border-amber-400/20'  },
  needs_review: { label: 'Revisar',       className: 'bg-orange-50  text-orange-700  border-orange-200  dark:bg-orange-400/10 dark:text-orange-400 dark:border-orange-400/20' },
  green:        { label: 'Green ✓',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20' },
  red:          { label: 'Red ✗',         className: 'bg-red-50     text-red-700     border-red-200     dark:bg-red-400/10    dark:text-red-400    dark:border-red-400/20'    },
  void:         { label: 'Anulada',       className: 'bg-gray-100   text-gray-500    border-gray-200    dark:bg-gray-600/20   dark:text-gray-400   dark:border-gray-600/30'  },
}

export function StatusBadge({ status }: { status: SignalStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${className}`}>
      {label}
    </span>
  )
}
