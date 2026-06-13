import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatPercent, formatDateShort } from '../utils/helpers'

const C = { green: '#00d084', red: '#ff4757', yellow: '#ffd32a', orange: '#f97316', gray: '#6b7280' }

export function Stats() {
  const { stats, bankrollHistory, signals } = useApp()

  const bancaData = bankrollHistory.map((h) => ({
    date: formatDateShort(h.created_at),
    banca: h.bankroll,
    change: h.change,
  }))

  const pieData = [
    { name: 'Green',    value: stats?.greens ?? 0,      color: C.green  },
    { name: 'Red',      value: stats?.reds ?? 0,        color: C.red    },
    { name: 'Pendente', value: stats?.pending ?? 0,     color: C.yellow },
    { name: 'Revisar',  value: stats?.needsReview ?? 0, color: C.orange },
  ].filter((d) => d.value > 0)

  const marketMap: Record<string, { greens: number; reds: number; total: number }> = {}
  signals.forEach((s) => {
    const market = s.market ?? 'Outros'
    if (!marketMap[market]) marketMap[market] = { greens: 0, reds: 0, total: 0 }
    if (s.status === 'green') { marketMap[market].greens++; marketMap[market].total++ }
    if (s.status === 'red')   { marketMap[market].reds++;   marketMap[market].total++ }
  })
  const marketData = Object.entries(marketMap)
    .map(([market, c]) => ({ market: market.slice(0, 22), ...c }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Desempenho completo da sua banca</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Banca Atual',    value: formatCurrency(stats?.currentBankroll ?? 0) },
          { label: 'Banca Inicial',  value: formatCurrency(stats?.initialBankroll ?? 0) },
          { label: 'Lucro Total',    value: formatCurrency(stats?.totalProfitLoss ?? 0) },
          { label: 'ROI',            value: formatPercent(stats?.roi ?? 0) },
          { label: 'Taxa de Acerto', value: formatPercent(stats?.winRate ?? 0) },
          { label: 'Odd Média',      value: (stats?.avgOdd ?? 0).toFixed(2) },
        ].map(({ label, value }) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold font-mono text-white">{value}</p>
          </Card>
        ))}
      </div>

      {bancaData.length > 1 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Evolução da Banca</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bancaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bancaGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#2e2e3a" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#2e2e3a" tick={{ fill: '#555', fontSize: 11 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={60} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid #2e2e3a', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [
                  name === 'banca' ? formatCurrency(v) : (v >= 0 ? '+' : '') + formatCurrency(v),
                  name === 'banca' ? 'Banca' : 'Variação',
                ]}
                labelStyle={{ color: '#888' }}
              />
              <Area type="monotone" dataKey="banca" stroke={C.green} strokeWidth={2} fill="url(#bancaGrad2)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Distribuição de Resultados</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {marketData.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Mercados por Resultado</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={marketData} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" stroke="#2e2e3a" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} />
                <YAxis dataKey="market" type="category" stroke="#2e2e3a" tick={{ fill: '#666', fontSize: 10 }} width={110} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111118', border: '1px solid #2e2e3a', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: '#1a1a24' }}
                />
                <Bar dataKey="greens" name="Green" fill={C.green} radius={[0, 4, 4, 0]} />
                <Bar dataKey="reds"   name="Red"   fill={C.red}   radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {bancaData.length > 1 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Variação por Aposta</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={bancaData.slice(-30)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" stroke="#2e2e3a" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} />
              <YAxis stroke="#2e2e3a" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}R$${v.toFixed(0)}`} width={60} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid #2e2e3a', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [(v >= 0 ? '+' : '') + formatCurrency(v), 'Resultado']}
                labelStyle={{ color: '#888' }}
              />
              <Bar
                dataKey="change"
                name="Resultado"
                radius={[3, 3, 0, 0]}
                fill="#00d084"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
