import { useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toPng } from 'html-to-image'
import { AlertTriangle, ClipboardList, Download, FileDown, LogOut, ShieldAlert, Target, UserX, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useWeeklyReview, type WeeklyReviewDeparture, type WeeklyReviewMember, type WeeklyReviewWarning } from '@/hooks/queries/useAnimations'
import { GlassCard } from '@/components/shared/GlassCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

function isMjRole(role: string): boolean {
  return MJ_ROLES.includes(role)
}

function isEffectivelyMj(m: WeeklyReviewMember): boolean {
  if (m.pay_pole === 'mj') return true
  if (m.pay_pole === 'animation') return false
  return ['mj', 'mj_senior'].includes(m.role)
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

function MemberBadge({ member }: { member: WeeklyReviewMember }) {
  return (
    <Link
      to={`/panel/casiers?user_id=${member.id}`}
      title={memberTitle(member)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-xs text-white/75 transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]"
    >
      <UserAvatar avatarUrl={member.avatar_url} username={member.username} size="xs" />
      <span className="max-w-[150px] truncate whitespace-nowrap font-medium">{member.username}</span>
      <span className="shrink-0 text-white/35">{member.quota}/{member.quotaMax}</span>
    </Link>
  )
}

function MemberList({ members }: { members: WeeklyReviewMember[] }) {
  if (members.length === 0) return <EmptyState />
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => <MemberBadge key={member.id} member={member} />)}
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

function DepartureBadge({ departure }: { departure: WeeklyReviewDeparture }) {
  const title = [
    departure.username,
    departure.discord_username ? `Discord: @${departure.discord_username}` : 'Discord inconnu',
    departure.steam_id ? `SteamID: ${departure.steam_id}` : null,
    departure.deactivation_reason ? `Raison: ${departure.deactivation_reason}` : 'Raison: aucune raison renseignée',
    departure.deactivated_by_username ? `Retiré par: ${departure.deactivated_by_username}` : null,
  ].filter(Boolean).join('\n')

  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/[0.07] px-2 py-1 text-xs text-red-100/85"
    >
      <UserAvatar avatarUrl={departure.avatar_url} username={departure.username} size="xs" />
      <span className="max-w-[150px] truncate whitespace-nowrap font-medium">{departure.username}</span>
      {departure.deactivated_at && (
        <span className="shrink-0 text-red-200/45">
          {format(new Date(departure.deactivated_at), 'dd/MM', { locale: fr })}
        </span>
      )}
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
  children,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  count: number
  tone: 'amber' | 'red' | 'cyan'
  children: React.ReactNode
}) {
  const toneClasses = {
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/20 bg-red-500/10 text-red-300',
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
  }

  return (
    <GlassCard className="p-3">
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
        <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-semibold text-white/60">
          {count}
        </span>
      </div>
      {children}
    </GlassCard>
  )
}

function PoleCards({
  warnings,
  departures,
  unjustifiedThisWeek,
  unjustifiedTwoWeeks,
  quotaMissingThisWeek,
  quotaMissingTwoWeeks,
  hasTwoWeekHistory,
}: {
  warnings: WeeklyReviewWarning[]
  departures: WeeklyReviewDeparture[]
  unjustifiedThisWeek: WeeklyReviewMember[]
  unjustifiedTwoWeeks: WeeklyReviewMember[]
  quotaMissingThisWeek: WeeklyReviewMember[]
  quotaMissingTwoWeeks: WeeklyReviewMember[]
  hasTwoWeekHistory: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        tone="amber"
      >
        <MemberList members={quotaMissingThisWeek} />
      </ReviewCard>

      {hasTwoWeekHistory && (
        <ReviewCard
          title="Quota non rempli x2"
          subtitle="Membres sous quota sur 2 semaines"
          icon={AlertTriangle}
          count={quotaMissingTwoWeeks.length}
          tone="amber"
        >
          <MemberList members={quotaMissingTwoWeeks} />
        </ReviewCard>
      )}
    </div>
  )
}

export default function Bilan() {
  const { data, isLoading } = useWeeklyReview()
  const exportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const exportFileName = data
    ? `bilan-${data.week.startDate}-${format(addDays(dateFromInput(data.week.endDate), -1), 'yyyy-MM-dd')}`
    : 'bilan'

  const handleExportImage = async () => {
    if (!exportRef.current) return
    setExporting(true)
    await new Promise((resolve) => setTimeout(resolve, 50))
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        skipFonts: true,
        backgroundColor: '#0A0B0F',
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
      })
      const link = document.createElement('a')
      link.download = `${exportFileName}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
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

      <div ref={exportRef} id="weekly-review-export" className="space-y-8 bg-[#0A0B0F]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <ClipboardList className="h-6 w-6 text-cyan-400" />
              Bilan hebdomadaire
            </h1>
            <p className="mt-0.5 text-sm text-white/40">
              Semaine active : {formatWeekRange(data.week.startDate, data.week.endDate)}
            </p>
          </div>
          <p className="text-xs text-white/30">
            {data.hasTwoWeekHistory
              ? `Comparaison 2 semaines : ${formatWeekRange(data.previousWeek.startDate, data.week.endDate)}`
              : `Contrôles x2 actifs à partir de la semaine suivant le ${formatShortDate(data.firstWeekStartDate)}`}
          </p>
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

        <Tabs defaultValue="animation">
          <TabsList className="mb-4">
            <TabsTrigger value="animation">Pôle Animation</TabsTrigger>
            <TabsTrigger value="mj">Pôle MJ</TabsTrigger>
          </TabsList>

          <TabsContent value="animation">
            <PoleCards
              warnings={animWarnings}
              departures={animDepartures}
              unjustifiedThisWeek={animUnjustifiedThisWeek}
              unjustifiedTwoWeeks={animUnjustifiedTwoWeeks}
              quotaMissingThisWeek={animQuotaMissingThisWeek}
              quotaMissingTwoWeeks={animQuotaMissingTwoWeeks}
              hasTwoWeekHistory={data.hasTwoWeekHistory}
            />
          </TabsContent>

          <TabsContent value="mj">
            <PoleCards
              warnings={mjWarnings}
              departures={mjDepartures}
              unjustifiedThisWeek={mjUnjustifiedThisWeek}
              unjustifiedTwoWeeks={mjUnjustifiedTwoWeeks}
              quotaMissingThisWeek={mjQuotaMissingThisWeek}
              quotaMissingTwoWeeks={mjQuotaMissingTwoWeeks}
              hasTwoWeekHistory={data.hasTwoWeekHistory}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
