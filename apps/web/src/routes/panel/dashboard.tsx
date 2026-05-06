import { useState } from 'react'
import { Link } from 'react-router'
import { Sword, Clock, Users, Target, AlertCircle, ChevronRight, ChevronDown, Plus, Calendar, UserCog, ChevronLeft, CalendarDays, Megaphone, Send, X, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { useWeeklyStats, useAnimations, useMyReports, useBroadcasts, useMemberDirectory } from '@/hooks/queries/useAnimations'
import { useCreateBroadcast, useArchiveBroadcast } from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatTime } from '@/lib/utils/format'
import { hasOwnedRole, ROLE_LABELS } from '@/lib/config/discord'
import { cn } from '@/lib/utils/cn'
import type { Broadcast } from '@/types/database'

type BroadcastAudience = Broadcast['audience']

const BROADCAST_AUDIENCE_OPTIONS: Array<{ value: BroadcastAudience; label: string; description: string }> = [
  { value: 'all', label: 'Tout le monde', description: 'Visible par tous les utilisateurs.' },
  { value: 'pole_animation', label: 'Pôle Animation', description: 'Visible par le pôle Animation.' },
  { value: 'pole_mj', label: 'Pôle MJ', description: 'Visible par le pôle MJ.' },
  { value: 'pole_bdm', label: 'Pôle BDM', description: 'Visible par le pôle BDM.' },
  { value: 'selected', label: 'Utilisateurs sélectionnés', description: 'Visible uniquement par la sélection.' },
]

function broadcastAudienceLabel(audience: BroadcastAudience): string {
  return BROADCAST_AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label ?? 'Ciblé'
}

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

