import { useMemo, useState } from 'react'
import { Banknote, RefreshCw, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, CalendarDays, Download } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import { hasOwnedRole } from '@/lib/config/discord'
import type { PaiesEntry } from '@/types/database'

const ANIM_PAY_ROLE_ORDER = ['senior', 'animateur']
const MJ_PAY_ROLE_ORDER   = ['mj_senior', 'mj']
const ANIMATION_TIME_CAP = 17_000
const MJ_HOURLY_RATE = 800
const MJ_MOYENNE_REGISTRATION_BONUS = 200
const MJ_GRANDE_REGISTRATION_BONUS = 300


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

function csvCell(value: string | number | boolean | null | undefined): string {
  const normalized = value == null ? '' : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function buildAnimCommentaire(entry: PaiesEntry): string {
  if (!entry.quotaFilled) return 'Quota non atteint'
  const tiers = [
    { label: `0-4h à 1 000/h`, min: Math.min(entry.totalMin, 4 * 60), rate: 1_000 },
    { label: `4-14h à 800/h`, min: Math.min(Math.max(entry.totalMin - 4 * 60, 0), 10 * 60), rate: 800 },
    { label: `14h+ à 1 250/h`, min: Math.max(entry.totalMin - 14 * 60, 0), rate: 1_250 },
  ].filter((t) => t.min > 0)
  const parts: string[] = []
  if (entry.seniorBase > 0) parts.push(`Base Senior: ${entry.seniorBase}`)
  tiers.forEach((t) => {
    const pay = Math.round(t.min * (t.rate / 60))
    parts.push(`${t.label} (${formatMin(t.min)}): ${pay}`)
  })
  if (entry.remunerationCapped) parts.push(`Plafonné à ${ANIMATION_TIME_CAP}`)
  if (entry.hoursPodiumBonus > 0) parts.push(`Prime podium heures: +${entry.hoursPodiumBonus}`)
  if (entry.createdPodiumBonus > 0) parts.push(`Prime podium creations: +${entry.createdPodiumBonus}`)
  if (entry.participationPodiumBonus > 0) parts.push(`Prime podium participations: +${entry.participationPodiumBonus}`)
  return parts.join(' | ')
}

function buildMjCommentaire(entry: PaiesEntry): string {
  if (!entry.quotaFilled) return 'Quota non atteint'
  const basePay = entry.payRole === 'mj_senior' ? 5_000 : 4_000
  const rawTimePay = Math.round(entry.totalMin * (MJ_HOURLY_RATE / 60))
  const moyenneBonus = entry.moyenne * MJ_MOYENNE_REGISTRATION_BONUS
  const grandeBonus = entry.grande * MJ_GRANDE_REGISTRATION_BONUS
  const parts: string[] = [
    `Base quota: ${basePay}`,
    `Temps (${formatMin(entry.totalMin)} x ${MJ_HOURLY_RATE}/h): ${rawTimePay}`,
    `M (${entry.moyenne} x ${MJ_MOYENNE_REGISTRATION_BONUS}): ${moyenneBonus}`,
    `G (${entry.grande} x ${MJ_GRANDE_REGISTRATION_BONUS}): ${grandeBonus}`,
  ]
  if (entry.hoursPodiumBonus > 0) parts.push(`Prime podium heures: +${entry.hoursPodiumBonus}`)
  if (entry.createdPodiumBonus > 0) parts.push(`Prime podium creations: +${entry.createdPodiumBonus}`)
  if (entry.participationPodiumBonus > 0) parts.push(`Prime podium participations: +${entry.participationPodiumBonus}`)
  return parts.join(' | ')
}

function buildPaiesCsv(entries: PaiesEntry[], pole: 'animation' | 'mj'): string {
  if (pole === 'mj') {
    const header = ['discord_id', 'steam_id', 'grade', 'moyenne', 'grande', 'total_animations', 'total_heures', 'commentaire', 'montant']
    const rows = entries.map((entry) => [
      entry.discordId,
      entry.steamId ?? '',
      entry.payRole,
      entry.moyenne,
      entry.grande,
      entry.animationsCount,
      formatMin(entry.totalMin),
      buildMjCommentaire(entry),
      entry.remuneration,
    ])
    return [
      header.map(csvCell).join(';'),
      ...rows.map((row) => row.map(csvCell).join(';')),
    ].join('\n')
  }

  const header = ['discord_id', 'steam_id', 'grade', 'moyenne', 'grande', 'total_animations', 'total_heures', 'commentaire', 'montant']
  const rows = entries.map((entry) => [
    entry.discordId,
    entry.steamId ?? '',
    entry.payRole,
    entry.moyenne,
    entry.grande,
    entry.animationsCount,
    formatMin(entry.totalMin),
    buildAnimCommentaire(entry),
    entry.remuneration,
  ])
  return [
    header.map(csvCell).join(';'),
    ...rows.map((row) => row.map(csvCell).join(';')),
  ].join('\n')
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function computeAnimationTierDetails(totalMin: number, base = 0) {
  const tiers = [
    { label: '0-4h à 1 000/h', min: Math.min(totalMin, 4 * 60), rate: 1_000 },
    { label: '4-14h à 800/h', min: Math.min(Math.max(totalMin - 4 * 60, 0), 10 * 60), rate: 800 },
    { label: '14h+ à 1 250/h', min: Math.max(totalMin - 14 * 60, 0), rate: 1_250 },
  ].filter((tier) => tier.min > 0)

  const rawPay = Math.round(base + tiers.reduce((sum, tier) => sum + tier.min * (tier.rate / 60), 0))
  return {
    tiers: tiers.map((tier) => ({
      ...tier,
      pay: Math.round(tier.min * (tier.rate / 60)),
    })),
    rawPay,
  }
}

function PayDetailLine({
  label,
  value,
  highlight,
  muted,
}: {
  label: string
  value: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-4',
      muted && 'text-white/45',
      highlight && 'border-t border-white/[0.08] pt-1.5 text-white',
    )}>
      <span>{label}</span>
      <span className={cn('shrink-0 font-medium tabular-nums', highlight ? 'text-emerald-300' : 'text-white/80')}>
        {value}
      </span>
    </div>
  )
}

