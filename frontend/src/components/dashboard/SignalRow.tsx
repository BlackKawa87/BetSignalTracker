import { useState } from 'react'
import { CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp, Slash, Pencil } from 'lucide-react'
import { Signal } from '../../types'
import { StatusBadge } from '../ui/Badge'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { useApp } from '../../contexts/AppContext'
import { EditSignalModal } from './EditSignalModal'

interface SignalRowProps {
  signal: Signal
}

export function SignalRow({ signal }: SignalRowProps) {
  const { markGreen, markRed, markVoid, deleteSignal } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const isPending = signal.status === 'pending' || signal.status === 'needs_review'

  const game =
    signal.home_team && signal.away_team
      ? `${signal.home_team} x ${signal.away_team}`
      : signal.home_team || signal.away_team || 'Jogo não identificado'

  const rowBorder =
    signal.status === 'needs_review' ? 'border-l-2 border-l-orange-400/60' : ''

  return (
    <>
      <div className={`border-b border-dark-600 last:border-0 ${rowBorder}`}>
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700/40 transition-colors">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-600 hover:text-gray-300 flex-shrink-0"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-200 truncate">{game}</span>
              <StatusBadge status={signal.status} />
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 font-mono flex-wrap">
              <span>{signal.market ?? '—'}</span>
              <span>•</span>
              <span>Odd {signal.odd?.toFixed(2) ?? '—'}</span>
              <span>•</span>
              <span>Stake {formatCurrency(signal.stake)}</span>
            </div>
            {signal.notes && (
              <p className="text-[11px] text-orange-400/70 mt-0.5 font-mono truncate">{signal.notes}</p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            {signal.profit_loss !== null ? (
              <span
                className={`text-sm font-mono font-bold ${
                  signal.profit_loss >= 0 ? 'text-accent-green' : 'text-accent-red'
                }`}
              >
                {signal.profit_loss >= 0 ? '+' : ''}
                {formatCurrency(signal.profit_loss)}
              </span>
            ) : (
              <span className="text-xs text-gray-600 font-mono">pendente</span>
            )}
            <div className="text-xs text-gray-600 mt-0.5 font-mono">{formatDate(signal.received_at)}</div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {isPending && (
              <>
                <button
                  onClick={() => markGreen(signal)}
                  title="Marcar Green"
                  className="p-1.5 rounded-lg hover:bg-accent-green/10 text-gray-600 hover:text-accent-green transition-colors"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  onClick={() => markRed(signal)}
                  title="Marcar Red"
                  className="p-1.5 rounded-lg hover:bg-accent-red/10 text-gray-600 hover:text-accent-red transition-colors"
                >
                  <XCircle size={16} />
                </button>
                <button
                  onClick={() => markVoid(signal)}
                  title="Anular"
                  className="p-1.5 rounded-lg hover:bg-gray-500/10 text-gray-700 hover:text-gray-400 transition-colors"
                >
                  <Slash size={16} />
                </button>
              </>
            )}
            <button
              onClick={() => setEditing(true)}
              title="Editar"
              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-gray-700 hover:text-blue-400 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => {
                if (confirming) {
                  deleteSignal(signal.id)
                  setConfirming(false)
                } else {
                  setConfirming(true)
                  setTimeout(() => setConfirming(false), 3000)
                }
              }}
              title={confirming ? 'Confirmar exclusão' : 'Excluir'}
              className={`p-1.5 rounded-lg transition-colors ${
                confirming
                  ? 'bg-accent-red/20 text-accent-red'
                  : 'text-gray-700 hover:text-accent-red hover:bg-accent-red/10'
              }`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-3 ml-7 bg-dark-900/30">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-gray-500 pt-2">
              {signal.competition && (
                <>
                  <span className="text-gray-600">Campeonato</span>
                  <span className="text-gray-400">{signal.competition}</span>
                </>
              )}
              {signal.bookmaker && (
                <>
                  <span className="text-gray-600">Casa</span>
                  <span className="text-gray-400">{signal.bookmaker}</span>
                </>
              )}
              {signal.match_time && (
                <>
                  <span className="text-gray-600">Horário</span>
                  <span className="text-gray-400">{signal.match_time}</span>
                </>
              )}
              <span className="text-gray-600">Sinal original</span>
              <span className="text-gray-400 break-all">{signal.raw_text}</span>
            </div>
          </div>
        )}
      </div>
      {editing && <EditSignalModal signal={signal} onClose={() => setEditing(false)} />}
    </>
  )
}
