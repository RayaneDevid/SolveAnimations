import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft, Play, Square, Clock, Users, Calendar,
  Check, X, UserPlus, Pencil, Ban, Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAnimation } from '@/hooks/queries/useAnimations'
import {
  useStartAnimation, useStartPrepAnimation, useStopPrepAnimation,
  useStopAnimation, useCancelAnimation,
  useApplyParticipant, useDecideParticipant,
} from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime, formatDuration } from '@/lib/utils/format'
import { hasRole } from '@/lib/config/discord'
import type { AnimationParticipant } from '@/types/database'

function ElapsedTimer({ since, label }: { since: string; label: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - new Date(since).getTime()) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [since])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const formatted = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-sm font-mono font-semibold text-cyan-400">{formatted}</span>
    </div>
  )
}

function ParticipantRow({
  p,
  canDecide,
  animationId,
}: {
  p: AnimationParticipant
  canDecide: boolean
  animationId: string
}) {
  const { mutateAsync: decide, isPending } = useDecideParticipant()

  const handleDecide = async (decision: 'validated' | 'rejected') => {
    try {
      await decide({ participantId: p.id, decision, animationId })
    } catch (err) {
      toast.error('Erreur')
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <UserAvatar avatarUrl={p.user?.avatar_url} username={p.user?.username ?? '?'} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{p.user?.username}</p>
        <p className="text-xs text-white/40 truncate">Perso: {p.character_name}</p>
      </div>
      {p.user?.role && <RoleBadge role={p.user.role} size="sm" />}
      {canDecide && p.status === 'pending' && (
        <div className="flex gap-1.5">
          <button
            onClick={() => handleDecide('validated')}
            disabled={isPending}
            className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDecide('rejected')}
            disabled={isPending}
            className="h-7 w-7 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function ApplyModal({ animationId, open, onClose }: { animationId: string; open: boolean; onClose: () => void }) {
  const [characterName, setCharacterName] = useState('')
  const { mutateAsync, isPending } = useApplyParticipant()

  const handleSubmit = async () => {
    if (!characterName.trim()) return
    try {
      await mutateAsync({ animationId, characterName: characterName.trim() })
      toast.success('Candidature envoyée !')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Se proposer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Nom de ton personnage</label>
            <Input
              placeholder="Nom du perso joué"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isPending || !characterName.trim()}>
              {isPending ? 'Envoi...' : 'Se proposer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function AnimationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, role } = useRequiredAuth()
  const [applyOpen, setApplyOpen] = useState(false)

  const { data, isLoading } = useAnimation(id!)
  const { mutateAsync: start, isPending: starting } = useStartAnimation()
  const { mutateAsync: startPrep, isPending: startingPrep } = useStartPrepAnimation()
  const { mutateAsync: stopPrep, isPending: stoppingPrep } = useStopPrepAnimation()
  const { mutateAsync: stop, isPending: stopping } = useStopAnimation()
  const { mutateAsync: cancel, isPending: cancelling } = useCancelAnimation()

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!data) return null

  const { animation, participants } = data
  const isCreator = animation.creator_id === user.id
  const isResponsable = hasRole(role, 'responsable')
  const isParticipant = participants.some((p) => p.user_id === user.id)

  const validated = participants.filter((p) => p.status === 'validated')
  const pending = participants.filter((p) => p.status === 'pending')
  const participantProgress = Math.min(100, (validated.length / animation.required_participants) * 100)

  const handleStartPrep = async () => {
    try {
      await startPrep(animation.id)
      toast.success('Préparation démarrée !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleStopPrep = async () => {
    try {
      await stopPrep(animation.id)
      toast.success('Préparation terminée ! Lance maintenant l\'animation.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleStart = async () => {
    try {
      await start(animation.id)
      toast.success('Animation démarrée !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleStop = async () => {
    try {
      await stop(animation.id)
      toast.success('Animation terminée ! Les rapports ont été générés.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleCancel = async () => {
    if (!confirm('Annuler cette animation ?')) return
    try {
      await cancel(animation.id)
      toast.success('Animation annulée.')
      navigate('/panel/animations')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8 mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{animation.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            {animation.creator && (
              <div className="flex items-center gap-1.5">
                <UserAvatar
                  avatarUrl={animation.creator.avatar_url}
                  username={animation.creator.username}
                  size="xs"
                />
                <span className="text-sm text-white/50">
                  par <span className="text-white/70">{animation.creator.username}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={animation.status} />
      </div>

      {/* Meta bar */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Calendar className="h-4 w-4 text-cyan-400" />
            {formatDateTime(animation.scheduled_at)}
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Clock className="h-4 w-4 text-violet-400" />
            {formatDuration(animation.planned_duration_min)}
            {animation.prep_time_min > 0 && ` · Prépa ${formatDuration(animation.prep_time_min)}`}
          </div>
          <ServerBadge server={animation.server} />
          <VillageBadge village={animation.village} />
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Users className="h-4 w-4 text-emerald-400" />
            {validated.length}/{animation.required_participants}
          </div>
          {animation.description && (
            <p className="text-sm text-white/60 line-clamp-2">{animation.description}</p>
          )}
        </div>
        <Progress value={participantProgress} className="mt-3" />
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Participants */}
        <div className="lg:col-span-2 space-y-4">
          {/* Validated */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Participants validés ({validated.length})
            </h2>
            {validated.length === 0 ? (
              <p className="text-sm text-white/30 py-2">Aucun participant validé</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {validated.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    p={p}
                    canDecide={isCreator && ['open', 'preparing'].includes(animation.status)}
                    animationId={animation.id}
                  />
                ))}
              </div>
            )}
          </GlassCard>

          {/* Pending */}
          {pending.length > 0 && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                En attente de validation ({pending.length})
              </h2>
              <div className="divide-y divide-white/[0.05]">
                {pending.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    p={p}
                    canDecide={isCreator && ['open', 'preparing'].includes(animation.status)}
                    animationId={animation.id}
                  />
                ))}
              </div>
            </GlassCard>
          )}

          {/* Apply CTA */}
          {['open', 'preparing'].includes(animation.status) && !isCreator && !isParticipant && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white/80">Se proposer</h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Rejoins cette animation en tant que participant
                  </p>
                </div>
                <Button onClick={() => setApplyOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Se proposer
                </Button>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {(isCreator || isResponsable) && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                Contrôle
              </h2>
              <div className="space-y-2">
                {/* ── Prep timer: start ── */}
                {animation.status === 'open' && isCreator && animation.prep_time_min > 0 && !animation.prep_started_at && (
                  <Button
                    onClick={handleStartPrep}
                    disabled={startingPrep}
                    variant="secondary"
                    className="w-full gap-2"
                  >
                    <Timer className="h-4 w-4" />
                    Démarrer la préparation
                  </Button>
                )}

                {/* ── Prep timer: running ── */}
                {animation.status === 'preparing' && isCreator && (
                  <>
                    <ElapsedTimer since={animation.prep_started_at!} label="Préparation en cours" />
                    <Button
                      onClick={handleStopPrep}
                      disabled={stoppingPrep}
                      variant="secondary"
                      className="w-full gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Arrêter la préparation
                    </Button>
                  </>
                )}

                {/* ── Animation: start ── */}
                {(animation.status === 'open' || animation.status === 'preparing') && isCreator &&
                  (animation.prep_time_min === 0 || animation.prep_ended_at) && (
                  <Button
                    onClick={handleStart}
                    disabled={starting}
                    className="w-full gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Démarrer l'animation
                  </Button>
                )}

                {/* ── Animation: running ── */}
                {animation.status === 'running' && isCreator && (
                  <>
                    <ElapsedTimer since={animation.started_at!} label="Animation en cours" />
                    <Button
                      onClick={handleStop}
                      disabled={stopping}
                      variant="secondary"
                      className="w-full gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Terminer l'animation
                    </Button>
                  </>
                )}

                {['open', 'pending_validation', 'preparing'].includes(animation.status) && (isCreator || isResponsable) && (
                  <Button
                    onClick={handleCancel}
                    disabled={cancelling}
                    variant="destructive"
                    className="w-full gap-2"
                  >
                    <Ban className="h-4 w-4" />
                    Annuler
                  </Button>
                )}
                {animation.status === 'open' && isCreator && (
                  <Link to={`/panel/animations/${animation.id}/edit`}>
                    <Button variant="outline" className="w-full gap-2">
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </Button>
                  </Link>
                )}
              </div>
            </GlassCard>
          )}

          {/* Info */}
          {animation.rejection_reason && (
            <GlassCard className="p-5 border-red-500/20 bg-red-500/5">
              <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Motif de refus
              </h2>
              <p className="text-sm text-white/70">{animation.rejection_reason}</p>
            </GlassCard>
          )}

          {animation.status === 'finished' && animation.actual_duration_min && (
            <GlassCard className="p-5 space-y-3">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Durée réelle
              </h2>
              <div>
                <p className="text-xs text-white/40 mb-0.5">Animation</p>
                <p className="text-2xl font-bold text-white">
                  {formatDuration(animation.actual_duration_min)}
                </p>
              </div>
              {animation.actual_prep_time_min != null && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Préparation</p>
                  <p className="text-lg font-semibold text-white/70">
                    {formatDuration(animation.actual_prep_time_min)}
                  </p>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      <ApplyModal
        animationId={animation.id}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
      />
    </div>
  )
}
