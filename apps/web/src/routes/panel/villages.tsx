import { useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { useVillageStats, useWeeklyEvolution } from '@/hooks/queries/useAnimations'
import { GlassCard } from '@/components/shared/GlassCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VILLAGE_LABELS } from '@/components/shared/VillageBadge'
import type { Village } from '@/lib/schemas/animation'

const VILLAGE_CHART_COLORS: Record<string, string> = {
  konoha: '#22c55e',
  suna: '#ca8a04',
  oto: '#7c3aed',
  kiri: '#0d9488',
  temple_camelias: '#ec4899',
  autre: '#6b7280',
  tout_le_monde: '#22d3ee',
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: '#13141A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '12px',
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div style={CUSTOM_TOOLTIP_STYLE} className="p-3">
      {payload.map((p) => (
        <p key={p.name}>
          {VILLAGE_LABELS[p.name as Village] ?? p.name}: <strong>{p.value.toFixed(1)}%</strong>
        </p>
      ))}
    </div>
  )
}

function EvolutionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={CUSTOM_TOOLTIP_STYLE} className="p-3 space-y-1">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="text-sm">
          {p.name === 'total' ? 'Total' : 'Animateur'}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Villages() {
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedPole, setSelectedPole] = useState<'anim' | 'mj'>('anim')
  const { data, isLoading } = useVillageStats()
  const { data: evoData, isLoading: evoLoading } = useWeeklyEvolution(
    selectedUser === 'all' ? null : selectedUser,
    12,
    selectedPole,
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const { currentWeek, lastFourWeeks } = data

  // Build pie data
  const pieData = Object.entries(currentWeek.byVillage)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }))

  // Build stacked bar data
  const villages = Object.keys(VILLAGE_CHART_COLORS) as Village[]
  const barData = [...lastFourWeeks, currentWeek].map((w, i) => {
    const label = i === lastFourWeeks.length ? 'Cette sem.' : `S-${lastFourWeeks.length - i}`
    return {
      name: label,
      weekStart: 'weekStart' in w ? w.weekStart : currentWeek.start,
      ...Object.fromEntries(
        villages.map((v) => [v, w.byVillage[v] ?? 0])
      ),
    }
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <PieIcon className="h-6 w-6 text-cyan-400" />
          Statistiques
        </h1>
        <p className="text-sm text-white/40 mt-0.5">
          Répartition des animations par village
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            Répartition de la semaine
          </h2>
          {pieData.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-12">Aucune donnée cette semaine</p>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={VILLAGE_CHART_COLORS[entry.name] ?? '#6b7280'}
                        opacity={0.9}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend + counts */}
              <div className="w-full mt-2 space-y-1.5">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: VILLAGE_CHART_COLORS[entry.name] ?? '#6b7280' }}
                      />
                      <span className="text-white/60">
                        {VILLAGE_LABELS[entry.name as Village] ?? entry.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 text-xs">
                        {currentWeek.counts[entry.name] ?? 0} anim.
                      </span>
                      <span className="font-semibold text-white/80 w-12 text-right">
                        {entry.value.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Bar chart */}
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            Tendance sur 4 semaines
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                    {VILLAGE_LABELS[value as Village] ?? value}
                  </span>
                )}
              />
              {villages.map((v) => (
                <Bar
                  key={v}
                  dataKey={v}
                  stackId="a"
                  fill={VILLAGE_CHART_COLORS[v]}
                  opacity={0.85}
                  radius={v === 'tout_le_monde' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Weekly evolution line chart */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Évolution hebdomadaire
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={selectedPole} onValueChange={(v) => { setSelectedPole(v as 'anim' | 'mj'); setSelectedUser('all') }}>
              <TabsList className="h-8">
                <TabsTrigger value="anim" className="text-xs px-3">Pôle Anim</TabsTrigger>
                <TabsTrigger value="mj" className="text-xs px-3">Pôle MJ</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-44 h-8 text-xs bg-white/[0.04] border-white/10">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(evoData?.profiles ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {evoLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={evoData?.weeks ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<EvolutionTooltip />} />
              {selectedUser !== 'all' && (
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, fill: 'rgba(255,255,255,0.4)', strokeWidth: 0 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="count"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ fill: '#22d3ee', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#22d3ee', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </GlassCard>
    </div>
  )
}
