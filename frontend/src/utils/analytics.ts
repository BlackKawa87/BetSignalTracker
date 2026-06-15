import { Signal } from '../types'

// ── Interfaces ────────────────────────────────────────────────

export interface GroupStats {
  label: string
  settled: number
  greens: number
  reds: number
  staked: number
  profit: number
  roi: number
  winRate: number
  avgOdd: number
}

export interface MonthStats extends GroupStats {
  month: string   // YYYY-MM
  shortLabel: string // "Jan 25"
  voids: number
}

export interface DailyStats {
  date: string    // YYYY-MM-DD
  label: string   // "14/06"
  profit: number
  cumulative: number
  greens: number
  reds: number
}

export interface WeeklyStats {
  week: string    // "2025-W23"
  label: string
  profit: number
  greens: number
  reds: number
  settled: number
  roi: number
  staked: number
}

export interface OddsRangeStats extends GroupStats {
  rangeLabel: string
  min: number
  max: number
}

export interface StreakData {
  currentStreak: number
  currentType: 'green' | 'red' | 'none'
  bestGreenStreak: number
  worstRedStreak: number
}

export interface HeatmapCell {
  date: string
  profit: number
  count: number
  hasData: boolean
  dayOfWeek: number // 0=Mon, 6=Sun
}

export interface AnalyticsData {
  monthly: MonthStats[]
  byCompetition: GroupStats[]
  byMarket: GroupStats[]
  byOddsRange: OddsRangeStats[]
  streaks: StreakData
  daily: DailyStats[]       // last 60 days
  weekly: WeeklyStats[]     // last 16 weeks
  heatmap: HeatmapCell[]   // last 91 days, padded to full weeks
  byDayOfWeek: GroupStats[] // Mon–Sun
}

// ── Core helper ───────────────────────────────────────────────

function mkStats(label: string, signals: Signal[]): GroupStats {
  const settled = signals.filter((s) => s.status === 'green' || s.status === 'red')
  const greens  = settled.filter((s) => s.status === 'green')
  const staked  = settled.reduce((a, s) => a + s.stake, 0)
  const profit  = signals.reduce((a, s) => a + (s.profit_loss ?? 0), 0)
  const roi     = staked > 0 ? (profit / staked) * 100 : 0
  const winRate = settled.length > 0 ? (greens.length / settled.length) * 100 : 0
  const odded   = signals.filter((s) => s.odd != null)
  const avgOdd  = odded.length > 0
    ? odded.reduce((a, s) => a + (s.odd ?? 0), 0) / odded.length
    : 0

  return {
    label,
    settled: settled.length,
    greens:  greens.length,
    reds:    settled.length - greens.length,
    staked,
    profit,
    roi,
    winRate,
    avgOdd: Math.round(avgOdd * 100) / 100,
  }
}

// ── Monthly ───────────────────────────────────────────────────

function computeMonthly(signals: Signal[]): MonthStats[] {
  const map = new Map<string, Signal[]>()
  for (const s of signals) {
    const m = s.received_at.slice(0, 7)
    if (!map.has(m)) map.set(m, [])
    map.get(m)!.push(s)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, sigs]) => {
      const base    = mkStats(month, sigs)
      const voids   = sigs.filter((s) => s.status === 'void').length
      const [y, mo] = month.split('-')
      const d       = new Date(parseInt(y), parseInt(mo) - 1, 1)
      const shortLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('. de ', ' ').replace('.', '').replace(' de ', ' ')
      return { ...base, month, shortLabel, voids }
    })
}

// ── By Competition ────────────────────────────────────────────

function computeByCompetition(signals: Signal[]): GroupStats[] {
  const map = new Map<string, Signal[]>()
  for (const s of signals) {
    if (!s.competition) continue
    const key = s.competition.trim()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return Array.from(map.entries())
    .map(([label, sigs]) => mkStats(label, sigs))
    .filter((g) => g.settled >= 2)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10)
}

// ── By Market ─────────────────────────────────────────────────

