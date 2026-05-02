import { useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toPng } from 'html-to-image'
import { AlertTriangle, CalendarDays, CalendarOff, ChevronLeft, ChevronRight, ClipboardList, Download, FileDown, LogOut, ShieldAlert, Target, UserX, type LucideIcon } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useWeeklyReview, useVillageStats, type WeeklyReviewAbsence, type WeeklyReviewDeparture, type WeeklyReviewMember, type WeeklyReviewWarning } from '@/hooks/queries/useAnimations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { GlassCard } from '@/components/shared/GlassCard'
import { cn } from '@/lib/utils/cn'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { QuotaCompletion } from '@/types/database'

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function formatShortDate(value: string): string {
  return format(dateFromInput(value), 'dd/MM/yyyy', { locale: fr })
}

function formatWeekRange(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)} - ${format(addDays(dateFromInput(endDate), -1), 'dd/MM/yyyy', { locale: fr })}`
}

const MJ_ROLES = ['mj', 'mj_senior', 'responsable_mj']
const QUOTA_COLORS = {
  filled: '#22c55e',
  missing: '#f97316',
} as const

type MemberBadgeVariant = 'default' | 'quotaMissing'

function isMjRole(role: string): boolean {
  return MJ_ROLES.includes(role)
}

function isEffectivelyMj(m: WeeklyReviewMember): boolean {
  if (m.pay_pole === 'mj') return true
  if (m.pay_pole === 'animation') return false
  return ['mj', 'mj_senior'].includes(m.role)
}

function isAbsenceEffectivelyMj(absence: WeeklyReviewAbsence): boolean {
  const user = absence.user
  if (!user) return false
  if (user.pay_pole === 'mj') return true
  if (user.pay_pole === 'animation') return false
  return isMjRole(user.role)
}

function EmptyState() {
  return <p className="py-3 text-sm text-white/25">Rien à signaler</p>
}

function memberTitle(member: WeeklyReviewMember): string {
  return [
    member.username,
    member.discord_username ? `Discord: @${member.discord_username}` : 'Discord inconnu',
    member.steam_id ? `SteamID: ${member.steam_id}` : null,
    `Quota: ${member.quota}/${member.quotaMax}`,
    `Manquant: ${member.missing}`,
  ].filter(Boolean).join('\n')
}

function MemberBadge({ member, variant = 'default' }: { member: WeeklyReviewMember; variant?: MemberBadgeVariant }) {
  const variantClasses = {
    default: {
      badge: 'border-white/[0.08] bg-white/[0.035] text-white/75 hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]',
      meta: 'text-white/35',
    },
    quotaMissing: {
      badge: 'border-orange-500/25 bg-orange-500/[0.08] text-orange-100/90 hover:border-orange-400/40 hover:bg-orange-500/[0.12]',
      meta: 'text-orange-200/55',
    },
  }

  return (
    <Link
      to={`/panel/casiers?user_id=${member.id}`}
      title={memberTitle(member)}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
        variantClasses[variant].badge,
      )}
    >
      <UserAvatar avatarUrl={member.avatar_url} username={member.username} size="xs" />
      <span className="max-w-[150px] truncate whitespace-nowrap font-medium">{member.username}</span>
      <span className={cn('shrink-0', variantClasses[variant].meta)}>{member.quota}/{member.quotaMax}</span>
    </Link>
  )
}

function MemberList({ members, variant = 'default' }: { members: WeeklyReviewMember[]; variant?: MemberBadgeVariant }) {
  if (members.length === 0) return <EmptyState />
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => <MemberBadge key={member.id} member={member} variant={variant} />)}
    </div>
  )
}

function WarningBadge({ warning }: { warning: WeeklyReviewWarning }) {
  const user = warning.user
  const title = [
    user?.username ?? 'Membre inconnu',
    `Date: ${formatShortDate(warning.warning_date)}`,
    `Raison: ${warning.reason}`,
    warning.creator ? `Ajouté par: ${warning.creator.username}` : null,
  ].filter(Boolean).join('\n')

  return (
    <Link
      to={user ? `/panel/casiers?user_id=${user.id}` : '#'}
      title={title}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2 py-1 text-xs text-amber-100/85 transition-colors hover:border-amber-300/35 hover:bg-amber-500/10"
    >
      <UserAvatar avatarUrl={user?.avatar_url ?? null} username={user?.username ?? 'Membre'} size="xs" />
      <span className="max-w-[150px] truncate whitespace-nowrap font-medium">{user?.username ?? 'Membre inconnu'}</span>
      <span className="shrink-0 text-amber-200/45">{formatShortDate(warning.warning_date)}</span>
    </Link>
  )
}

function WarningList({ warnings }: { warnings: WeeklyReviewWarning[] }) {
  if (warnings.length === 0) return <EmptyState />
  return (
    <div className="flex flex-wrap gap-2">
      {warnings.map((warning) => <WarningBadge key={warning.id} warning={warning} />)}
    </div>
  )
}

function AbsenceBadge({ absence }: { absence: WeeklyReviewAbsence }) {
  const user = absence.user
  const title = [
    user?.username ?? 'Membre inconnu',
    user?.discord_username ? `Discord: @${user.discord_username}` : 'Discord inconnu',
    user?.steam_id ? `SteamID: ${user.steam_id}` : null,
    `Du ${formatShortDate(absence.from_date)} au ${formatShortDate(absence.to_date)}`,
    absence.declarer ? `Déclarée par: ${absence.declarer.username}` : null,
  ].filter(Boolean).join('\n')

  return (
    <Link
      to={user ? `/panel/casiers?user_id=${user.id}` : '#'}
      title={title}
      className="inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] px-2.5 py-1.5 text-xs text-cyan-100/85 transition-colors hover:border-cyan-300/35 hover:bg-cyan-500/10"
    >
      <span className="flex items-center gap-1.5">
        <UserAvatar avatarUrl={user?.avatar_url ?? null} username={user?.username ?? 'Membre'} size="xs" />
        <span className="max-w-[150px] truncate whitespace-nowrap font-medium">{user?.username ?? 'Membre inconnu'}</span>
        <span className="ml-auto shrink-0 text-cyan-200/45">
          {formatShortDate(absence.from_date)}
        </span>
      </span>
      <p className="pl-5 text-[10px] leading-snug text-cyan-200/50 line-clamp-2">
        {formatShortDate(absence.from_date)} → {formatShortDate(absence.to_date)}
      </p>
    </Link>
  )
}

function AbsenceList({ absences }: { absences: WeeklyReviewAbsence[] }) {
  if (absences.length === 0) return <EmptyState />
  return (
    <div className="flex flex-wrap gap-2">
      {absences.map((absence) => <AbsenceBadge key={absence.id} absence={absence} />)}
    </div>
  )
}

function DepartureBadge({ departure }: { departure: WeeklyReviewDeparture }) {
  const title = [
    departure.username,
    departure.discord_username ? `Discord: @${departure.discord_username}` : 'Discord inconnu',
    departure.steam_id ? `SteamID: ${departure.steam_id}` : null,
    departure.deactivated_by_username ? `Retiré par: ${departure.deactivated_by_username}` : null,
  ].filter(Boolean).join('\n')

  return (
    <span
      title={title}
      className="inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-2.5 py-1.5 text-xs text-red-100/85"
    >
      <span className="flex items-center gap-1.5">
        <UserAvatar avatarUrl={departure.avatar_url} username={departure.username} size="xs" />
        <span className="max-w-[150px] truncate whitespace-nowrap font-medium">{departure.username}</span>
        {departure.deactivated_at && (
          <span className="ml-auto shrink-0 text-red-200/45">
            {format(new Date(departure.deactivated_at), 'dd/MM', { locale: fr })}
          </span>
        )}
      </span>
      <p className="pl-5 text-[10px] leading-snug text-red-200/50 line-clamp-2">
        {departure.deactivation_reason ?? 'Aucune raison renseignée'}
      </p>
    </span>
  )
}

function DepartureList({ departures }: { departures: WeeklyReviewDeparture[] }) {
  if (departures.length === 0) return <EmptyState />
  return (
    <div className="flex flex-wrap gap-2">
      {departures.map((departure) => <DepartureBadge key={departure.id} departure={departure} />)}
    </div>
  )
}

function ReviewCard({
  title,
  subtitle,
  icon: Icon,
  count,
  tone,
  className,
  children,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  count: number
  tone: 'amber' | 'red' | 'cyan' | 'orange'
  className?: string
  children: React.ReactNode
}) {
  const toneClasses = {
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/20 bg-red-500/10 text-red-300',
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    orange: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
  }

  return (
    <GlassCard className={cn('p-3', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/35">{subtitle}</p>
          </div>
        </div>
        <span className={cn(
          'shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold',
          tone === 'orange'
            ? 'border-orange-500/25 bg-orange-500/[0.08] text-orange-200/75'
            : 'border-white/[0.08] bg-white/[0.04] text-white/60',
        )}>
          {count}
        </span>
      </div>
      {children}
    </GlassCard>
  )
}

const QUOTA_TOOLTIP_STYLE = {
  backgroundColor: '#13141A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '12px',
}

function QuotaTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { count: number } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div style={QUOTA_TOOLTIP_STYLE} className="p-3">
      <p className="text-sm text-white/80">{item.name}: <strong>{item.value.toFixed(1)}%</strong></p>
      <p className="mt-0.5 text-xs text-white/40">{item.payload.count} personne{item.payload.count > 1 ? 's' : ''}</p>
    </div>
  )
}

function QuotaPieSummary({ data }: { data?: QuotaCompletion }) {
  if (!data) return null

  const chartData = [
    { name: 'Quota rempli', value: data.filledPercent, count: data.filled, color: QUOTA_COLORS.filled },
    { name: 'Quota non rempli', value: data.missingPercent, count: data.missing, color: QUOTA_COLORS.missing },
  ].filter((entry) => entry.count > 0)

  if (data.total === 0) {
    return <p className="mb-3 border-b border-white/[0.06] pb-3 text-sm text-white/25">Aucun membre avec quota</p>
  }

  return (
    <div className="mb-3 grid grid-cols-[112px_1fr] items-center gap-3 border-b border-white/[0.06] pb-3">
      <ResponsiveContainer width="100%" height={112}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={3} dataKey="value">
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} opacity={0.9} />
            ))}
          </Pie>
          <Tooltip content={<QuotaTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        <div>
          <p className="text-2xl font-bold text-white">{data.missingPercent.toFixed(1)}%</p>
          <p className="text-[11px] text-orange-200/55">n'ont pas rempli leur quota</p>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-white/55"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Rempli</span>
            <span className="font-medium text-white/75">{data.filled}/{data.total}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-orange-100/70"><span className="h-2 w-2 rounded-sm bg-orange-500" />Non rempli</span>
            <span className="font-medium text-orange-100/80">{data.missing}/{data.total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PoleCards({
  warnings,
  justifiedAbsences,
  departures,
  unjustifiedThisWeek,
  unjustifiedTwoWeeks,
  quotaMissingThisWeek,
  quotaMissingTwoWeeks,
  hasTwoWeekHistory,
  quotaCompletion,
}: {
  warnings: WeeklyReviewWarning[]
  justifiedAbsences: WeeklyReviewAbsence[]
  departures: WeeklyReviewDeparture[]
  unjustifiedThisWeek: WeeklyReviewMember[]
  unjustifiedTwoWeeks: WeeklyReviewMember[]
  quotaMissingThisWeek: WeeklyReviewMember[]
  quotaMissingTwoWeeks: WeeklyReviewMember[]
  hasTwoWeekHistory: boolean
  quotaCompletion: QuotaCompletion | undefined
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReviewCard
          title="Avertissements"
          subtitle="Warns ajoutés sur la semaine active"
          icon={ShieldAlert}
          count={warnings.length}
          tone="amber"
        >
          <WarningList warnings={warnings} />
        </ReviewCard>

        <ReviewCard
          title="Départs"
          subtitle="Membres retirés du panel cette semaine"
          icon={LogOut}
          count={departures.length}
          tone="red"
        >
          <DepartureList departures={departures} />
        </ReviewCard>

        <ReviewCard
          title="Absences justifiées"
          subtitle="Absences déclarées sur la semaine active"
          icon={CalendarOff}
          count={justifiedAbsences.length}
          tone="cyan"
        >
          <AbsenceList absences={justifiedAbsences} />
        </ReviewCard>

        <ReviewCard
          title="Absence injustifiée"
          subtitle="Quota à 0 et aucune absence déclarée"
          icon={UserX}
          count={unjustifiedThisWeek.length}
          tone="red"
        >
          <MemberList members={unjustifiedThisWeek} />
        </ReviewCard>

        {hasTwoWeekHistory && (
          <ReviewCard
            title="Absence injustifiée x2"
            subtitle="Quota à 0 sans absence sur 2 semaines"
            icon={UserX}
            count={unjustifiedTwoWeeks.length}
            tone="red"
          >
            <MemberList members={unjustifiedTwoWeeks} />
          </ReviewCard>
        )}

        <ReviewCard
          title="Quota non rempli"
          subtitle="Membres sous quota sur la semaine active"
          icon={Target}
          count={quotaMissingThisWeek.length}
          tone="orange"
          className={!hasTwoWeekHistory ? 'col-span-full' : quotaCompletion ? 'sm:col-span-2' : undefined}
        >
          <QuotaPieSummary data={quotaCompletion} />
          <MemberList members={quotaMissingThisWeek} variant="quotaMissing" />
        </ReviewCard>

        {hasTwoWeekHistory && (
          <ReviewCard
            title="Quota non rempli x2"
            subtitle="Membres sous quota sur 2 semaines"
            icon={AlertTriangle}
            count={quotaMissingTwoWeeks.length}
            tone="orange"
          >
            <MemberList members={quotaMissingTwoWeeks} variant="quotaMissing" />
          </ReviewCard>
        )}
      </div>
    </div>
  )
}

export default function Bilan() {
  const { user } = useRequiredAuth()
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const { data, isLoading } = useWeeklyReview(bounds.start)
  const { data: villageStats } = useVillageStats(bounds.start)
  const animExportRef = useRef<HTMLDivElement>(null)
  const mjExportRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'animation' | 'mj'>(() => user.pay_pole === 'mj' ? 'mj' : 'animation')
  const [exporting, setExporting] = useState(false)

  const exportFileName = data
    ? `bilan-${data.week.startDate}-${format(addDays(dateFromInput(data.week.endDate), -1), 'yyyy-MM-dd')}`
    : 'bilan'

  const handleExportImage = async () => {
    const ref = activeTab === 'animation' ? animExportRef : mjExportRef
    if (!ref.current || !data) return

    setExporting(true)
    const restorations: Array<() => void> = []
    try {
      const el = ref.current

      // Pre-convert cross-origin Discord CDN images to blob URLs to bypass CORS
      const imgEls = Array.from(el.querySelectorAll<HTMLImageElement>('img'))
      await Promise.allSettled(
        imgEls.map(async (img) => {
          if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) return
          try {
            const res = await fetch(img.src)
            const blobUrl = URL.createObjectURL(await res.blob())
            const orig = img.src
            img.src = blobUrl
            restorations.push(() => { URL.revokeObjectURL(blobUrl); img.src = orig })
          } catch {
            img.style.visibility = 'hidden'
            restorations.push(() => { img.style.visibility = '' })
          }
        }),
      )

      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#0A0B0F',
        width: el.offsetWidth,
        height: el.scrollHeight,
      })

      restorations.forEach((r) => r())

      const a = document.createElement('a')
      a.download = `${exportFileName}-${activeTab}.png`
      a.href = dataUrl
      a.click()
      toast.success('Image exportée')
    } catch (err) {
      restorations.forEach((r) => r())
      toast.error(err instanceof Error ? err.message : "Impossible d'exporter l'image")
    } finally {
      setExporting(false)
    }
  }

  const handleExportPdf = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(8)].map((_, index) => <Skeleton key={index} className="h-48" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <GlassCard className="p-8 text-center text-sm text-white/40">Impossible de charger le bilan.</GlassCard>
      </div>
    )
  }

  const animWarnings = data.warnings.filter((w) => !isMjRole(w.user?.role ?? ''))
  const mjWarnings = data.warnings.filter((w) => isMjRole(w.user?.role ?? ''))
  const animDepartures = data.departures.filter((d) => !isMjRole(d.role))
  const mjDepartures = data.departures.filter((d) => isMjRole(d.role))
  const justifiedAbsencesThisWeek = data.justifiedAbsencesThisWeek ?? []
  const animJustifiedAbsences = justifiedAbsencesThisWeek.filter((absence) => !isAbsenceEffectivelyMj(absence))
  const mjJustifiedAbsences = justifiedAbsencesThisWeek.filter(isAbsenceEffectivelyMj)

  const animUnjustifiedThisWeek = data.unjustifiedThisWeek.filter((m) => !isEffectivelyMj(m))
  const mjUnjustifiedThisWeek = data.unjustifiedThisWeek.filter(isEffectivelyMj)
  const animUnjustifiedTwoWeeks = data.unjustifiedTwoWeeks.filter((m) => !isEffectivelyMj(m))
  const mjUnjustifiedTwoWeeks = data.unjustifiedTwoWeeks.filter(isEffectivelyMj)
  const animQuotaMissingThisWeek = data.quotaMissingThisWeek.filter((m) => !isEffectivelyMj(m))
  const mjQuotaMissingThisWeek = data.quotaMissingThisWeek.filter(isEffectivelyMj)
  const animQuotaMissingTwoWeeks = data.quotaMissingTwoWeeks.filter((m) => !isEffectivelyMj(m))
  const mjQuotaMissingTwoWeeks = data.quotaMissingTwoWeeks.filter(isEffectivelyMj)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body, html { background: #0A0B0F !important; height: auto !important; overflow: visible !important; }
          aside, nav, header, [data-export-ignore="true"] { display: none !important; }
          div[class*="h-screen"], div[class*="overflow-hidden"], div[class*="overflow-y-auto"] {
            height: auto !important;
            overflow: visible !important;
          }
          main { overflow: visible !important; height: auto !important; }
          #weekly-review-export {
            max-width: none !important;
            padding: 16px !important;
            margin: 0 !important;
          }
          #weekly-review-export .grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          #weekly-review-export [class*="GlassCard"] {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
          }
        }
      `}</style>

      <div id="weekly-review-export" className="space-y-8 bg-[#0A0B0F]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <ClipboardList className="h-6 w-6 text-cyan-400" />
              Bilan hebdomadaire
            </h1>
            <p className="mt-0.5 text-sm text-white/40">
              Semaine active : {formatWeekRange(data.week.startDate, data.week.endDate)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div data-export-ignore="true" className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
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
            <p className="text-xs text-white/30">
              {data.hasTwoWeekHistory
                ? `Comparaison 2 semaines : ${formatWeekRange(data.previousWeek.startDate, data.week.endDate)}`
                : `Contrôles x2 actifs à partir de la semaine suivant le ${formatShortDate(data.firstWeekStartDate)}`}
            </p>
          </div>
        </div>

        <div data-export-ignore="true" className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportImage} disabled={exporting} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Export...' : 'Exporter image'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" />
            Exporter PDF
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'animation' | 'mj')}>
          <TabsList className="mb-4">
            <TabsTrigger value="animation">Pôle Animation</TabsTrigger>
            <TabsTrigger value="mj">Pôle MJ</TabsTrigger>
          </TabsList>

          <TabsContent value="animation">
            <div ref={animExportRef} className="rounded-xl bg-[#0A0B0F] p-4">
              <div className="mb-4 flex items-baseline justify-between border-b border-white/[0.06] pb-3">
                <span className="text-sm font-semibold text-white/70">Pôle Animation</span>
                <span className="text-xs text-white/30">{formatWeekRange(data.week.startDate, data.week.endDate)}</span>
              </div>
              <PoleCards
                warnings={animWarnings}
                justifiedAbsences={animJustifiedAbsences}
                departures={animDepartures}
                unjustifiedThisWeek={animUnjustifiedThisWeek}
                unjustifiedTwoWeeks={animUnjustifiedTwoWeeks}
                quotaMissingThisWeek={animQuotaMissingThisWeek}
                quotaMissingTwoWeeks={animQuotaMissingTwoWeeks}
                hasTwoWeekHistory={data.hasTwoWeekHistory}
                quotaCompletion={villageStats?.quotaCompletion.animation}
              />
            </div>
          </TabsContent>

          <TabsContent value="mj">
            <div ref={mjExportRef} className="rounded-xl bg-[#0A0B0F] p-4">
              <div className="mb-4 flex items-baseline justify-between border-b border-white/[0.06] pb-3">
                <span className="text-sm font-semibold text-white/70">Pôle MJ</span>
                <span className="text-xs text-white/30">{formatWeekRange(data.week.startDate, data.week.endDate)}</span>
              </div>
              <PoleCards
                warnings={mjWarnings}
                justifiedAbsences={mjJustifiedAbsences}
                departures={mjDepartures}
                unjustifiedThisWeek={mjUnjustifiedThisWeek}
                unjustifiedTwoWeeks={mjUnjustifiedTwoWeeks}
                quotaMissingThisWeek={mjQuotaMissingThisWeek}
                quotaMissingTwoWeeks={mjQuotaMissingTwoWeeks}
                hasTwoWeekHistory={data.hasTwoWeekHistory}
                quotaCompletion={villageStats?.quotaCompletion.mj}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