function AnimationPayDetails({ entry }: { entry: PaiesEntry }) {
  const { tiers, rawPay } = computeAnimationTierDetails(entry.totalMin, entry.seniorBase)

  return (
    <>
      <PayDetailLine
        label="Quota"
        value={`${entry.animationsCount}/${entry.quotaMax ?? 5} anims`}
        muted={!entry.quotaFilled}
      />
      <PayDetailLine label="Temps compté" value={formatMin(entry.totalMin)} muted={entry.totalMin === 0} />
      {entry.quotaFilled ? (
        <>
          {entry.seniorBase > 0 && (
            <PayDetailLine label="Base Senior" value={formatMoney(entry.seniorBase)} />
          )}
          {tiers.map((tier) => (
            <PayDetailLine
              key={tier.label}
              label={tier.label}
              value={`${formatMin(tier.min)} = ${formatMoney(tier.pay)}`}
            />
          ))}
          {entry.remunerationCapped && (
            <>
              <PayDetailLine label="Sous-total temps" value={formatMoney(rawPay)} muted />
              <PayDetailLine label="Plafond temps" value={formatMoney(ANIMATION_TIME_CAP)} />
            </>
          )}
          <PayDetailLine label="Paie temps" value={formatMoney(entry.timePay)} />
          {entry.hoursPodiumBonus > 0 && (
            <PayDetailLine label="Prime podium heures" value={`+${formatMoney(entry.hoursPodiumBonus)}`} />
          )}
          {entry.createdPodiumBonus > 0 && (
            <PayDetailLine label="Prime podium créations" value={`+${formatMoney(entry.createdPodiumBonus)}`} />
          )}
          {entry.participationPodiumBonus > 0 && (
            <PayDetailLine label="Prime podium participations" value={`+${formatMoney(entry.participationPodiumBonus)}`} />
          )}
        </>
      ) : (
        <PayDetailLine label="Paie temps" value={formatMoney(0)} muted />
      )}
      <PayDetailLine label="Total" value={formatMoney(entry.remuneration)} highlight />
    </>
  )
}

