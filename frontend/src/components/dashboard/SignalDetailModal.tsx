import { useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { Signal } from '../../types'
import { StatusBadge } from '../ui/Badge'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { EditSignalModal } from './EditSignalModal'

interface SignalDetailModalProps {
  signal: Signal
  onClose: () => void
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-600">{label}</span>
      <span className="text-sm text-gray-200 break-words">{value}</span>
    </div>
  )
}

function accumulatorTitle(legCount: number): string {
  if (legCount === 2) return 'Dupla'
  if (legCount === 3) return 'Tripla'
  return 'Múltipla'
}

export function SignalDetailModal({ signal, onClose }: SignalDetailModalProps) {
  const [editing, setEditing] = useState(false)

  const hasLegs = !!signal.legs && signal.legs.length > 0
  const title =
    signal.home_team && signal.away_team
      ? `${signal.home_team} x ${signal.away_team}`
      : hasLegs
      ? accumulatorTitle(signal.legs!.length)
      : signal.home_team || signal.away_team || 'Sinal'

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-dark-800 border border-dark-500 rounded-xl w-full max-w-xl mx-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-dark-600 sticky top-0 bg-dark-800 z-10">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg text-gray-100 font-semibold truncate">{title}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={signal.status} />
                {signal.source_type && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-dark-700 border border-dark-500 text-gray-400">
                    {signal.source_type}
                  </span>
                )}
                <span className="text-[10px] font-mono text-gray-600">
                  {formatDate(signal.received_at)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-dark-700 transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-5">
            {/* Image */}
            {signal.image_url && (
              <div className="rounded-lg overflow-hidden border border-dark-600">
                <img src={signal.image_url} alt="Sinal" className="w-full object-contain max-h-64" />
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mercado" value={signal.market} />
              <Field label="Seleção" value={signal.selection} />
              <Field label="Linha" value={signal.line} />
              <Field label="Período" value={signal.period} />
              <Field
                label="Odd"
                value={signal.odd !== null ? (
                  <span className="font-mono">{signal.odd.toFixed(2)}</span>
                ) : null}
              />
              <Field
                label="Stake"
                value={<span className="font-mono">{formatCurrency(signal.stake)}</span>}
              />
              <Field label="Competition" value={signal.competition} />
              <Field label="Bookmaker" value={signal.bookmaker} />
              <Field label="Match time" value={signal.match_time} />
              <Field
                label="Confidence"
                value={signal.confidence_score !== null ? (
                  <span className="font-mono">{signal.confidence_score}%</span>
                ) : null}
              />
              <Field label="Forwarded from" value={signal.forwarded_from} />
              <Field label="Team" value={signal.team} />
              <Field label="Player" value={signal.player} />
              <Field
                label="L/P"
                value={signal.profit_loss !== null ? (
                  <span
                    className={`font-mono font-bold ${
                      signal.profit_loss >= 0 ? 'text-accent-green' : 'text-accent-red'
                    }`}
                  >
                    {signal.profit_loss >= 0 ? '+' : ''}
                    {formatCurrency(signal.profit_loss)}
                  </span>
                ) : null}
              />
            </div>

            {/* Legs */}
            {hasLegs && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                  Apostas da acumuladora
                </h3>
                <div className="border border-dark-600 rounded-lg overflow-hidden divide-y divide-dark-600">
                  {signal.legs!.map((leg, i) => (
                    <div key={i} className="px-3 py-2 bg-dark-700/40">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-mono text-gray-600 mt-0.5">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200">
                            <span className="text-gray-400">{leg.market}</span>
                            {' — '}
                            <span className="text-gray-100">{leg.selection}</span>
                            {leg.line && <span className="text-gray-500 font-mono"> · {leg.line}</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {signal.notes && (
              <div className="space-y-1">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                  Notas
                </h3>
                <p className="text-sm text-orange-400/80 font-mono whitespace-pre-wrap">
                  {signal.notes}
                </p>
              </div>
            )}

            {/* Raw text */}
            {signal.raw_text && (
              <details className="group">
                <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-gray-300 select-none">
                  Texto bruto
                </summary>
                <pre className="mt-2 text-xs text-gray-400 bg-dark-900/60 border border-dark-600 rounded-lg p-3 whitespace-pre-wrap font-mono overflow-x-auto">
                  {signal.raw_text}
                </pre>
              </details>
            )}

            {/* AI raw JSON */}
            {signal.ai_raw_json && (
              <details className="group">
                <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-gray-300 select-none">
                  JSON da IA
                </summary>
                <pre className="mt-2 text-xs text-gray-400 bg-dark-900/60 border border-dark-600 rounded-lg p-3 whitespace-pre-wrap font-mono overflow-x-auto">
                  {signal.ai_raw_json}
                </pre>
              </details>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-dark-600 sticky bottom-0 bg-dark-800">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-blue-400 hover:bg-blue-500/10 border border-dark-500 transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-gray-300 bg-dark-700 hover:bg-dark-600 border border-dark-500 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
      {editing && (
        <EditSignalModal
          signal={signal}
          onClose={() => {
            setEditing(false)
            onClose()
          }}
        />
      )}
    </>
  )
}
