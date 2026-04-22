import { useMemo } from 'react'
import { Banknote, RefreshCw, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usePaies } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { GlassCard } from '@/components/shared/GlassCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import type { PaiesEntry } from '@/types/database'

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
      'border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]',
      !hasActivity && 'opacity-50',
    )}>
      {/* Rank */}
      <td className="py-3 pl-4 pr-2 text-xs text-white/30 w-8 tabular-nums">{rank}</td>

      {/* User */}
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <UserAvatar avatarUrl={entry.avatarUrl} username={entry.username} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">{entry.username}</p>
            <RoleBadge role={entry.role as import('@/lib/config/discord').StaffRoleKey} className="mt-0.5" />
          </div>
        </div>
      </td>

      {/* Nb animations */}
      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm text-white/80">{entry.animationsCount}</span>
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
        <div className="flex items-center justify-end gap-1.5">
          {entry.remunerationCapped && (
            <span title="Plafonné à 10 000 crédits" className="text-amber-400">
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
          <span className={cn(
            'text-sm font-semibold',
            entry.remuneration === 0 ? 'text-white/30' :
            entry.remunerationCapped ? 'text-amber-400' : 'text-emerald-400',
          )}>
            {entry.remuneration === 0 ? '—' : formatMoney(entry.remuneration)}
          </span>
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
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const { data, isLoading, error, refetch, isFetching } = usePaies(bounds.start)

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data.entries].sort((a, b) => b.remuneration - a.remuneration || a.username.localeCompare(b.username))
  }, [data])

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
      <div className="flex items-center gap-4 text-xs text-white/30">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/20" />
          Petite × 250 crédits
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
          <TrendingUp className="h-3 w-3 text-amber-400" />
          Plafonné à 10 000 crédits
        </div>
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        {error ? (
          <div className="flex items-center gap-2 p-6 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Impossible de charger les données.
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-3 pl-4 pr-2 text-xs font-medium text-white/30 w-8">#</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30">Membre</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Animations</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">P / M / G</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Tps anim</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Tps prépa</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Total</th>
                  <th className="py-3 pr-4 text-xs font-medium text-white/30 text-right">Rémunération</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <EntryRow key={entry.id} entry={entry} rank={i + 1} />
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-white/30">
                      Aucune animation terminée cette semaine.
                    </td>
                  </tr>
                )}
              </tbody>
              {sorted.length > 0 && totals && (
                <tfoot>
                  <tr className="border-t border-white/[0.08] bg-white/[0.01]">
                    <td />
                    <td className="py-3 pr-4 text-xs font-medium text-white/50">Total</td>
                    <td className="py-3 pr-4 text-center text-xs font-medium text-white/50">{totals.totalAnimations} uniques</td>
                    <td />
                    <td className="py-3 pr-4 text-center text-xs font-medium text-white/50">
                      {formatMin(data?.uniqueAnimationsTotalMin ?? 0)}
                    </td>
                    <td />
                    <td className="py-3 pr-4 text-center text-xs font-medium text-white/50">
                      {formatMin(totals.totalMin)}
                    </td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-emerald-400">
                      {formatMoney(totals.totalRemuneration)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
