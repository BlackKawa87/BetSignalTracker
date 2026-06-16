import { useState } from 'react'
import { Search, Filter, FileSearch } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { SignalRow } from '../components/dashboard/SignalRow'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { SignalStatus } from '../types'

const STATUS_FILTERS: { label: string; value: SignalStatus | 'all' }[] = [
  { label: 'Todos',     value: 'all' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Green',     value: 'green' },
  { label: 'Red',       value: 'red' },
  { label: 'Void',      value: 'void' },
]

export function History() {
  const { signals } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SignalStatus | 'all'>('all')

  const filtered = signals.filter((s) => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      (s.home_team ?? '').toLowerCase().includes(q) ||
      (s.away_team ?? '').toLowerCase().includes(q) ||
      (s.market ?? '').toLowerCase().includes(q) ||
      (s.competition ?? '').toLowerCase().includes(q) ||
      s.raw_text.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico"
        subtitle="Todos os sinais recebidos com filtros por status e busca."
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por time, mercado, campeonato..."
            className="w-full rounded-lg pl-8 pr-3 py-2 text-sm bg-[color:var(--color-input-bg)] border border-[color:var(--color-input-border)] text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={14} className="text-[color:var(--color-text-muted)] mr-1" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-mono transition-colors border ${
                statusFilter === f.value
                  ? 'bg-[color:var(--color-nav-active-bg)] text-[color:var(--color-nav-active-text)] border-brand/30'
                  : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileSearch size={18} />}
            title="Nenhum sinal encontrado."
            description="Tente ajustar os filtros ou o termo de busca."
          />
        ) : (
          <div>
            {filtered.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
