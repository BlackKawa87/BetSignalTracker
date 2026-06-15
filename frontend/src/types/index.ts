export type SignalStatus = 'pending' | 'needs_review' | 'green' | 'red' | 'void'

export type MarketCategory =
  | 'Result'
  | 'Both Teams To Score'
  | 'Over Under'
  | 'Handicap'
  | 'Double Chance'
  | 'Team Total Goals'
  | 'Corners'
  | 'Race to Corners'
  | 'Cards'
  | 'Player Shots'
  | 'Player Shots On Target'
  | 'Bet Builder'
  | 'Time Window'
  | 'Other'

export interface BetLeg {
  market: string
  selection: string
  line: string | null
}

export type TelegramSourceType =
  | 'text'
  | 'image'
  | 'image_with_caption'
  | 'document_image'
  | 'unknown'

export interface Signal {
  id: string
  created_at: string
  received_at: string
  home_team: string | null
  away_team: string | null
  market: string | null
  market_category: MarketCategory | null
  selection: string | null
  period: string | null
  line: string | null
  team: string | null
  player: string | null
  is_bet_builder: boolean | null
  legs: BetLeg[] | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  stake: number
  status: SignalStatus
  profit_loss: number | null
  raw_text: string
  caption_text: string | null
  ai_raw_json: string | null
  image_url: string | null
  telegram_file_id: string | null
  source_type: TelegramSourceType | null
  forwarded_from: string | null
  stake_percentage_from_signal: number | null
  telegram_message_id: number | null
  notes: string | null
  confidence_score: number | null
  updated_at: string
}

export interface AIParseResult {
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  is_multiple: boolean
  stake_pct: number | null
  confidence_score: number
  teams_confidence: number
  odd_confidence: number
  market_confidence: number
  reasoning: string
  status: 'pending' | 'needs_review'
  missing_fields: string[]
}

// Result from POST /api/parse/image
export interface ImagePick {
  market_category: MarketCategory | null
  market_name: string | null
  match: string | null
  competition: string | null
  team: string | null
  player: string | null
  line: string | null
  period: string | null
  selection: string | null
  odd: number | null
  is_bet_builder: boolean
  legs: BetLeg[]
  confidence_score: number
  raw_description: string | null
}

export interface ImageParseResult {
  picks: ImagePick[]
  raw_ai_json: string
  parse_error?: string
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
