import { Signal, BankrollHistory } from '../types'

// ── CSV helpers ───────────────────────────────────────────────

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(row.map(escapeCsv).join(','))
  return lines.join('\n')
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob(['﻿' + content], { type: mime }) // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Signals export ────────────────────────────────────────────

const SIGNAL_HEADERS = [
  'ID', 'Recebido em', 'Time Casa', 'Time Fora', 'Mercado', 'Odd',
  'Stake (R$)', 'Status', 'Lucro/Prejuízo (R$)', 'Campeonato',
  'Casa de Apostas', 'Horário', 'Confiança IA (%)', 'Notas', 'Texto Original',
]

function signalRow(s: Signal): unknown[] {
  return [
    s.id, s.received_at, s.home_team, s.away_team, s.market, s.odd,
    s.stake, s.status, s.profit_loss, s.competition,
    s.bookmaker, s.match_time, s.confidence_score, s.notes, s.raw_text,
  ]
}

export function exportSignalsCsv(signals: Signal[]) {
  const content = toCsv(SIGNAL_HEADERS, signals.map(signalRow))
  download(content, `betsignal-sinais-${slug()}.csv`, 'text/csv;charset=utf-8;')
}

export function exportSignalsJson(signals: Signal[]) {
  download(JSON.stringify(signals, null, 2), `betsignal-sinais-${slug()}.json`, 'application/json')
}

// ── Bankroll history export ───────────────────────────────────

const BANKROLL_HEADERS = ['ID', 'Data', 'Banca (R$)', 'Variação (R$)', 'Motivo', 'Signal ID']

export function exportBankrollCsv(history: BankrollHistory[]) {
  const rows = history.map((h) => [h.id, h.created_at, h.bankroll, h.change, h.reason, h.signal_id])
  download(toCsv(BANKROLL_HEADERS, rows), `betsignal-banca-${slug()}.csv`, 'text/csv;charset=utf-8;')
}

// ── Full backup (JSON) ────────────────────────────────────────

export function exportFullBackupJson(data: {
  signals: Signal[]
  bankrollHistory: BankrollHistory[]
  exportedAt: string
}) {
  download(
    JSON.stringify(data, null, 2),
    `betsignal-backup-${slug()}.json`,
    'application/json',
  )
}

// ── Analytics summary CSV ─────────────────────────────────────

export function exportAnalyticsCsv(signals: Signal[]) {
  const settled = signals.filter((s) => s.status === 'green' || s.status === 'red')
  const greens  = settled.filter((s) => s.status === 'green').length
  const reds    = settled.filter((s) => s.status === 'red').length
  const profit  = settled.reduce((a, s) => a + (s.profit_loss ?? 0), 0)
  const staked  = settled.reduce((a, s) => a + s.stake, 0)
  const roi     = staked > 0 ? (profit / staked) * 100 : 0
  const winRate = settled.length > 0 ? (greens / settled.length) * 100 : 0

  // By market
  const marketMap = new Map<string, { greens: number; reds: number; profit: number; staked: number }>()
  for (const s of settled) {
    const key = s.market ?? 'Desconhecido'
    const cur = marketMap.get(key) ?? { greens: 0, reds: 0, profit: 0, staked: 0 }
    marketMap.set(key, {
      greens:  cur.greens  + (s.status === 'green' ? 1 : 0),
      reds:    cur.reds    + (s.status === 'red'   ? 1 : 0),
      profit:  cur.profit  + (s.profit_loss ?? 0),
      staked:  cur.staked  + s.stake,
    })
  }

  const summaryLines = [
    '=== RESUMO GERAL ===',
    toCsv(
      ['Métrica', 'Valor'],
      [
        ['Total de Sinais', signals.length],
        ['Encerrados', settled.length],
        ['Greens', greens],
        ['Reds', reds],
        ['Taxa de Acerto (%)', winRate.toFixed(2)],
        ['Lucro Total (R$)', profit.toFixed(2)],
        ['Total Investido (R$)', staked.toFixed(2)],
        ['ROI (%)', roi.toFixed(2)],
        ['Data de Exportação', new Date().toISOString()],
      ],
    ),
    '',
    '=== POR MERCADO ===',
    toCsv(
      ['Mercado', 'Greens', 'Reds', 'Lucro (R$)', 'Investido (R$)', 'ROI (%)'],
      Array.from(marketMap.entries()).map(([market, d]) => [
        market, d.greens, d.reds,
        d.profit.toFixed(2),
        d.staked.toFixed(2),
        d.staked > 0 ? ((d.profit / d.staked) * 100).toFixed(2) : '0.00',
      ]),
    ),
  ]

  download(summaryLines.join('\n'), `betsignal-analytics-${slug()}.csv`, 'text/csv;charset=utf-8;')
}