function MjPayDetails({ entry }: { entry: PaiesEntry }) {
  const basePay = entry.payRole === 'mj_senior' ? 5_000 : 4_000
  const rawTimePay = Math.round(entry.totalMin * (MJ_HOURLY_RATE / 60))
  const moyenneBonus = entry.moyenne * MJ_MOYENNE_REGISTRATION_BONUS
  const grandeBonus = entry.grande * MJ_GRANDE_REGISTRATION_BONUS
  return (
    <>
      <PayDetailLine
        label="Quota"
        value={entry.quotaMax == null ? 'Aucun' : `${entry.animationsCount}/${entry.quotaMax}`}
        muted={!entry.quotaFilled}
      />
      <PayDetailLine
        label="Base quota"
        value={entry.quotaFilled ? formatMoney(basePay) : formatMoney(0)}
        muted={!entry.quotaFilled}
      />
      <PayDetailLine
        label={`Temps (${formatMin(entry.totalMin)} × ${MJ_HOURLY_RATE}/h)`}
        value={entry.quotaFilled ? formatMoney(rawTimePay) : formatMoney(0)}
        muted={!entry.quotaFilled}
      />
      <PayDetailLine
        label={`Part. + créations moyennes (${entry.moyenne} × ${MJ_MOYENNE_REGISTRATION_BONUS})`}
        value={entry.quotaFilled ? formatMoney(moyenneBonus) : formatMoney(0)}
        muted={!entry.quotaFilled}
      />
      <PayDetailLine
        label={`Part. + créations grandes (${entry.grande} × ${MJ_GRANDE_REGISTRATION_BONUS})`}
        value={entry.quotaFilled ? formatMoney(grandeBonus) : formatMoney(0)}
        muted={!entry.quotaFilled}
      />
      {entry.hoursPodiumBonus > 0 && (
        <PayDetailLine label="Prime podium heures" value={`+${formatMoney(entry.hoursPodiumBonus)}`} />
      )}
      {entry.createdPodiumBonus > 0 && (
        <PayDetailLine label="Prime podium créations" value={`+${formatMoney(entry.createdPodiumBonus)}`} />
      )}
      {entry.participationPodiumBonus > 0 && (
        <PayDetailLine label="Prime podium participations" value={`+${formatMoney(entry.participationPodiumBonus)}`} />
      )}
      <PayDetailLine label="Total" value={formatMoney(entry.remuneration)} highlight />
    </>
  )
}

