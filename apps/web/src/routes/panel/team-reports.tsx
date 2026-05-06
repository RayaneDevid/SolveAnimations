import { useMemo, useState } from 'react'
import { FileText, AlertCircle, CheckCircle2, ChevronRight, Users } from 'lucide-react'
import { useTeamReports } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { WeekNavigator } from '@/components/calendar/WeekNavigator'
import { GlassCard } from '@/components/shared/GlassCard'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { AnimationReport } from '@/types/database'
import { ReportModal } from './reports'

type ReportPole = 'animation' | 'mj' | 'bdm'

const PAGE_SIZE = 6

const POLE_CONFIG: Record<ReportPole, { title: string; tone: string; dot: string }> = {
  animation: {
    title: 'Pôle Animation',
    tone: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
    dot: 'bg-cyan-400',
  },
  mj: {
    title: 'Pôle MJ',
    tone: 'text-violet-300 border-violet-500/20 bg-violet-500/5',
    dot: 'bg-violet-400',
  },
  bdm: {
    title: 'Pôle BDM',
    tone: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
    dot: 'bg-cyan-400',
  },
}

function TeamReportRow({ report, onClick }: { report: AnimationReport; onClick: () => void }) {
  const submitted = !!report.submitted_at
  const anim = report.animation

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.045] hover:border-white/[0.1] transition-colors group"
    >
      <UserAvatar avatarUrl={report.user?.avatar_url ?? null} username={report.user?.username ?? 'Membre'} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-white/85 truncate">{report.user?.username ?? 'Membre inconnu'}</p>
          {submitted ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
        </div>
        <p className="text-xs text-white/55 truncate mt-0.5">{anim?.title ?? 'Animation'}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {anim?.scheduled_at && <span className="text-xs text-white/30">{formatDateTime(anim.scheduled_at)}</span>}
          {anim?.server && <ServerBadge server={anim.server} />}
          {anim?.village && <VillageBadge village={anim.village} />}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-1">
        <span className={cn(
          'text-[10px] rounded-full px-2 py-0.5 font-medium',
          submitted ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10',
        )}>
          {submitted ? 'Soumis' : 'À compléter'}
        </span>
        <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
      </div>
    </button>
  )
}

function ReportSection({
  title,
  reports,
  empty,
  onSelect,
}: {
  title: string
  reports: AnimationReport[]
  empty: string
  onSelect: (report: AnimationReport) => void
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const pageReports = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-white/45 uppercase tracking-wider">{title}</p>
        <span className="text-[10px] text-white/30">
          {reports.length > PAGE_SIZE ? `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, reports.length)} / ${reports.length}` : reports.length}
        </span>
      </div>
      {reports.length === 0 ? (
        <p className="text-sm text-white/25 py-4 text-center rounded-xl border border-white/[0.05] bg-white/[0.02]">{empty}</p>
      ) : (
        <>
          <div className="space-y-2">
            {pageReports.map((report) => (
              <TeamReportRow key={report.id} report={report} onClick={() => onSelect(report)} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-3">
              <button
                type="button"
                onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white/55 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-white/55"
              >
                Précédent
              </button>
              <span className="text-xs text-white/35">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
                className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white/55 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-white/55"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PoleReportsCard({
  pole,
  reports,
  onSelect,
}: {
  pole: ReportPole
  reports: AnimationReport[]
  onSelect: (report: AnimationReport) => void
}) {
  const config = POLE_CONFIG[pole]
  const pending = reports.filter((report) => !report.submitted_at)
  const submitted = reports.filter((report) => !!report.submitted_at)

  return (
    <GlassCard className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', config.dot)} />
          <h2 className="text-sm font-semibold text-white/85">{config.title}</h2>
        </div>
        <span className={cn('text-xs rounded-full border px-2.5 py-1', config.tone)}>
          {submitted.length}/{reports.length} soumis
        </span>
      </div>

      <ReportSection
        title="À compléter"
        reports={pending}
        empty="Aucun rapport en attente"
        onSelect={onSelect}
      />
      <ReportSection
        title="Soumis"
        reports={submitted}
        empty="Aucun rapport soumis"
        onSelect={onSelect}
      />
    </GlassCard>
  )
}

export default function TeamReports() {
  const { bounds, goPrev, goNext, goToday, isCurrentWeek } = useCurrentWeek()
  const { data: reports = [], isLoading } = useTeamReports(bounds)
  const [selected, setSelected] = useState<AnimationReport | null>(null)

  const byPole = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const aPending = !a.submitted_at ? 0 : 1
      const bPending = !b.submitted_at ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return (b.animation?.scheduled_at ?? '').localeCompare(a.animation?.scheduled_at ?? '')
    })
    return {
      animation: sorted.filter((report) => report.pole !== 'mj' && report.pole !== 'bdm'),
      mj: sorted.filter((report) => report.pole === 'mj'),
      bdm: sorted.filter((report) => report.pole === 'bdm'),
    }
  }, [reports])

  const pendingCount = reports.filter((report) => !report.submitted_at).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <FileText className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Rapports équipe</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {pendingCount} rapport{pendingCount > 1 ? 's' : ''} en attente cette semaine
            </p>
          </div>
        </div>
        <WeekNavigator
          weekStart={bounds.start}
          weekEnd={bounds.end}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
          isCurrentWeek={isCurrentWeek()}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => (
            <GlassCard key={i} className="p-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </GlassCard>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Users className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-sm text-white/30">Aucun rapport équipe sur cette semaine</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <PoleReportsCard pole="animation" reports={byPole.animation} onSelect={setSelected} />
          <PoleReportsCard pole="mj" reports={byPole.mj} onSelect={setSelected} />
          <PoleReportsCard pole="bdm" reports={byPole.bdm} onSelect={setSelected} />
        </div>
      )}

      {selected && (
        <ReportModal
          report={selected}
          readOnly
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
