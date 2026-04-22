import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FolderOpen, Search, X, CalendarOff, Clock, Sword,
  Users, Target, Calendar, ChevronRight, ExternalLink,
  FileText, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { Link } from 'react-router'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMembers, useWeeklyStats, useAnimations, useAbsences, useUserReports } from '@/hooks/queries/useAnimations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import type { MemberEntry } from '@/types/database'
import type { StaffRoleKey } from '@/lib/config/discord'

const QUOTA_MAX: Record<string, number | null> = {
  responsable: null,
  senior: 5,
  animateur: 5,
  mj: 3,
}

const ROLE_FILTERS: { key: StaffRoleKey | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'responsable', label: 'Responsables' },
  { key: 'senior', label: 'Seniors' },
  { key: 'animateur', label: 'Animateurs' },
  { key: 'mj', label: 'MJ' },
]

// ─── Member card ────────────────────────────────────────────────────────────

function MemberCard({ member, onClick }: { member: MemberEntry; onClick: () => void }) {
  const quotaMax = QUOTA_MAX[member.role] ?? null
  const quota = member.weeklyStats.animationsCreated + member.weeklyStats.participationsValidated
  const quotaPct = quotaMax ? Math.min(100, (quota / quotaMax) * 100) : 100

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={onClick}
      className="w-full text-left group"
    >
      <GlassCard className="p-5 hover:border-white/[0.16] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer h-full">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="relative shrink-0">
            <UserAvatar avatarUrl={member.avatarUrl} username={member.username} size="lg" />
            {member.isAbsent && (
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#0D0E14] flex items-center justify-center">
                <CalendarOff className="h-3 w-3 text-orange-400" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white/90 truncate group-hover:text-cyan-400 transition-colors">
                {member.username}
              </p>
              <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-cyan-400 shrink-0 transition-colors" />
            </div>
            <RoleBadge role={member.role as StaffRoleKey} className="mt-1" />
            {member.isAbsent && (
              <span className="inline-block mt-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                Absent
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Anim.', value: member.weeklyStats.animationsCreated, color: 'text-cyan-400' },
            { label: 'Part.', value: member.weeklyStats.participationsValidated, color: 'text-emerald-400' },
            {
              label: 'Heures',
              value: `${(member.weeklyStats.hoursAnimated / 60).toFixed(1)}h`,
              color: 'text-violet-400',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className={cn('text-base font-bold', color)}>{value}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Quota bar */}
        {quotaMax !== null ? (
          <div>
            <div className="flex justify-between text-[10px] text-white/40 mb-1">
              <span>Quota</span>
              <span className={cn(quotaPct >= 100 ? 'text-emerald-400' : quotaPct < 40 ? 'text-red-400' : 'text-white/60')}>
                {quota}/{quotaMax}
              </span>
            </div>
            <Progress
              value={quotaPct}
              className="h-1"
              indicatorClassName={
                quotaPct >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : quotaPct < 40
                  ? 'bg-gradient-to-r from-red-400 to-orange-400'
                  : undefined
              }
            />
          </div>
        ) : (
          <p className="text-[10px] text-white/25 text-center">Quota illimité</p>
        )}
      </GlassCard>
    </motion.button>
  )
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function MemberDetail({ member, onClose }: { member: MemberEntry; onClose: () => void }) {
  const { data: stats, isLoading: statsLoading } = useWeeklyStats(member.id)
  const { data: animsResult, isLoading: animsLoading } = useAnimations({
    creator_id: member.id,
    pageSize: 5,
  })
  const { data: absences, isLoading: absencesLoading } = useAbsences(member.id)
  const { data: reports, isLoading: reportsLoading } = useUserReports(member.id)

  const quotaMax = QUOTA_MAX[member.role] ?? null
  const quota = stats ? stats.animationsCreated + stats.participationsValidated : 0
  const quotaPct = quotaMax ? Math.min(100, (quota / quotaMax) * 100) : 100

  const upcomingAnims = (animsResult?.animations ?? []).filter((a) =>
    ['open', 'running', 'pending_validation'].includes(a.status),
  )
  const futureAbsences = (absences ?? []).filter(
    (a) => new Date(a.to_date) >= new Date(),
  )

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-[#0D0E14] border-l border-white/[0.08] z-50 flex flex-col"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-white/[0.06] shrink-0">
          <div className="relative">
            <UserAvatar avatarUrl={member.avatarUrl} username={member.username} size="lg" />
            {member.isAbsent && (
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#0D0E14] flex items-center justify-center border border-orange-500/40">
                <CalendarOff className="h-3 w-3 text-orange-400" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{member.username}</h2>
            <RoleBadge role={member.role as StaffRoleKey} className="mt-1" />
            <p className="text-xs text-white/30 mt-2">
              Connecté {formatDistanceToNow(new Date(member.lastLoginAt), { locale: fr, addSuffix: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Stats this week */}
          <section>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Cette semaine
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Sword, label: 'Animations créées', value: stats?.animationsCreated ?? 0, color: 'text-cyan-400' },
                { icon: Users, label: 'Participations', value: stats?.participationsValidated ?? 0, color: 'text-emerald-400' },
                { icon: Clock, label: 'Heures animées', value: stats ? `${(stats.hoursAnimated / 60).toFixed(1)}h` : '—', color: 'text-violet-400' },
                { icon: Target, label: 'Quota', value: quotaMax === null ? '∞' : `${quota}/${quotaMax}`, color: quotaPct >= 100 ? 'text-emerald-400' : quotaPct < 40 ? 'text-red-400' : 'text-amber-400' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('h-3.5 w-3.5', color)} />
                    <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <p className={cn('text-xl font-bold', color)}>{value}</p>
                  )}
                </div>
              ))}
            </div>

            {quotaMax !== null && (
              <div className="mt-3">
                <Progress
                  value={statsLoading ? 0 : quotaPct}
                  className="h-1.5"
                  indicatorClassName={
                    quotaPct >= 100
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      : quotaPct < 40
                      ? 'bg-gradient-to-r from-red-400 to-orange-400'
                      : undefined
                  }
                />
              </div>
            )}
          </section>

          {/* All-time stats */}
          <section>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Tout le temps
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-white/40 mb-1">Animations</p>
                <p className="text-xl font-bold text-white">{member.totalStats.animationsCreated}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-white/40 mb-1">Heures animées</p>
                <p className="text-xl font-bold text-white">
                  {(member.totalStats.hoursAnimated / 60).toFixed(1)}h
                </p>
              </div>
            </div>
          </section>

          {/* Upcoming animations */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Animations en cours / à venir
              </h3>
              <Link
                to={`/panel/animations?creator_id=${member.id}`}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                Voir tout <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
            {animsLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : upcomingAnims.length === 0 ? (
              <p className="text-sm text-white/25 text-center py-4">Aucune animation à venir</p>
            ) : (
              <div className="space-y-2">
                {upcomingAnims.map((anim) => (
                  <Link
                    key={anim.id}
                    to={`/panel/animations/${anim.id}`}
                    onClick={onClose}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all group"
                  >
                    <Calendar className="h-4 w-4 text-white/30 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                        {anim.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs text-white/30">
                          {format(new Date(anim.scheduled_at), 'd MMM à HH:mm', { locale: fr })}
                        </span>
                        <ServerBadge server={anim.server} />
                        <VillageBadge village={anim.village} />
                      </div>
                    </div>
                    <StatusBadge status={anim.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Reports */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Rapports
              </h3>
              {reports && reports.length > 0 && (
                <span className="text-[10px] text-white/30">
                  {reports.filter((r) => r.submitted_at).length}/{reports.length} soumis
                </span>
              )}
            </div>
            {reportsLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : !reports || reports.length === 0 ? (
              <p className="text-sm text-white/25 text-center py-4">Aucun rapport</p>
            ) : (
              <div className="space-y-2">
                {reports.slice(0, 8).map((report) => {
                  const submitted = !!report.submitted_at
                  return (
                    <Link
                      key={report.id}
                      to={`/panel/animations/${report.animation_id}`}
                      onClick={onClose}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border transition-all group',
                        submitted
                          ? 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]'
                          : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30',
                      )}
                    >
                      {submitted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0 animate-pulse" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                          {report.animation?.title ?? 'Animation'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {report.animation?.scheduled_at && (
                            <span className="text-xs text-white/30">
                              {format(new Date(report.animation.scheduled_at), 'd MMM yyyy', { locale: fr })}
                            </span>
                          )}
                          <span className={cn(
                            'text-[10px] rounded-full px-2 py-0.5',
                            submitted
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-amber-400 bg-amber-500/10',
                          )}>
                            {submitted ? 'Soumis' : 'En attente'}
                          </span>
                          {report.pole && (
                            <span className="text-[10px] text-white/25">{report.pole}</span>
                          )}
                        </div>
                        {submitted && report.comments && (
                          <p className="text-xs text-white/30 mt-1 truncate italic">
                            "{report.comments}"
                          </p>
                        )}
                      </div>
                      <FileText className="h-3.5 w-3.5 text-white/20 mt-0.5 shrink-0" />
                    </Link>
                  )
                })}
                {reports.length > 8 && (
                  <p className="text-xs text-white/25 text-center pt-1">
                    +{reports.length - 8} autres rapports
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Absences */}
          <section>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Absences déclarées
            </h3>
            {absencesLoading ? (
              <Skeleton className="h-14" />
            ) : futureAbsences.length === 0 ? (
              <p className="text-sm text-white/25 text-center py-4">Aucune absence à venir</p>
            ) : (
              <div className="space-y-2">
                {futureAbsences.map((absence) => {
                  const isActive =
                    new Date(absence.from_date) <= new Date() &&
                    new Date(absence.to_date) >= new Date()
                  return (
                    <div
                      key={absence.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border',
                        isActive
                          ? 'bg-orange-500/5 border-orange-500/20'
                          : 'bg-white/[0.03] border-white/[0.06]',
                      )}
                    >
                      <CalendarOff className={cn('h-4 w-4 mt-0.5 shrink-0', isActive ? 'text-orange-400' : 'text-white/30')} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/70">
                          {format(new Date(absence.from_date), 'd MMM', { locale: fr })}
                          {' → '}
                          {format(new Date(absence.to_date), 'd MMM yyyy', { locale: fr })}
                          {isActive && (
                            <span className="ml-2 text-[10px] text-orange-400 bg-orange-500/10 rounded-full px-2 py-0.5">
                              En cours
                            </span>
                          )}
                        </p>
                        {absence.reason && (
                          <p className="text-xs text-white/30 truncate mt-0.5">{absence.reason}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Casiers() {
  const { data: members = [], isLoading } = useMembers()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRoleKey | 'all'>('all')
  const [selected, setSelected] = useState<MemberEntry | null>(null)

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch = m.username.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'all' || m.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [members, search, roleFilter])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-cyan-400" />
          Casiers
        </h1>
        <p className="text-sm text-white/40 mt-0.5">
          Fiche individuelle de chaque membre de l'équipe
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <Input
            placeholder="Rechercher un membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={cn(
                'px-3 h-9 rounded-lg text-sm font-medium transition-colors',
                roleFilter === key
                  ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                  : 'text-white/40 border border-white/[0.08] hover:text-white/70 hover:bg-white/[0.04]',
              )}
            >
              {label}
              <span className={cn(
                'ml-1.5 text-xs',
                roleFilter === key ? 'text-cyan-400/70' : 'text-white/25',
              )}>
                {key === 'all' ? members.length : members.filter((m) => m.role === key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun membre trouvé</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={() => setSelected(member)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <MemberDetail
            key={selected.id}
            member={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
