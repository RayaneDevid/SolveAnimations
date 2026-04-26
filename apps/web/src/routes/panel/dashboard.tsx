import { Link } from 'react-router'
import { Sword, Clock, Users, Target, AlertCircle, ChevronRight, Plus, Calendar, UserCog } from 'lucide-react'
import { motion } from 'framer-motion'
import { useWeeklyStats, useAnimations, useMyReports } from '@/hooks/queries/useAnimations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatTime } from '@/lib/utils/format'
import { ROLE_LABELS } from '@/lib/config/discord'

const QUOTA_MAX: Record<string, number | null> = {
  direction: null,
  gerance: null,
  responsable: null,
  responsable_mj: null,
  senior: 5,
  mj_senior: 3,
  animateur: 5,
  mj: 3,
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'cyan',
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color?: 'cyan' | 'violet' | 'emerald' | 'amber'
  loading?: boolean
}) {
  const colorMap = {
    cyan: 'from-cyan-500/10 to-cyan-600/5 text-cyan-400 border-cyan-500/20',
    violet: 'from-violet-500/10 to-violet-600/5 text-violet-400 border-violet-500/20',
    emerald: 'from-emerald-500/10 to-emerald-600/5 text-emerald-400 border-emerald-500/20',
    amber: 'from-amber-500/10 to-amber-600/5 text-amber-400 border-amber-500/20',
  }

  return (
    <GlassCard className={`p-5 bg-gradient-to-br ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-3xl font-bold text-white">{value}</p>
          )}
          {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
        </div>
        <div className={`rounded-xl bg-gradient-to-br ${colorMap[color]} p-2.5`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  )
}

export default function Dashboard() {
  const { user, role } = useRequiredAuth()
  const { data: stats, isLoading: statsLoading } = useWeeklyStats()
  const { data: animsResult, isLoading: animsLoading } = useAnimations({
    status: ['pending_validation', 'open'],
    order: 'asc',
    pageSize: 12,
  })
  const { data: scheduledParticipantResult, isLoading: scheduledParticipantLoading } = useAnimations({
    as_participant: true,
    status: ['pending_validation', 'open', 'preparing', 'running'],
    order: 'asc',
    pageSize: 5,
  })
  const { data: scheduledCreatedResult, isLoading: scheduledCreatedLoading } = useAnimations({
    creator_id: user.id,
    status: ['pending_validation', 'open', 'preparing', 'running'],
    order: 'asc',
    pageSize: 5,
  })
  const { data: reports, isLoading: reportsLoading } = useMyReports()

  const quotaMax = QUOTA_MAX[role] ?? null
  const quotaPercent = quotaMax ? Math.min(100, ((stats?.quota ?? 0) / quotaMax) * 100) : 100

  const pendingReports = reports?.filter((r) => !r.submitted_at) ?? []
  const upcomingAnims = (animsResult?.animations ?? [])
    .filter((anim) => anim.creator_id !== user.id && !anim.my_participant_status)
    .slice(0, 4)
  const scheduledAnims = [
    ...(scheduledParticipantResult?.animations ?? []),
    ...(scheduledCreatedResult?.animations ?? []),
  ]
    .filter((anim, index, list) => list.findIndex((item) => item.id === anim.id) === index)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 4)
  const scheduledLoading = scheduledParticipantLoading || scheduledCreatedLoading

  const profileIncomplete = !user.steam_id || !user.arrival_date

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Profile incomplete banner */}
      {profileIncomplete && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/panel/profile">
            <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors cursor-pointer">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <UserCog className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300">Profil incomplet</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Renseigne ton Steam ID et ta date d'arrivée pour compléter ton profil.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-400/60 shrink-0" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <UserAvatar avatarUrl={user.avatar_url} username={user.username} size="md" />
          <div>
            <h1 className="text-xl font-bold text-white">
              Bonjour, <span className="text-gradient-cyan">{user.username}</span>
            </h1>
            <p className="text-sm text-white/40">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Sword}
          label="Animations créées"
          value={stats?.animationsCreated ?? 0}
          sub="cette semaine"
          color="cyan"
          loading={statsLoading}
        />
        <StatCard
          icon={Users}
          label="Participations"
          value={stats?.participationsValidated ?? 0}
          sub="validées cette semaine"
          color="emerald"
          loading={statsLoading}
        />
        <StatCard
          icon={Clock}
          label="Heures animées"
          value={stats ? `${(stats.hoursAnimated / 60).toFixed(1)}h` : '0h'}
          sub="cette semaine"
          color="violet"
          loading={statsLoading}
        />
        <StatCard
          icon={Target}
          label="Quota"
          value={quotaMax === null ? '∞' : `${stats?.quota ?? 0}/${quotaMax}`}
          sub={quotaMax === null ? 'Illimité' : 'créations + participations'}
          color="amber"
          loading={statsLoading}
        />
      </div>

      {/* Quota progress */}
      {quotaMax !== null && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-white/70">Progression du quota</p>
            <p className="text-sm font-bold text-white">
              {stats?.quota ?? 0} / {quotaMax}
            </p>
          </div>
          <Progress
            value={quotaPercent}
            indicatorClassName={
              quotaPercent >= 100
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : quotaPercent < 50
                  ? 'bg-gradient-to-r from-red-400 to-orange-400'
                  : undefined
            }
          />
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create animation */}
        <Link to="/panel/animations/new" className="block">
          <GlassCard className="p-5 h-full flex flex-col items-center justify-center gap-5 glass-hover cursor-pointer group min-h-[200px]">
            <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40 transition-all">
              <Plus className="h-8 w-8 text-cyan-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                Créer une animation
              </p>
              <p className="text-xs text-white/30 mt-0.5">Proposer une nouvelle session</p>
            </div>
          </GlassCard>
        </Link>

        {/* Scheduled (user is participant) */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-400" />
              Programmé
            </h2>
            <Link to="/panel/animations?as_participant=1">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {scheduledLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : scheduledAnims.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">Aucune animation programmée</p>
          ) : (
            <div className="space-y-2">
              {scheduledAnims.map((anim) => (
                <Link
                  key={anim.id}
                  to={`/panel/animations/${anim.id}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate group-hover:text-cyan-400 transition-colors">
                      {anim.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-white/40">{formatDateTime(anim.scheduled_at)}</span>
                      <ServerBadge server={anim.server} />
                      <VillageBadge village={anim.village} />
                    </div>
                  </div>
                  <StatusBadge status={anim.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        {/* S'inscrire */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              S'inscrire
            </h2>
            <Link to="/panel/animations">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {animsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : upcomingAnims.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">Aucune animation à venir</p>
          ) : (
            <div className="space-y-2">
              {upcomingAnims.map((anim) => (
                <Link
                  key={anim.id}
                  to={`/panel/animations/${anim.id}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {anim.creator && (
                        <>
                          <UserAvatar avatarUrl={anim.creator.avatar_url} username={anim.creator.username} size="xs" />
                          <span className="text-xs text-white/35 truncate">{anim.creator.username}</span>
                          <span className="text-white/20 text-xs">·</span>
                        </>
                      )}
                      <p className="text-sm font-medium text-white/90 truncate group-hover:text-cyan-400 transition-colors">
                        {anim.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(anim.prep_time_min ?? 0) > 0 && (
                        <span className="text-xs text-white/30">
                          Débrief {formatTime(new Date(new Date(anim.scheduled_at).getTime() - (anim.prep_time_min ?? 0) * 60_000).toISOString())}
                        </span>
                      )}
                      <span className="text-xs text-white/40">{formatDateTime(anim.scheduled_at)}</span>
                      <ServerBadge server={anim.server} />
                      <VillageBadge village={anim.village} />
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {anim.validated_participants_count ?? 0}/{anim.required_participants}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={anim.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Pending reports */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Rapports à compléter
              {pendingReports.length > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5">
                  {pendingReports.length}
                </span>
              )}
            </h2>
            <Link to="/panel/reports">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {reportsLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pendingReports.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-400 text-lg">✓</span>
              </div>
              <p className="text-sm text-white/30">Tous les rapports sont à jour</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReports.slice(0, 4).map((report) => (
                <Link
                  key={report.id}
                  to="/panel/reports"
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {report.animation?.title ?? 'Animation'}
                    </p>
                    <p className="text-xs text-white/40">
                      En tant que {report.pole} · {report.character_name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
