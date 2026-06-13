import { Signal, DashboardStats, Settings } from '../types'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function calculateStats(signals: Signal[], settings: Settings): DashboardStats {
  const greens = signals.filter((s) => s.status === 'green')
  const reds = signals.filter((s) => s.status === 'red')
  const pending = signals.filter((s) => s.status === 'pending')
  const settled = greens.length + reds.length

  const totalProfitLoss = signals.reduce((acc, s) => acc + (s.profit_loss ?? 0), 0)
  const winRate = settled > 0 ? (greens.length / settled) * 100 : 0
  const totalStaked = [...greens, ...reds].reduce((acc, s) => acc + s.stake, 0)
  const roi = totalStaked > 0 ? (totalProfitLoss / totalStaked) * 100 : 0

  const oddsWithValue = signals.filter((s) => s.odd !== null)
  const avgOdd =
    oddsWithValue.length > 0
      ? oddsWithValue.reduce((acc, s) => acc + (s.odd ?? 0), 0) / oddsWithValue.length
      : 0

  return {
    initialBankroll: settings.initial_bankroll,
    currentBankroll: settings.current_bankroll,
    stakePercentage: settings.stake_percentage,
    totalSignals: signals.length,
    greens: greens.length,
    reds: reds.length,
    pending: pending.length,
    winRate,
    roi,
    totalProfitLoss,
    avgOdd,
  }
}

export function calculateStake(bankroll: number, percentage: number): number {
  return Math.round((bankroll * percentage) / 100 * 100) / 100
}

export function calculateGreenProfit(stake: number, odd: number): number {
  return Math.round(stake * (odd - 1) * 100) / 100
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'green':
      return 'text-accent-green'
    case 'red':
      return 'text-accent-red'
    case 'pending':
      return 'text-accent-yellow'
    case 'void':
      return 'text-gray-400'
    default:
      return 'text-gray-400'
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'green':
      return 'bg-accent-green/10 text-accent-green border border-accent-green/20'
    case 'red':
      return 'bg-accent-red/10 text-accent-red border border-accent-red/20'
    case 'pending':
      return 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20'
    case 'void':
      return 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
    default:
      return 'bg-gray-500/10 text-gray-400'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'green':
      return 'Green ✓'
    case 'red':
      return 'Red ✗'
    case 'pending':
      return 'Pendente'
    case 'void':
      return 'Void'
    default:
      return status
  }
}
