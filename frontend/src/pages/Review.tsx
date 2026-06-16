import { useState, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Edit3,
  ChevronDown, ChevronUp, Clock, Zap, Brain, Image, ZoomIn,
  Tag, Layers,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/Badge'
import { EditSignalModal } from '../components/dashboard/EditSignalModal'
import { formatDate, formatCurrency } from '../utils/helpers'
import { Signal, AIParseResult, BetLeg } from '../types'

// ── Confidence helpers ────────────────────────────────────────

function confidenceBadge(score: number | null) {
  if (score === null) return { label: 'Sem score', color: 'text-[color:var(--color-text-muted)]', bg: 'bg-gray-500/10 border-gray-500/20' }
  if (score < 50)    return { label: `${score}%`, color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' }
  if (score < 70)    return { label: `${score}%`, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' }
  return               { label: `${score}%`, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' }
}

function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null) return <div className="text-xs text-[color:var(--color-text-muted)] font-mono">—</div>
  const b = confidenceBadge(score)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[color:var(--color-input-border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${score}%`,
            background: score < 50 ? '#f87171' : score < 70 ? '#fb923c' : '#facc15',
          }}
        />
      </div>
      <span className={`text-xs font-mono font-bold ${b.color}`}>{b.label}</span>
    </div>
  )
}

// ── Re-parse button ───────────────────────────────────────────

function ReparseButton({ signal, onResult }: { signal: Signal; onResult: (r: AIParseResult) => void }) {
  const [loading, setLoading] = useState(false)

  const handleReparse = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/parse/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: signal.raw_text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: AIParseResult = await res.json()
      onResult(data)
    } catch (err) {
      alert(`Erro ao re-processar: ${String(err)}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleReparse}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:border-gray-500 transition-colors disabled:opacity-40"
    >
      {loading ? <RefreshCw size={12} className="animate-spin" /> : <Brain size={12} />}
      {loading ? 'Re-analisando...' : 'Re-processar IA'}
    </button>
  )
}

// ── Field row ─────────────────────────────────────────────────

function Field({ label, value, missing }: { label: string; value: string | null; missing?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono truncate max-w-[140px] ${missing || !value ? 'text-[color:var(--color-text-muted)] italic' : 'text-[color:var(--color-text-primary)]'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ── Image viewer ──────────────────────────────────────────────

function ImageViewer({ imageUrl }: { imageUrl: string }) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <>
      <div className="px-4 py-3 border-t border-[color:var(--color-border)]">
        <div className="flex items-center gap-2 mb-2">
          <Image size={11} className="text-blue-400" />
          <span className="text-[9px] text-blue-400 font-mono uppercase tracking-wider">Imagem original</span>
        </div>
        <div
          className="relative cursor-zoom-in group overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)]"
          onClick={() => setZoomed(true)}
          style={{ maxHeight: 220 }}
        >
          <img
            src={imageUrl}
            alt="Betting slip"
            className="w-full object-contain"
            style={{ maxHeight: 220 }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <ZoomIn size={24} className="text-white" />
          </div>
        </div>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomed(false)}
        >
          <img
            src={imageUrl}
            alt="Betting slip (zoom)"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl font-mono"
            onClick={() => setZoomed(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

// ── Bet Builder legs ──────────────────────────────────────────

function BetBuilderLegs({ legs }: { legs: BetLeg[] }) {
  if (!legs.length) return null
  return (
    <div className="px-4 pb-3 border-b border-[color:var(--color-border)]">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers size={11} className="text-purple-400" />
        <span className="text-[9px] text-purple-400 font-mono uppercase tracking-wider">Legs do Bet Builder</span>
      </div>
      <div className="space-y-1">
        {legs.map((leg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-purple-400/60 w-4">{i + 1}.</span>
            <span className="text-[color:var(--color-text-secondary)]">{leg.market}</span>
            <span className="text-[color:var(--color-text-muted)]">—</span>
            <span className="text-[color:var(--color-text-primary)]">{leg.selection}</span>
            {leg.line && <span className="text-[color:var(--color-text-muted)]">({leg.line})</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Signal review card ────────────────────────────────────────

function ReviewCard({ signal }: { signal: Signal }) {
  const { updateSignal, markGreen, markRed, deleteSignal, showToast } = useApp()
  const [expanded, setExpanded]           = useState(false)
  const [showEdit, setShowEdit]           = useState(false)
  const [editSignal, setEditSignal]       = useState<Signal>(signal)
  const [reparseResult, setReparseResult] = useState<AIParseResult | null>(null)
  const [approving, setApproving]         = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const conf = confidenceBadge(signal.confidence_score)

  const handleApprove = async () => {
    setApproving(true)
    await updateSignal(signal.id, { status: 'pending' })
    showToast('Sinal aprovado — status definido como Pendente', 'success')
    setApproving(false)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 3000)
      return
    }
    setDeleting(true)
    await deleteSignal(signal.id)
    showToast('Sinal removido', 'info')
  }

  const handleReparseResult = useCallback(async (result: AIParseResult) => {
    setReparseResult(result)
    if (result.confidence_score >= 80) {
      await updateSignal(signal.id, {
        home_team: result.home_team,
        away_team: result.away_team,
        market: result.market,
        odd: result.odd,
        competition: result.competition ?? signal.competition,
        bookmaker: result.bookmaker ?? signal.bookmaker,
        match_time: result.match_time ?? signal.match_time,
        confidence_score: result.confidence_score,
        status: 'pending',
        notes: signal.notes,
      })
      showToast(`Re-analisado com confiança ${result.confidence_score}% — aprovado automaticamente`, 'success')
      setReparseResult(null)
    }
  }, [signal, updateSignal, showToast])

  const handleApplyReparse = async () => {
    if (!reparseResult) return
    const updated: Signal = {
      ...signal,
      home_team:    reparseResult.home_team    ?? signal.home_team,
      away_team:    reparseResult.away_team    ?? signal.away_team,
      market:       reparseResult.market       ?? signal.market,
      odd:          reparseResult.odd          ?? signal.odd,
      competition:  reparseResult.competition  ?? signal.competition,
      bookmaker:    reparseResult.bookmaker    ?? signal.bookmaker,
      match_time:   reparseResult.match_time   ?? signal.match_time,
      confidence_score: reparseResult.confidence_score,
    }
    setEditSignal(updated)
    setReparseResult(null)
    setShowEdit(true)
  }

  const missingFields = signal.notes?.match(/Revisão: (.+?)(?:\s*\|.*)?$/)?.[1]?.split(', ') ?? []
  const aiNote = signal.notes?.match(/IA: (.+?)(?:\s*\|.*)?$/)?.[1] ?? null
  const gameLabel = signal.home_team && signal.away_team
    ? `${signal.home_team} x ${signal.away_team}`
    : signal.home_team || 'Jogo desconhecido'

  const legs = signal.legs ?? []
  const hasBetBuilder = signal.is_bet_builder && legs.length > 0

  return (
    <>
      <Card className={`overflow-hidden transition-colors ${signal.confidence_score !== null && signal.confidence_score < 50 ? 'border-red-400/20' : 'border-orange-400/20'}`}>

        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${conf.bg} ${conf.color} flex-shrink-0`}>
              {conf.label}
            </span>
            <StatusBadge status={signal.status} />
            {signal.market_category && (
              <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 flex-shrink-0">
                <Tag size={8} />
                {signal.market_category}
              </span>
            )}
            <span className="text-sm text-[color:var(--color-text-primary)] font-medium truncate">{gameLabel}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <Clock size={11} className="text-[color:var(--color-text-muted)]" />
            <span className="text-[10px] text-[color:var(--color-text-muted)] font-mono">{formatDate(signal.received_at)}</span>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="px-4 py-2 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider w-20">Confiança IA</span>
            <div className="flex-1">
              <ConfidenceBar score={signal.confidence_score} />
            </div>
          </div>
          {missingFields.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertTriangle size={10} className="text-orange-400 flex-shrink-0" />
              <span className="text-[10px] text-orange-400/80">
                Campos ausentes: {missingFields.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Fields grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 px-4 py-3 border-b border-[color:var(--color-border)]">
          <Field label="Mercado"    value={signal.market} missing={!signal.market} />
          <Field label="Odd"        value={signal.odd?.toFixed(2) ?? null} missing={!signal.odd} />
          <Field label="Stake"      value={formatCurrency(signal.stake)} />
          <Field label="Campeonato" value={signal.competition} />
          {signal.selection && <Field label="Seleção" value={signal.selection} />}
          {signal.period    && <Field label="Período" value={signal.period} />}
          {signal.line      && <Field label="Linha"   value={signal.line} />}
          {signal.team      && <Field label="Time"    value={signal.team} />}
          {signal.player    && <Field label="Jogador" value={signal.player} />}
        </div>

        {/* Bet Builder legs */}
        {hasBetBuilder && <BetBuilderLegs legs={legs} />}

        {/* Image viewer */}
        {signal.image_url && <ImageViewer imageUrl={signal.image_url} />}

        {/* Re-parse result preview */}
        {reparseResult && (
          <div className="mx-4 mb-3 p-3 bg-[color:var(--color-input-bg)] border border-[color:var(--color-border)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Brain size={12} className="text-blue-400" />
                <span className="text-xs font-semibold text-blue-400">Resultado do re-parse</span>
                <span className={`text-[10px] font-mono font-bold ml-1 ${confidenceBadge(reparseResult.confidence_score).color}`}>
                  {reparseResult.confidence_score}%
                </span>
              </div>
              <button onClick={() => setReparseResult(null)} className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] text-xs">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono mb-2">
              <div><span className="text-[color:var(--color-text-muted)]">Times: </span><span className="text-[color:var(--color-text-secondary)]">{reparseResult.home_team && reparseResult.away_team ? `${reparseResult.home_team} x ${reparseResult.away_team}` : '—'}</span></div>
              <div><span className="text-[color:var(--color-text-muted)]">Mercado: </span><span className="text-[color:var(--color-text-secondary)]">{reparseResult.market ?? '—'}</span></div>
              <div><span className="text-[color:var(--color-text-muted)]">Odd: </span><span className="text-[color:var(--color-text-secondary)]">{reparseResult.odd?.toFixed(2) ?? '—'}</span></div>
              <div><span className="text-[color:var(--color-text-muted)]">Liga: </span><span className="text-[color:var(--color-text-secondary)]">{reparseResult.competition ?? '—'}</span></div>
            </div>
            {reparseResult.reasoning && (
              <p className="text-[10px] text-[color:var(--color-text-muted)] italic mb-2">💡 {reparseResult.reasoning}</p>
            )}
            <button
              onClick={handleApplyReparse}
              className="w-full text-xs py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
            >
              Aplicar campos e abrir editor
            </button>
          </div>
        )}

        {/* Raw text / JSON toggle */}
        <div className="border-t border-[color:var(--color-border)]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[color:var(--color-nav-hover-bg)] transition-colors"
          >
            {expanded ? <ChevronUp size={12} className="text-[color:var(--color-text-muted)]" /> : <ChevronDown size={12} className="text-[color:var(--color-text-muted)]" />}
            <span className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider">Texto / JSON original</span>
            {aiNote && !expanded && (
              <span className="ml-auto text-[10px] text-[color:var(--color-text-muted)] truncate max-w-[200px]">💡 {aiNote}</span>
            )}
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-2">
              <pre className="text-xs text-[color:var(--color-text-secondary)] bg-[color:var(--color-input-bg)] rounded-lg p-3 whitespace-pre-wrap break-all font-mono leading-relaxed">
                {signal.raw_text}
              </pre>
              {signal.ai_raw_json && (
                <details className="text-xs">
                  <summary className="text-[10px] text-[color:var(--color-text-muted)] font-mono cursor-pointer hover:text-[color:var(--color-text-secondary)] mb-1">
                    JSON bruto da IA ▸
                  </summary>
                  <pre className="mt-1 text-[color:var(--color-text-muted)] bg-[color:var(--color-nav-hover-bg)] rounded-lg p-3 whitespace-pre-wrap break-all font-mono leading-relaxed overflow-auto max-h-48">
                    {signal.ai_raw_json}
                  </pre>
                </details>
              )}
              {aiNote && (
                <p className="text-[10px] text-[color:var(--color-text-muted)] italic">💡 {aiNote}</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-nav-hover-bg)] flex-wrap">
          <ReparseButton signal={signal} onResult={handleReparseResult} />

          <button
            onClick={() => { setEditSignal(signal); setShowEdit(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:border-gray-500 transition-colors"
          >
            <Edit3 size={12} />
            Editar
          </button>

          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
          >
            <Zap size={12} />
            {approving ? 'Aprovando...' : 'Aprovar'}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => markGreen(signal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/20 transition-colors"
            >
              <CheckCircle size={12} />
              Green
            </button>

            <button
              onClick={() => markRed(signal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red hover:bg-accent-red/20 transition-colors"
            >
              <XCircle size={12} />
              Red
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                deleteConfirm
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:text-red-400 hover:border-red-500/30'
              }`}
            >
              {deleteConfirm ? 'Confirmar?' : 'Deletar'}
            </button>
          </div>
        </div>
      </Card>

      {showEdit && (
        <EditSignalModal
          signal={editSignal}
          onClose={() => { setShowEdit(false); setEditSignal(signal) }}
        />
      )}
    </>
  )
}

// ── Filter tabs ───────────────────────────────────────────────

type FilterTab = 'all' | 'critical' | 'low' | 'no_score'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'Todos' },
  { id: 'critical', label: 'Crítico (< 50%)' },
  { id: 'low',      label: 'Baixo (50–79%)' },
  { id: 'no_score', label: 'Sem score' },
]

// ── Page ──────────────────────────────────────────────────────

export function ReviewPage() {
  const { signals } = useApp()
  const [tab, setTab] = useState<FilterTab>('all')
  const [sortBy, setSortBy] = useState<'date' | 'confidence'>('confidence')

  const reviewSignals = signals.filter((s) => s.status === 'needs_review')

  const filtered = reviewSignals.filter((s) => {
    if (tab === 'all')      return true
    if (tab === 'critical') return s.confidence_score !== null && s.confidence_score < 50
    if (tab === 'low')      return s.confidence_score !== null && s.confidence_score >= 50 && s.confidence_score < 80
    if (tab === 'no_score') return s.confidence_score === null
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'confidence') {
      const sa = a.confidence_score ?? -1
      const sb = b.confidence_score ?? -1
      return sa - sb
    }
    return b.received_at.localeCompare(a.received_at)
  })

  const avgConf = reviewSignals.filter((s) => s.confidence_score !== null).length > 0
    ? Math.round(
        reviewSignals
          .filter((s) => s.confidence_score !== null)
          .reduce((a, s) => a + (s.confidence_score ?? 0), 0) /
        reviewSignals.filter((s) => s.confidence_score !== null).length,
      )
    : null

  if (reviewSignals.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Revisão de Sinais"
          subtitle="Confira sinais com baixa confiança antes de entrar ou registrar o resultado."
        />
        <Card>
          <EmptyState
            icon={<CheckCircle size={20} />}
            title="Nenhum sinal pendente de revisão."
            description="Os sinais recentes foram interpretados com confiança suficiente."
          />
        </Card>
      </div>
    )
  }

  const sortControl = (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[color:var(--color-text-muted)] font-mono">Ordenar:</label>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as 'date' | 'confidence')}
        className="text-xs rounded-lg px-2 py-1.5 bg-[color:var(--color-input-bg)] border border-[color:var(--color-input-border)] text-[color:var(--color-text-primary)] focus:outline-none focus:border-brand"
      >
        <option value="confidence">Menor confiança primeiro</option>
        <option value="date">Mais recente primeiro</option>
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisão de Sinais"
        subtitle="Confira sinais com baixa confiança antes de entrar ou registrar o resultado."
        actions={sortControl}
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Para revisar</p>
          <p className="text-3xl font-bold font-mono text-orange-400">{reviewSignals.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Confiança média</p>
          <p className={`text-3xl font-bold font-mono ${
            avgConf === null ? 'text-[color:var(--color-text-muted)]'
            : avgConf < 50 ? 'text-red-400'
            : avgConf < 70 ? 'text-orange-400'
            : 'text-yellow-400'
          }`}>
            {avgConf !== null ? `${avgConf}%` : '—'}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Críticos (&lt; 50%)</p>
          <p className="text-3xl font-bold font-mono text-red-400">
            {reviewSignals.filter((s) => s.confidence_score !== null && s.confidence_score < 50).length}
          </p>
        </Card>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/15 rounded-lg">
        <Brain size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
          <span className="font-semibold text-blue-400">Como funciona: </span>
          A IA analisa cada sinal e atribui uma pontuação de confiança (0–100%) baseada na clareza dos campos times, mercado e odd.
          Sinais abaixo de 80% são salvos aqui para revisão.
          Sinais de imagem exibem o <strong className="text-[color:var(--color-text-secondary)]">visualizador</strong> para conferência manual.
          Use <strong className="text-[color:var(--color-text-secondary)]">Re-processar IA</strong> para tentar de novo, ou edite manualmente e clique em <strong className="text-[color:var(--color-text-secondary)]">Aprovar</strong>.
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[color:var(--color-border)]">
        {TABS.map((t) => {
          const count = t.id === 'all' ? reviewSignals.length
            : t.id === 'critical' ? reviewSignals.filter((s) => s.confidence_score !== null && s.confidence_score < 50).length
            : t.id === 'low' ? reviewSignals.filter((s) => s.confidence_score !== null && s.confidence_score >= 50 && s.confidence_score < 80).length
            : reviewSignals.filter((s) => s.confidence_score === null).length
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-orange-400 text-orange-400'
                  : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-orange-400/20 text-orange-400' : 'bg-[color:var(--color-input-border)] text-[color:var(--color-text-muted)]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Signal cards */}
      {sorted.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-[color:var(--color-text-muted)] text-sm">Nenhum sinal nesta categoria.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((s) => (
            <ReviewCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  )
}