function normalizeMarket(market: string): string {
  const m = market.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
  if (m.includes('ambas') || m.includes('btts')) return 'Ambas Marcam'
  if (m.includes('mais de 2.5') || m.includes('over 2.5')) return 'Over 2.5'
  if (m.includes('mais de 1.5') || m.includes('over 1.5')) return 'Over 1.5'
  if (m.includes('menos de') || m.includes('under')) return `Under ${m.match(/(\d+[.,]\d+)/)?.[1] ?? ''}`
  if (m.includes('resultado') || m.includes('1x2') || m.includes('moneyline')) return 'Resultado Final'
  if (m.includes('dupla')) return 'Dupla Hipótese'
  if (m.includes('handicap') || m.includes(' hc')) return 'Handicap'
  if (m.includes('escanteio') || m.includes('corner')) return 'Escanteios'
  if (m.includes('cartao') || m.includes('card')) return 'Cartões'
  if (m.includes('multipla') || m.includes('múltipla')) return 'Múltipla'
  return market.slice(0, 30)
}

function computeByMarket(signals: Signal[]): GroupStats[] {
  const map = new Map<string, Signal[]>()
  for (const s of signals) {
    if (!s.market) continue
    const key = normalizeMarket(s.market)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return Array.from(map.entries())
    .map(([label, sigs]) => mkStats(label, sigs))
    .filter((g) => g.settled >= 2)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10)
}

// ── By Odds Range ─────────────────────────────────────────────

const ODDS_RANGES = [
  { label: '1.01 – 1.50', rangeLabel: '1.01–1.50', min: 1.01, max: 1.50 },
  { label: '1.51 – 2.00', rangeLabel: '1.51–2.00', min: 1.51, max: 2.00 },
  { label: '2.01 – 2.50', rangeLabel: '2.01–2.50', min: 2.01, max: 2.50 },
  { label: '2.51 – 3.00', rangeLabel: '2.51–3.00', min: 2.51, max: 3.00 },
  { label: '3.01+',       rangeLabel: '3.01+',     min: 3.01, max: Infinity },
]

function computeByOddsRange(signals: Signal[]): OddsRangeStats[] {
  return ODDS_RANGES.map(({ label, rangeLabel, min, max }) => {
    const sigs = signals.filter((s) => s.odd != null && s.odd >= min && s.odd <= max)
    return { ...mkStats(label, sigs), rangeLabel, min, max }
  }).filter((g) => g.settled > 0)
}

// ── Streaks ───────────────────────────────────────────────────

function computeStreaks(signals: Signal[]): StreakData {
  const settled = [...signals]
    .filter((s) => s.status === 'green' || s.status === 'red')
    .sort((a, b) => a.received_at.localeCompare(b.received_at))

  if (settled.length === 0) {
    return { currentStreak: 0, currentType: 'none', bestGreenStreak: 0, worstRedStreak: 0 }
  }

  // Current streak (from the end backwards)
  const lastType = settled[settled.length - 1].status as 'green' | 'red'
  let currentStreak = 0
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].status === lastType) currentStreak++
    else break
  }

  // All-time best/worst
  let bestGreen = 0, worstRed = 0, runLen = 1
  for (let i = 1; i < settled.length; i++) {
    if (settled[i].status === settled[i - 1].status) {
      runLen++
    } else {
      if (settled[i - 1].status === 'green') bestGreen = Math.max(bestGreen, runLen)
      if (settled[i - 1].status === 'red')   worstRed  = Math.max(worstRed,  runLen)
      runLen = 1
    }
  }
  // flush last run
  const last = settled[settled.length - 1].status
  if (last === 'green') bestGreen = Math.max(bestGreen, runLen)
  if (last === 'red')   worstRed  = Math.max(worstRed,  runLen)

  return {
    currentStreak,
    currentType: lastType,
    bestGreenStreak: bestGreen,
    worstRedStreak:  worstRed,
  }
}

// ── Daily (last 60 days) ──────────────────────────────────────

function computeDaily(signals: Signal[]): DailyStats[] {
  const map = new Map<string, { profit: number; greens: number; reds: number }>()

  for (const s of signals) {
    if (s.profit_loss === null) continue
    const date = s.received_at.slice(0, 10)
    const cur  = map.get(date) ?? { profit: 0, greens: 0, reds: 0 }
    map.set(date, {
      profit: cur.profit + s.profit_loss,
      greens: cur.greens + (s.status === 'green' ? 1 : 0),
      reds:   cur.reds   + (s.status === 'red'   ? 1 : 0),
    })
  }

  const days: DailyStats[] = []
  const today = new Date()
  let cumulative = 0

  for (let i = 59; i >= 0; i--) {
    const d    = new Date(today)
    d.setDate(d.getDate() - i)
    const date  = d.toISOString().slice(0, 10)
    const data  = map.get(date)
    const profit = data?.profit ?? 0
    cumulative  += profit
    days.push({
      date,
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      profit,
      cumulative,
      greens: data?.greens ?? 0,
      reds:   data?.reds   ?? 0,
    })
  }

  return days
}

