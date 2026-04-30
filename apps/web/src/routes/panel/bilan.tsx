import { useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toPng } from 'html-to-image'
import { AlertTriangle, ClipboardList, Download, FileDown, LogOut, ShieldAlert, Target, UserX, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useWeeklyReview, type WeeklyReviewDeparture, type WeeklyReviewMember, type WeeklyReviewWarning } from '@/hooks/queries/useAnimations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { StaffRoleKey } from '@/lib/config/discord'

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function formatShortDate(value: string): string {
  return format(dateFromInput(value), 'dd/MM/yyyy', { locale: fr })
}

function formatWeekRange(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)} - ${format(addDays(dateFromInput(endDate), -1), 'dd/MM/yyyy', { locale: fr })}`
}

function EmptyState() {
  return <p className="py-6 text-center text-sm text-white/25">Rien à signaler</p>
}

function MemberLine({ member }: { member: WeeklyReviewMember }) {
  return (
    <Link
      to={`/panel/casiers?user_id=${member.id}`}
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 transition-colors hover:border-cyan-400/25 hover:bg-cyan-400/[0.04]"
    >
      <UserAvatar avatarUrl={member.avatar_url} username={member.username} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white/85">{member.username}</p>
          <RoleBadge role={member.role as StaffRoleKey} />
        </div>
        <p className="mt-0.5 truncate text-xs text-white/30">
          {member.discord_username ? `@${member.discord_username}` : 'Discord inconnu'}
          {member.steam_id ? ` · ${member.steam_id}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-white/85">{member.quota}/{member.quotaMax}</p>
        <p className="text-[10px] uppercase tracking-wide text-red-300/70">-{member.missing}</p>
      </div>
    </Link>
  )
}

function MemberList({ members }: { members: WeeklyReviewMember[] }) {
  if (members.length === 0) return <EmptyState />
  return (
    <div className="space-y-2">
      {members.map((member) => <MemberLine key={member.id} member={member} />)}
    </div>
  )
}

function WarningLine({ warning }: { warning: WeeklyReviewWarning }) {
  const user = warning.user
  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3">
      <div className="flex items-start gap-3">
        <UserAvatar avatarUrl={user?.avatar_url ?? null} username={user?.username ?? 'Membre'} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <Link to={`/panel/casiers?user_id=${user.id}`} className="text-sm font-medium text-white/85 hover:text-cyan-300">
                {user.username}
              </Link>
            ) : (
              <p className="text-sm font-medium text-white/60">Membre inconnu</p>
            )}
            {user?.role && <RoleBadge role={user.role as StaffRoleKey} />}
            <span className="text-xs text-white/35">{formatShortDate(warning.warning_date)}</span>
          </div>
          <p className="mt-1 text-sm text-white/65">{warning.reason}</p>
          {warning.creator && (
            <p className="mt-1 text-xs text-white/30">Ajouté par {warning.creator.username}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DepartureLine({ departure }: { departure: WeeklyReviewDeparture }) {
  return (
    <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-3">
      <div className="flex items-start gap-3">
        <UserAvatar avatarUrl={departure.avatar_url} username={departure.username} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white/80">{departure.username}</p>
            <RoleBadge role={departure.role as StaffRoleKey} />
            {departure.deactivated_at && (
              <span className="text-xs text-white/35">
                {format(new Date(departure.deactivated_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/65">{departure.deactivation_reason ?? 'Aucune raison renseignée'}</p>
          <p className="mt-1 text-xs text-white/30">
            {departure.discord_username ? `@${departure.discord_username}` : 'Discord inconnu'}
            {departure.steam_id ? ` · ${departure.steam_id}` : ''}
            {departure.deactivated_by_username ? ` · retiré par ${departure.deactivated_by_username}` : ''}
          </p>
        </div>
      </div>
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
    <GlassCard className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="mt-0.5 text-xs text-white/35">{subtitle}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/60">
          {count}
        </span>
      </div>
      {children}
    </GlassCard>
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
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
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
          {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-64" />)}
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <style>{`
        @media print {
          body { background: #0A0B0F !important; }
          aside, header, [data-export-ignore="true"] { display: none !important; }
          main { overflow: visible !important; }
          #weekly-review-export {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div ref={exportRef} id="weekly-review-export" className="space-y-6 bg-[#0A0B0F]">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewCard
          title="Avertissements"
          subtitle="Warns ajoutés sur la semaine active"
          icon={ShieldAlert}
          count={data.warnings.length}
          tone="amber"
        >
          {data.warnings.length === 0 ? <EmptyState /> : (
            <div className="space-y-2">
              {data.warnings.map((warning) => <WarningLine key={warning.id} warning={warning} />)}
            </div>
          )}
        </ReviewCard>

        <ReviewCard
          title="Départs"
          subtitle="Membres retirés du panel cette semaine"
          icon={LogOut}
          count={data.departures.length}
          tone="red"
        >
          {data.departures.length === 0 ? <EmptyState /> : (
            <div className="space-y-2">
              {data.departures.map((departure) => <DepartureLine key={departure.id} departure={departure} />)}
            </div>
          )}
        </ReviewCard>

        <ReviewCard
          title="Absence sans justification"
          subtitle="Quota à 0 et aucune absence déclarée cette semaine"
          icon={UserX}
          count={data.unjustifiedThisWeek.length}
          tone="red"
        >
          <MemberList members={data.unjustifiedThisWeek} />
        </ReviewCard>

        <ReviewCard
          title="Absence sans justification x2"
          subtitle="Quota à 0 sans absence sur les 2 dernières semaines"
          icon={UserX}
          count={data.unjustifiedTwoWeeks.length}
          tone="red"
        >
          <MemberList members={data.unjustifiedTwoWeeks} />
        </ReviewCard>

        <ReviewCard
          title="Quota non rempli"
          subtitle="Membres sous quota sur la semaine active"
          icon={Target}
          count={data.quotaMissingThisWeek.length}
          tone="amber"
        >
          <MemberList members={data.quotaMissingThisWeek} />
        </ReviewCard>

        <ReviewCard
          title="Quota non rempli x2"
          subtitle="Membres sous quota sur les 2 dernières semaines"
          icon={AlertTriangle}
          count={data.quotaMissingTwoWeeks.length}
          tone="amber"
        >
          <MemberList members={data.quotaMissingTwoWeeks} />
        </ReviewCard>
      </div>
      </div>
    </div>
  )
}
