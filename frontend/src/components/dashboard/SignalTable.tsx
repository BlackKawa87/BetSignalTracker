import { useState } from 'react'
import { CheckCircle, XCircle, Slash, Trash2, Pencil } from 'lucide-react'
import { Signal } from '../../types'
import { StatusBadge } from '../ui/Badge'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { useApp } from '../../contexts/AppContext'
import { EditSignalModal } from './EditSignalModal'

interface SignalTableProps {
  signals: Signal[]
  emptyMessage?: string
}

export function SignalTable({ signals, emptyMessage = 'Nenhum sinal.' }: SignalTableProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-600 text-[10px] font-mono text-gray-600 uppercase tracking-wider select-none">
          <span className="w-28 flex-shrink-0">Data</span>
          <span className="flex-1 min-w-0">Jogo</span>
          <span className="w-36 flex-shrink-0">Mercado</span>
          <span className="w-14 flex-shrink-0 text-right">Odd</span>
          <span className="w-24 flex-shrink-0 text-right">Stake</span>
          <span className="w-24 flex-shrink-0">Status</span>
          <span className="w-24 flex-shrink-0 text-right">L/P</span>
          <span className="w-32 flex-shrink-0 text-right">Ações</span>
        </div>

        {signals.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-600 text-sm">{emptyMessage}</div>
        ) : (
          signals.map((s) => <SignalRow key={s.id} signal={s} />)
        )}
      </div>
    </div>
  )
}

function SignalRow({ signal }: { signal: Signal }) {
  const { markGreen, markRed, markVoid, deleteSignal } = useApp()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const isPending = signal.status === 'pending' || signal.status === 'needs_review'

  const game =
    signal.home_team && signal.away_team
      ? `${signal.home_team} x ${signal.away_team}`
      : signal.home_team || signal.away_team || 'Não identificado'

  const rowBorder =
    signal.status === 'needs_review'
      ? 'border-l-2 border-l-orange-400/60 bg-orange-400/[0.02]'
      : ''

  return (
    <>
      <div
        className={`flex items-center gap-2 px-4 py-3 border-b border-dark-600 last:border-0 hover:bg-dark-700/30 transition-colors ${rowBorder}`}
      >
        <span className="w-28 flex-shrink-0 text-xs text-gray-500 font-mono whitespace-nowrap">
          {formatDate(signal.received_at)}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{game}</p>
          {signal.notes && (
            <p className="text-[11px] text-orange-400/70 truncate mt-0.5 font-mono">{signal.notes}</p>
          )}
        </div>

        <span className="w-36 flex-shrink-0 text-xs text-gray-400 truncate">
          {signal.market ?? '—'}
        </span>

        <span className="w-14 flex-shrink-0 text-xs font-mono text-gray-300 text-right">
          {signal.odd?.toFixed(2) ?? '—'}
        </span>

        <span className="w-24 flex-shrink-0 text-xs font-mono text-gray-400 text-right">
          {formatCurrency(signal.stake)}
        </span>

        <span className="w-24 flex-shrink-0">
          <StatusBadge status={signal.status} />
        </span>

        <span className="w-24 flex-shrink-0 text-right">
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
            <span className="text-xs text-gray-600 font-mono">—</span>
          )}
        </span>

        <div className="w-32 flex-shrink-0 flex items-center justify-end gap-0.5">
          {isPending && (
            <>
              <button
                onClick={() => markGreen(signal)}
                title="Marcar Green"
                className="p-1.5 rounded-lg hover:bg-accent-green/10 text-gray-600 hover:text-accent-green transition-colors"
              >
                <CheckCircle size={15} />
              </button>
              <button
                onClick={() => markRed(signal)}
                title="Marcar Red"
                className="p-1.5 rounded-lg hover:bg-accent-red/10 text-gray-600 hover:text-accent-red transition-colors"
              >
                <XCircle size={15} />
              </button>
              <button
                onClick={() => markVoid(signal)}
                title="Anular"
                className="p-1.5 rounded-lg hover:bg-gray-500/10 text-gray-700 hover:text-gray-400 transition-colors"
              >
                <Slash size={14} />
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
      {editing && <EditSignalModal signal={signal} onClose={() => setEditing(false)} />}
    </>
  )
}