// ── Weekly (last 16 weeks) ────────────────────────────────────

function isoWeek(date: Date): string {
  const d  = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const wn = 1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`
}

function computeWeekly(signals: Signal[]): WeeklyStats[] {
  const map = new Map<string, Signal[]>()
  for (const s of signals) {
    const w = isoWeek(new Date(s.received_at))
    if (!map.has(w)) map.set(w, [])
    map.get(w)!.push(s)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-16)
    .map(([week, sigs]) => {
      const base    = mkStats(week, sigs)
      const [, wn]  = week.split('-W')
      return { ...base, week, label: `S${wn}` }
    })
}

// ── Calendar Heatmap (91 days padded to full Mon-Sun weeks) ──

function computeHeatmap(signals: Signal[]): HeatmapCell[] {
  const map = new Map<string, { profit: number; count: number }>()
  for (const s of signals) {
    if (s.profit_loss === null) continue
    const date = s.received_at.slice(0, 10)
    const cur  = map.get(date) ?? { profit: 0, count: 0 }
    map.set(date, { profit: cur.profit + s.profit_loss, count: cur.count + 1 })
  }

  const cells: HeatmapCell[] = []
  const today = new Date()

  // Go back 90 days
  for (let i = 90; i >= 0; i--) {
    const d   = new Date(today)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const data = map.get(date)
    const dow  = (d.getDay() + 6) % 7 // Mon=0, Sun=6
    cells.push({
      date,
      profit:  data?.profit ?? 0,
      count:   data?.count  ?? 0,
      hasData: !!data,
      dayOfWeek: dow,
    })
  }

  // Pad start so first week begins on Monday
  const firstDow = cells[0].dayOfWeek
  const padding: HeatmapCell[] = Array.from({ length: firstDow }, (_, i) => ({
    date: `pad-${i}`,
    profit: 0,
    count: 0,
    hasData: false,
    dayOfWeek: i,
  }))

  return [...padding, ...cells]
}

// ── By Day of Week ────────────────────────────────────────────

const DOW_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const DOW_SHORT  = ['Seg',     'Ter',   'Qua',    'Qui',    'Sex',   'Sáb',    'Dom']

function computeByDayOfWeek(signals: Signal[]): GroupStats[] {
  return Array.from({ length: 7 }, (_, i) => {
    const sigs = signals.filter((s) => (new Date(s.received_at).getDay() + 6) % 7 === i)
    return mkStats(DOW_SHORT[i], sigs)
  })
}

// ── Main export ───────────────────────────────────────────────

export function computeAnalytics(signals: Signal[]): AnalyticsData {
  const settled = signals.filter((s) => s.status === 'green' || s.status === 'red')
  return {
    monthly:       computeMonthly(settled),
    byCompetition: computeByCompetition(settled),
    byMarket:      computeByMarket(settled),
    byOddsRange:   computeByOddsRange(settled),
    streaks:       computeStreaks(signals),
    daily:         computeDaily(signals),
    weekly:        computeWeekly(signals),
    heatmap:       computeHeatmap(signals),
    byDayOfWeek:   computeByDayOfWeek(signals),
  }
}

// ── Color helpers ─────────────────────────────────────────────

export function roiColor(roi: number): string {
  if (roi > 10)  return '#00d084'
  if (roi > 0)   return '#4ade80'
  if (roi > -5)  return '#ffd32a'
  return '#ff4757'
}

export function profitColor(p: number): string {
  return p >= 0 ? '#00d084' : '#ff4757'
}

export function heatmapCellColor(cell: HeatmapCell, maxAbs: number): string {
  if (!cell.hasData || cell.date.startsWith('pad')) return '#111118'
  if (maxAbs === 0) return '#1a1a24'
  const intensity = Math.min(1, Math.abs(cell.profit) / maxAbs)
  const alpha = 0.15 + intensity * 0.75
  if (cell.profit > 0) return `rgba(0,208,132,${alpha.toFixed(2)})`
  if (cell.profit < 0) return `rgba(255,71,87,${alpha.toFixed(2)})`
  return '#1a1a24'
}

export { DOW_LABELS, DOW_SHORT }
