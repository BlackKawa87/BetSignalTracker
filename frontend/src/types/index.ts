export type SignalStatus = 'pending' | 'needs_review' | 'green' | 'red' | 'void'

export interface Signal {
  id: string
  created_at: string
  received_at: string
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  stake: number
  status: SignalStatus
  profit_loss: number | null
  raw_text: string
  telegram_message_id: number | null
  notes: string | null
  updated_at: string
}

export interface Settings {
  id: string
  initial_bankroll: number
  current_bankroll: number
  stake_percentage: number
  preferred_bookmaker: string
  main_strategy: string
  telegram_bot_token: string | null
  updated_at: string
}

export interface BankrollHistory {
  id: string
  created_at: string
  bankroll: number
  change: number
  reason: string
  signal_id: string | null
}

export interface DashboardStats {
  initialBankroll: number
  currentBankroll: number
  stakePercentage: number
  totalSignals: number
  greens: number
  reds: number
  pending: number
  needsReview: number
  winRate: number
  roi: number
  totalProfitLoss: number
  avgOdd: number
  currentStake: number
}

export interface ProcessingLog {
  id: string
  created_at: string
  signal_id: string | null
  action: string
  details: Record<string, unknown>
  result: string | null
  signals?: {
    home_team: string | null
    away_team: string | null
    market: string | null
  } | null
}

export interface AutoCloseStatus {
  ok: boolean
  apiKeySet: boolean
  lastRun: string | null
  eligiblePending: number
  today: { closed: number; green: number; red: number }
}

export interface ParsedSignal {
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  raw_text: string
}
