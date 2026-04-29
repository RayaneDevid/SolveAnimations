import { useMemo } from 'react'
import { Banknote, RefreshCw, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usePaies } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils/cn'
import type { PaiesEntry } from '@/types/database'

const ANIM_PAY_ROLE_ORDER = ['senior', 'animateur']
const MJ_PAY_ROLE_ORDER   = ['mj_senior', 'mj']

function sortEntries(entries: PaiesEntry[], roleOrder: string[]): PaiesEntry[] {
  return [...entries].sort((a, b) => {
    const ia = roleOrder.indexOf(a.payRole)
    const ib = roleOrder.indexOf(b.payRole)
    if (ia !== ib) return ia - ib
    if (a.quotaFilled !== b.quotaFilled) return a.quotaFilled ? -1 : 1
    return b.remuneration - a.remuneration || a.username.localeCompare(b.username)
  })
}

function formatMin(min: number): string {
  if (min === 0) return '0 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} crédits`
}

// ─── Table row ──────────────────────────────────────────────────────────────

function EntryRow({ entry, rank }: { entry: PaiesEntry; rank: number }) {
  const hasActivity = entry.animationsCount > 0

  return (
    <tr className={cn(
      'border-b border-white/[0.04] transition-colors',
      entry.quotaFilled
        ? 'hover:bg-white/[0.02]'
        : 'bg-red-500/[0.04] hover:bg-red-500/[0.07]',
      !hasActivity && !entry.quotaFilled && 'opacity-70',
    )}>
      {/* Rank */}
      <td className="py-3 pl-4 pr-2 text-xs text-white/30 w-8 tabular-nums">{rank}</td>

      {/* User */}
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <UserAvatar avatarUrl={entry.avatarUrl} username={entry.username} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">{entry.username}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <RoleBadge role={entry.role} />
              <span className={cn(
                'whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                entry.payPole === 'mj'
                  ? 'border-red-500/20 bg-red-500/10 text-red-300'
                  : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
              )}>
                Paie {entry.payPole === 'mj' ? 'MJ' : 'Anim'}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Nb animations */}
      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm text-white/80">{entry.animationsCount}</span>
      </td>

      {/* Nb rapports trames */}
      <td className="py-3 pr-4 text-center tabular-nums">
        {entry.trameReportsCount != null && entry.trameReportsCount > 0 ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-violet-500/10 text-violet-400">
            {entry.trameReportsCount}
          </span>
        ) : (
          <span className="text-xs text-white/20">—</span>
        )}
      </td>

      {/* Petite / Moyenne / Grande */}
      <td className="py-3 pr-4 text-center tabular-nums">
        <div className="flex items-center justify-center gap-1.5">
          {entry.petite > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-white/[0.06] text-white/60">
              <span className="text-white/40">P</span>{entry.petite}
            </span>
          )}
          {entry.moyenne > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-cyan-400/10 text-cyan-400">
              <span className="text-cyan-400/60">M</span>{entry.moyenne}
            </span>
          )}
          {entry.grande > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-400/10 text-amber-400">
              <span className="text-amber-400/60">G</span>{entry.grande}
            </span>
          )}
          {entry.animationsCount === 0 && <span className="text-xs text-white/20">—</span>}
        </div>
      </td>

      {/* Temps anim */}
      <td className="py-3 pr-4 text-center tabular-nums text-sm text-white/70">
        {formatMin(entry.animationMin)}
      </td>

      {/* Temps prépa */}
      <td className="py-3 pr-4 text-center tabular-nums text-sm text-white/70">
        {formatMin(entry.prepMin)}
      </td>

      {/* Temps total */}
      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm font-medium text-white/90">{formatMin(entry.totalMin)}</span>
      </td>

      {/* Rémunération */}
      <td className="py-3 pr-4 text-right tabular-nums">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {entry.remunerationCapped && (
              <span title="Plafonné à 10 000 crédits" className="text-amber-400">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
            <span className={cn(
              'text-sm font-semibold',
              !entry.quotaFilled ? 'text-red-400' :
              entry.remunerationCapped ? 'text-amber-400' : 'text-emerald-400',
            )}>
              {entry.remuneration === 0 ? '—' : formatMoney(entry.remuneration)}
            </span>
          </div>
          {!entry.quotaFilled && entry.quotaMax !== null && (
            <span className="text-[10px] text-red-400/60">
              quota {entry.animationsCount}/{entry.quotaMax}
            </span>
          )}
          {entry.quotaFilled && entry.quotaMax !== null && entry.animationsCount > 0 && (
            <span className="text-[10px] text-emerald-400/40">
              +{(['mj', 'mj_senior'].includes(entry.payRole)
                ? (entry.payRole === 'mj_senior' ? '5 000' : '4 000')
                : '1 000')} base
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </GlassCard>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Paies() {
  const { role } = useRequiredAuth()
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const { data, isLoading, error, refetch, isFetching } = usePaies(bounds.start)

  const showAnim = role !== 'responsable_mj'
  const showMj   = role !== 'responsable'

  const poleAnim = useMemo(() =>
    sortEntries((data?.entries ?? []).filter((e) => e.payPole === 'animation'), ANIM_PAY_ROLE_ORDER)
  , [data])

  const poleMj = useMemo(() =>
    sortEntries((data?.entries ?? []).filter((e) => e.payPole === 'mj'), MJ_PAY_ROLE_ORDER)
  , [data])

  const totals = useMemo(() => {
    if (!data) return null
    const entries = data.entries
    return {
      totalRemuneration: entries.reduce((s, e) => s + e.remuneration, 0),
      totalAnimations: data.uniqueAnimationsCount,
      totalMin: data.uniqueAnimationsTotalMin,
      activeCount: entries.filter((e) => e.animationsCount > 0).length,
    }
  }, [data])

  const weekLabel = `${format(bounds.start, 'dd/MM', { locale: fr })} – ${format(bounds.end, 'dd/MM', { locale: fr })}`

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Banknote className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Paies</h1>
            <p className="text-xs text-white/40 mt-0.5">Semaine du {weekLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Week navigator */}
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

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : totals ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total rémunérations"
            value={formatMoney(totals.totalRemuneration)}
            sub="cette semaine"
          />
          <SummaryCard
            label="Membres actifs"
            value={`${totals.activeCount} / ${data?.entries.length ?? 0}`}
            sub="avec au moins 1 animation"
          />
          <SummaryCard
            label="Animations terminées"
            value={String(totals.totalAnimations)}
            sub="cette semaine"
          />
          <SummaryCard
            label="Temps total"
            value={formatMin(totals.totalMin)}
            sub="anim + prépa"
          />
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-white/30 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Base quota atteint : Anim 1 000 · MJ 4 000 · MJS 5 000 crédits
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/20" />
          Petite × 200 crédits
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Moyenne × 350 crédits
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Grande × 500 crédits
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          Quota non atteint
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-amber-400" />
          Plafonné à 10 000 crédits
        </div>
      </div>

      {/* Tables */}
      {error ? (
        <GlassCard className="flex items-center gap-2 p-6 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Impossible de charger les données.
        </GlassCard>
      ) : isLoading ? (
        <GlassCard className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </GlassCard>
      ) : (
        <Tabs defaultValue={showAnim ? 'animation' : 'mj'}>
          {showAnim && showMj && (
            <TabsList>
              <TabsTrigger value="animation">Pôle Animation ({poleAnim.length})</TabsTrigger>
              <TabsTrigger value="mj">Pôle MJ ({poleMj.length})</TabsTrigger>
            </TabsList>
          )}
          {[
            ...(showAnim ? [{ key: 'animation', entries: poleAnim }] : []),
            ...(showMj   ? [{ key: 'mj',        entries: poleMj   }] : []),
          ].map(({ key, entries }) => {
            const poleTotal = entries.reduce((s, e) => s + e.remuneration, 0)
            return (
              <TabsContent key={key} value={key}>
                <GlassCard className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="py-3 pl-4 pr-2 text-xs font-medium text-white/30 w-8">#</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30">Membre</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Animations</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Trames</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">P / M / G</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Tps anim</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Tps prépa</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Total</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-right">Rémunération</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-sm text-white/20">
                              Aucune activité cette semaine
                            </td>
                          </tr>
                        ) : (
                          entries.map((entry, i) => (
                            <EntryRow key={entry.id} entry={entry} rank={i + 1} />
                          ))
                        )}
                      </tbody>
                      {entries.length > 0 && (
                        <tfoot>
                          <tr className="border-t border-white/[0.08] bg-white/[0.01]">
                            <td />
                            <td className="py-3 pr-4 text-xs font-medium text-white/50">Total</td>
                            <td colSpan={6} />
                            <td className="py-3 pr-4 text-right text-sm font-bold text-emerald-400">
                              {formatMoney(poleTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </GlassCard>
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