function PayAmount({ entry }: { entry: PaiesEntry }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span className={cn(
          'cursor-help text-sm font-semibold underline decoration-dotted underline-offset-4 decoration-white/20',
          !entry.quotaFilled ? 'text-red-400' :
          entry.remunerationCapped ? 'text-amber-400' : 'text-emerald-400',
        )}>
          {entry.remuneration === 0 ? '—' : formatMoney(entry.remuneration)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" align="end" className="w-80 space-y-2 p-3">
        <div>
          <p className="text-xs font-semibold text-white/90">Détail paie {entry.payPole === 'mj' ? 'MJ' : 'Animation'}</p>
          <p className="text-[11px] text-white/40">{entry.username}</p>
        </div>
        <div className="space-y-1.5 text-[11px] text-white/60">
          {entry.payPole === 'animation' ? <AnimationPayDetails entry={entry} /> : <MjPayDetails entry={entry} />}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Table row ──────────────────────────────────────────────────────────────

function EntryRow({ entry, rank }: { entry: PaiesEntry; rank: number }) {
  const hasActivity = entry.animationsCount > 0
  const isAnimationPay = entry.payPole === 'animation'
  const capTitle = isAnimationPay ? 'Temps plafonné à 17 000 crédits' : 'Plafonné à 15 000 crédits'
  const podiumLabels = [
    entry.hoursPodiumBonus > 0 ? 'Heures' : null,
    entry.createdPodiumBonus > 0 ? 'Créations' : null,
    entry.participationPodiumBonus > 0 ? 'Participations' : null,
  ].filter(Boolean).join(' · ')

  return (
    <tr className={cn(
      'border-b border-white/[0.04] transition-colors',
      entry.quotaFilled
        ? 'hover:bg-white/[0.02]'
        : 'bg-red-500/[0.04] hover:bg-red-500/[0.07]',
      !hasActivity && !entry.quotaFilled && 'opacity-70',
    )}>
      <td className="py-3 pl-4 pr-2 text-xs text-white/30 w-8 tabular-nums">{rank}</td>

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

      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm text-white/80">{entry.animationsCount}</span>
      </td>

      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm text-white/70">{entry.createdAnimationsCount}</span>
      </td>

      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm text-white/70">{entry.participationsCount}</span>
      </td>

      <td className="py-3 pr-4 text-center tabular-nums">
        {entry.trameReportsCount != null && entry.trameReportsCount > 0 ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-violet-500/10 text-violet-400">
            {entry.trameReportsCount}
          </span>
        ) : (
          <span className="text-xs text-white/20">—</span>
        )}
      </td>

      <td className="py-3 pr-4 text-center tabular-nums">
        <div className="flex items-center justify-center gap-1.5">
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
          {entry.moyenne === 0 && entry.grande === 0 && <span className="text-xs text-white/20">—</span>}
        </div>
      </td>

      <td className="py-3 pr-4 text-center tabular-nums text-sm text-white/70">
        {formatMin(entry.animationMin)}
      </td>

      <td className="py-3 pr-4 text-center tabular-nums text-sm text-white/70">
        {formatMin(entry.prepMin)}
      </td>

      <td className="py-3 pr-4 text-center tabular-nums">
        <span className="text-sm font-medium text-white/90">{formatMin(entry.totalMin)}</span>
      </td>

      <td className="py-3 pr-4 text-center tabular-nums">
        {entry.podiumBonus > 0 ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-medium text-cyan-300">+{formatMoney(entry.podiumBonus)}</span>
            {podiumLabels && <span className="text-[10px] text-cyan-300/45">{podiumLabels}</span>}
          </div>
        ) : (
          <span className="text-xs text-white/20">—</span>
        )}
      </td>

      <td className="py-3 pr-4 text-right tabular-nums">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {entry.remunerationCapped && (
              <span title={capTitle} className="text-amber-400">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
            <PayAmount entry={entry} />
          </div>
          {!entry.quotaFilled && entry.quotaMax !== null && (
            <span className="text-[10px] text-red-400/60">
              quota {entry.animationsCount}/{entry.quotaMax}
            </span>
          )}
          {isAnimationPay && entry.quotaFilled && entry.timePay > 0 && (
            <span className="text-[10px] text-emerald-400/40">
              temps {formatMoney(entry.timePay)}
            </span>
          )}
          {!isAnimationPay && entry.quotaFilled && entry.quotaMax !== null && entry.animationsCount > 0 && (
            <span className="text-[10px] text-emerald-400/40">
              base + temps + inscriptions
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
  const { permissionRoles } = useRequiredAuth()
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const { data, isLoading, error, refetch, isFetching } = usePaies(bounds.start)

  const canSeeAll = hasOwnedRole(permissionRoles, ['direction', 'gerance'])
    || (hasOwnedRole(permissionRoles, ['responsable']) && hasOwnedRole(permissionRoles, ['responsable_mj']))
  const showAnim = canSeeAll || hasOwnedRole(permissionRoles, ['responsable'])
  const showMj   = canSeeAll || hasOwnedRole(permissionRoles, ['responsable_mj'])

  const [activeTab, setActiveTab] = useState<'animation' | 'mj'>(showAnim ? 'animation' : 'mj')

  const poleAnim = useMemo(() =>
    sortEntries((data?.entries ?? []).filter((e) => e.payPole === 'animation'), ANIM_PAY_ROLE_ORDER)
  , [data])

  const poleMj = useMemo(() =>
    sortEntries((data?.entries ?? []).filter((e) => e.payPole === 'mj'), MJ_PAY_ROLE_ORDER)
  , [data])

  const activeEntries = activeTab === 'animation' ? poleAnim : poleMj

  const totals = useMemo(() => {
    if (!data) return null
    const entries = activeEntries
    return {
      totalRemuneration: entries.reduce((s, e) => s + e.remuneration, 0),
      totalAnimations: data.uniqueAnimationsCount,
      totalMin: data.uniqueAnimationsTotalMin,
      activeCount: entries.filter((e) => e.animationsCount > 0).length,
    }
  }, [data])

  const weekLabel = `${format(bounds.start, 'dd/MM', { locale: fr })} – ${format(bounds.end, 'dd/MM', { locale: fr })}`
  const weekFileLabel = `${format(bounds.start, 'yyyy-MM-dd')}_${format(bounds.end, 'yyyy-MM-dd')}`

  const handleExportCsv = (entries: PaiesEntry[], pole: 'animation' | 'mj') => {
    const csv = buildPaiesCsv(entries, pole)
    downloadCsv(`paies-${pole}-${weekFileLabel}.csv`, csv)
  }

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
        {activeTab === 'animation' ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Quota 5 anims, heures = animation + prépa
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              0-4h × 1 000/h · 4-14h × 800/h · 14h+ × 1 250/h
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Primes : +1 000 crédits par podium top 3
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-amber-400" />
              Plafond temps : 17 000 hors primes
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Quota 3 anims · base 4 000/5 000 + 800/h · +200 M / +300 G
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Primes : +1 000 crédits par podium top 3
            </div>
          </>
        )}
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'animation' | 'mj')}>
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
            const poleLabel = key === 'mj' ? 'MJ' : 'Animation'
            return (
              <TabsContent key={key} value={key}>
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleExportCsv(entries, key as 'animation' | 'mj')}
                    disabled={entries.length === 0}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exporter CSV {poleLabel}
                  </button>
                </div>
                <GlassCard className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="py-3 pl-4 pr-2 text-xs font-medium text-white/30 w-8">#</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30">Membre</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Total</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Créées</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Part.</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Trames</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Inscr. M/G</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Tps anim</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Tps prépa</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Temps</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-center">Primes</th>
                          <th className="py-3 pr-4 text-xs font-medium text-white/30 text-right">Rémunération</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="px-4 py-12 text-center text-sm text-white/20">
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
                            <td colSpan={9} />
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