function BroadcastCenter({
  broadcasts,
  loading,
  canManage,
}: {
  broadcasts: Broadcast[]
  loading: boolean
  canManage: boolean
}) {
  const { data: members = [] } = useMemberDirectory(canManage)
  const { mutateAsync: createBroadcast, isPending: creating } = useCreateBroadcast()
  const { mutateAsync: archiveBroadcast, isPending: archiving } = useArchiveBroadcast()
  const [showForm, setShowForm] = useState(false)
  const [showBroadcasts, setShowBroadcasts] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<BroadcastAudience>('all')
  const [recipientIds, setRecipientIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  const normalizedSearch = memberSearch.trim().toLowerCase()
  const filteredMembers = normalizedSearch
    ? members.filter((member) => member.username.toLowerCase().includes(normalizedSearch))
    : members

  const toggleRecipient = (userId: string) => {
    setRecipientIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  const resetForm = () => {
    setTitle('')
    setMessage('')
    setAudience('all')
    setRecipientIds([])
    setMemberSearch('')
    setShowForm(false)
  }

  const handleSubmit = async () => {
    try {
      await createBroadcast({
        title,
        message,
        audience,
        recipientIds: audience === 'selected' ? recipientIds : [],
      })
      toast.success('Broadcast publié')
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du broadcast')
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await archiveBroadcast(id)
      toast.success('Broadcast archivé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'archivage")
    }
  }

  if (!canManage) {
    if (loading) {
      return <Skeleton className="h-20 w-full rounded-xl" />
    }
    if (broadcasts.length === 0) return null

    return (
      <div className="space-y-3">
        {broadcasts.map((broadcast) => (
          <motion.div
            key={broadcast.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20">
              <Megaphone className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cyan-200">{broadcast.title || 'Annonce'}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-cyan-100/75">
                {broadcast.message}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  return (
    <GlassCard className="p-5 border border-cyan-400/15 bg-cyan-400/[0.03]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowBroadcasts((v) => !v)}
          className="flex min-w-0 items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10">
            <Megaphone className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="min-w-0 text-left">
            <h2 className="text-sm font-semibold text-white/85">
              Broadcast
              {broadcasts.length > 0 && (
                <span className="ml-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
                  {broadcasts.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-white/35">Messages affichés sur le dashboard</p>
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/30 transition-transform', showBroadcasts && 'rotate-180')} />
        </button>
        <Button
          type="button"
          size="sm"
          variant={showForm ? 'outline' : 'default'}
          onClick={() => setShowForm((value) => !value)}
          className="shrink-0 gap-1.5"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Fermer' : 'Nouveau'}
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Titre optionnel"
          />
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            placeholder="Message à afficher sur le dashboard"
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            {BROADCAST_AUDIENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAudience(option.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  audience === option.value
                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/75',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {audience === 'selected' && (
            <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/10 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Rechercher un pseudo"
                  className="h-9 pl-9"
                />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-white/30">Aucun membre trouvé</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={recipientIds.includes(member.id)}
                          onChange={() => toggleRecipient(member.id)}
                          className="h-3.5 w-3.5 accent-cyan-400"
                        />
                        <UserAvatar avatarUrl={member.avatarUrl} username={member.username} size="xs" />
                        <span className="truncate">{member.username}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/35">
              {audience === 'selected'
                ? `${recipientIds.length} destinataire(s) sélectionné(s).`
                : BROADCAST_AUDIENCE_OPTIONS.find((option) => option.value === audience)?.description}
            </p>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={creating || message.trim().length === 0 || (audience === 'selected' && recipientIds.length === 0)}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Publier
            </Button>
          </div>
        </div>
      )}

      {showBroadcasts && (
        loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : broadcasts.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/30">
            Aucun broadcast actif.
          </p>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-cyan-100">
                        {broadcast.title || 'Annonce'}
                      </p>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/40">
                        {broadcastAudienceLabel(broadcast.audience)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/70">
                      {broadcast.message}
                    </p>
                    <p className="mt-2 text-[11px] text-white/35">
                      {broadcast.creator?.username ? `Par ${broadcast.creator.username} · ` : ''}
                      {formatDateTime(broadcast.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleArchive(broadcast.id)}
                    disabled={archiving}
                    className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
                    title="Archiver"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </GlassCard>
  )
}

export default function Dashboard() {
  const { user, role, permissionRoles } = useRequiredAuth()
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const { data: stats, isLoading: statsLoading } = useWeeklyStats(undefined, bounds.start)
  const { data: animsResult, isLoading: animsLoading } = useAnimations({
    status: ['pending_validation', 'open', 'preparing', 'running'],
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
  const { data: broadcastData, isLoading: broadcastsLoading } = useBroadcasts()

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
  const canManageBroadcasts = hasOwnedRole(permissionRoles, ['direction', 'gerance', 'responsable', 'responsable_mj', 'responsable_bdm'])
  const canCreateBdmMission = hasOwnedRole(permissionRoles, ['bdm', 'responsable_bdm'])
  const weekLabel = `${format(bounds.start, 'dd/MM', { locale: fr })} - ${format(bounds.end, 'dd/MM', { locale: fr })}`
  const statsPeriodLabel = isCurrentWeek() ? 'cette semaine' : `semaine du ${weekLabel}`

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
              {user.discord_id === '381763507991085056' ? 'Salam Aleykoum' : 'Bonjour'}, <span className="text-gradient-cyan">{user.username}</span>
            </h1>
            <p className="text-sm text-white/40">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </motion.div>

      <BroadcastCenter
        broadcasts={broadcastData?.broadcasts ?? []}
        loading={broadcastsLoading}
        canManage={canManageBroadcasts}
      />

      {/* Stats */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white/80">Stats hebdomadaires</h2>
          <p className="text-xs text-white/35">{statsPeriodLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          <Button variant="ghost" size="sm" onClick={goPrev} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={goToday}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
            {isCurrentWeek() ? 'Cette sem.' : weekLabel}
          </button>
          <Button variant="ghost" size="sm" onClick={goNext} disabled={isCurrentWeek()} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Sword}
          label="Animations créées"
          value={stats?.animationsCreated ?? 0}
          sub={statsPeriodLabel}
          color="cyan"
          loading={statsLoading}
        />
        <StatCard
          icon={Users}
          label="Participations"
          value={stats?.participationsValidated ?? 0}
          sub="validées"
          color="emerald"
          loading={statsLoading}
        />
        <StatCard
          icon={Clock}
          label="Heures animées"
          value={stats ? `${(stats.hoursAnimated / 60).toFixed(1)}h` : '0h'}
          sub={statsPeriodLabel}
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
                {canCreateBdmMission ? 'Créer une mission BDM' : 'Créer une animation'}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {canCreateBdmMission ? 'Programmer ou déclarer une mission' : 'Proposer une nouvelle session'}
              </p>
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
                        {anim.required_participants > 0
                          ? `${anim.validated_participants_count ?? 0}/${anim.required_participants}`
                          : 'Aucun participant'}
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
                      En tant que {report.pole === 'bdm' ? 'BDM' : report.pole === 'mj' ? 'MJ' : 'Animateur'} · {report.character_name}
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
