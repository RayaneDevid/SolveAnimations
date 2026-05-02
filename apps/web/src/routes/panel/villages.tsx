import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { CalendarDays, ChevronLeft, ChevronRight, PieChart as PieIcon } from 'lucide-react'
import { useVillageStats, useWeeklyEvolution } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VILLAGE_LABELS } from '@/components/shared/VillageBadge'
import type { Village } from '@/lib/schemas/animation'
import type { QuotaCompletion } from '@/types/database'

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

const QUOTA_COLORS = {
  filled: '#22c55e',
  missing: '#f97316',
  absent: '#22d3ee',
}

function totalAnimations(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
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

function QuotaTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { count: number } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div style={CUSTOM_TOOLTIP_STYLE} className="p-3">
      <p className="text-sm text-white/80">
        {item.name}: <strong>{item.value.toFixed(1)}%</strong>
      </p>
      <p className="text-xs text-white/40 mt-0.5">{item.payload.count} personne{item.payload.count > 1 ? 's' : ''}</p>
    </div>
  )
}

function QuotaPieCard({ title, data }: { title: string; data: QuotaCompletion }) {
  const chartData = [
    { name: 'Quota rempli', value: data.filledPercent, count: data.filled, color: QUOTA_COLORS.filled },
    { name: 'Quota non rempli', value: data.missingPercent, count: data.missing, color: QUOTA_COLORS.missing },
    { name: 'Absents justifiés', value: data.absentPercent, count: data.absent, color: QUOTA_COLORS.absent },
  ].filter((entry) => entry.count > 0)

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">{title}</h3>
      {data.total === 0 ? (
        <p className="text-center text-white/30 text-sm py-12">Aucun membre avec quota</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 items-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={76}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} opacity={0.9} />
                ))}
              </Pie>
              <Tooltip content={<QuotaTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-white">{data.filledPercent.toFixed(1)}%</p>
              <p className="text-xs text-white/35 mt-0.5">des personnes ont rempli leur quota</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white/60">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Rempli
                </span>
                <span className="font-medium text-white/80">{data.filled}/{data.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white/60">
                  <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
                  Non rempli
                </span>
                <span className="font-medium text-white/80">{data.missing}/{data.total}</span>
              </div>
              {data.absent > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-white/60">
                    <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" />
                    Absents justifiés
                  </span>
                  <span className="font-medium text-white/80">{data.absent}/{data.total}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

const MJ_ROLES = new Set(['mj', 'mj_senior', 'responsable_mj'])

export default function Villages() {
  const { user } = useRequiredAuth()
  const defaultPole = user.pay_pole === 'mj' || MJ_ROLES.has(user.role) ? 'mj' : 'anim'
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedPole, setSelectedPole] = useState<'anim' | 'mj'>(defaultPole)
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const { data, isLoading } = useVillageStats(bounds.start)
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

  const { currentWeek, lastFourWeeks, quotaCompletion } = data

  // Build pie data
  const pieData = Object.entries(currentWeek.byVillage)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }))

  // Build stacked bar data
  const villages = Object.keys(VILLAGE_CHART_COLORS) as Village[]
  const selectedWeekLabel = isCurrentWeek() ? 'Cette sem.' : format(bounds.start, 'dd/MM', { locale: fr })
  const barData = [...lastFourWeeks, currentWeek].map((w, i) => {
    const label = i === lastFourWeeks.length ? selectedWeekLabel : `S-${lastFourWeeks.length - i}`
    return {
      name: label,
      weekStart: 'weekStart' in w ? w.weekStart : currentWeek.start,
      totalAnimations: totalAnimations(w.counts),
      ...Object.fromEntries(
        villages.map((v) => [v, w.byVillage[v] ?? 0])
      ),
    }
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PieIcon className="h-6 w-6 text-cyan-400" />
            Statistiques
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            Répartition des animations par village
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
          <button
            onClick={goPrev}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            title="Semaine précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            disabled={isCurrentWeek()}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Aujourd'hui
          </button>
          <button
            onClick={goNext}
            disabled={isCurrentWeek()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-default transition-colors"
            title="Semaine suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
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
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...barData].reverse().map((week) => (
              <div
                key={week.name}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
              >
                <span className="text-xs font-medium text-white/50">
                  {week.name === selectedWeekLabel
                    ? (isCurrentWeek() ? 'Cette semaine' : `Semaine du ${week.name}`)
                    : week.name}
                </span>
                <span className="text-xs font-semibold text-white/80">
                  {week.totalAnimations} animation{week.totalAnimations > 1 ? 's' : ''} au total
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Quotas animation de la semaine
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuotaPieCard title="Pôle Animation" data={quotaCompletion.animation} />
          <QuotaPieCard title="Pôle MJ" data={quotaCompletion.mj} />
        </div>
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
