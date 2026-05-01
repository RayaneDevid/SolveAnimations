import { useState } from 'react'
import { Link } from 'react-router'
import { Check, X, Calendar, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAnimations, useDeletionRequests, useTimeCorrectionRequests } from '@/hooks/queries/useAnimations'
import {
  useValidateAnimation, useRejectAnimation, useApproveDeletion, useDenyDeletion,
  useApproveTimeCorrection, useDenyTimeCorrection,
} from '@/hooks/mutations/useAnimationMutations'
import type { AnimationStatus, DeletionRequest, TimeCorrectionRequest } from '@/types/database'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatDuration } from '@/lib/utils/format'
import type { Animation } from '@/types/database'
import { useRequiredAuth } from '@/hooks/useAuth'
import { hasPermissionRole } from '@/lib/config/discord'

function isPastMissionForSeniorValidation(animation: Animation): boolean {
  return animation.status === 'pending_validation' &&
    animation.actual_duration_min != null &&
    new Date(animation.scheduled_at).getTime() <= Date.now()
}

function RejectModal({
  animation,
  open,
  onClose,
}: {
  animation: Animation
  open: boolean
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const { mutateAsync, isPending } = useRejectAnimation()

  const handleReject = async () => {
    if (reason.trim().length < 5) {
      toast.error('Le motif doit faire au moins 5 caractères')
      return
    }
    try {
      await mutateAsync({ id: animation.id, reason: reason.trim() })
      toast.success('Animation refusée')
      onClose()
    } catch (err) {
      toast.error('Erreur')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser l'animation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Animation : <span className="text-white/90 font-medium">{animation.title}</span>
          </p>
          <div className="space-y-1.5">
            <label className="text-xs text-white/40 uppercase tracking-wider">Motif du refus</label>
            <Textarea
              placeholder="Explique la raison du refus..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
            />
            <p className="text-xs text-white/30 text-right">{reason.length}/500</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || reason.trim().length < 5}
            >
              {isPending ? 'Refus...' : 'Confirmer le refus'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ValidationCard({ animation, canReject }: { animation: Animation; canReject: boolean }) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const { mutateAsync: validate, isPending: validating } = useValidateAnimation()
  const isPastMission = isPastMissionForSeniorValidation(animation)

  const handleValidate = async () => {
    try {
      await validate(animation.id)
      toast.success(isPastMission ? 'Mission passée validée et ajoutée comme terminée !' : 'Animation validée !')
    } catch (err) {
      toast.error('Erreur')
    }
  }

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <Link
              to={`/panel/animations/${animation.id}`}
              className="text-sm font-semibold text-white/90 hover:text-cyan-400 transition-colors"
            >
              {animation.title}
            </Link>
            {animation.creator && (
              <div className="flex items-center gap-1.5 mt-1">
                <UserAvatar
                  avatarUrl={animation.creator.avatar_url}
                  username={animation.creator.username}
                  size="xs"
                />
                <span className="text-xs text-white/40">{animation.creator.username}</span>
              </div>
            )}
          </div>
          <StatusBadge status={animation.status} />
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            {formatDateTime(animation.scheduled_at)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Clock className="h-3.5 w-3.5 text-violet-400" />
            {formatDuration(animation.actual_duration_min ?? animation.planned_duration_min)}
            {isPastMission && <span className="text-white/30">réel</span>}
          </div>
          {isPastMission && animation.actual_prep_time_min != null && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Prépa {formatDuration(animation.actual_prep_time_min)}
            </div>
          )}
          <ServerBadge server={animation.server} />
          <VillageBadge village={animation.village} />
        </div>

        {animation.description && (
          <p className="text-xs text-white/50 mb-3 line-clamp-2">{animation.description}</p>
        )}

        {animation.status === 'pending_validation' && (
          <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              onClick={handleValidate}
              disabled={validating}
              variant="success"
              size="sm"
              className="flex-1 gap-2"
            >
              <Check className="h-3.5 w-3.5" />
              Valider
            </Button>
            {canReject && (
              <Button
                onClick={() => setRejectOpen(true)}
                variant="destructive"
                size="sm"
                className="flex-1 gap-2"
              >
                <X className="h-3.5 w-3.5" />
                Refuser
              </Button>
            )}
            {!canReject && isPastMission && (
              <span className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center text-xs text-white/35">
                Refus réservé aux responsables
              </span>
            )}
          </div>
        )}
      </GlassCard>
      <RejectModal animation={animation} open={rejectOpen} onClose={() => setRejectOpen(false)} />
    </>
  )
}

function DeletionRequestCard({ request }: { request: DeletionRequest }) {
  const { mutate: approve, isPending: approving } = useApproveDeletion()
  const { mutate: deny, isPending: denying } = useDenyDeletion()

  const handleApprove = () => {
    if (!confirm(`Supprimer définitivement "${request.animation?.title}" ? Irréversible.`)) return
    approve(request.id, {
      onSuccess: () => toast.success('Animation supprimée.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
    })
  }

  const handleDeny = () => {
    deny(request.id, {
      onSuccess: () => toast.success('Demande refusée.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
    })
  }

  const anim = request.animation

  return (
    <GlassCard className="p-5 border-red-500/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {anim ? (
            <Link to={`/panel/animations/${anim.id}`} className="text-sm font-semibold text-white/90 hover:text-cyan-400 transition-colors">
              {anim.title}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-white/90">Animation inconnue</span>
          )}
          {request.requester && (
            <div className="flex items-center gap-1.5 mt-1">
              <UserAvatar avatarUrl={request.requester.avatar_url} username={request.requester.username} size="xs" />
              <span className="text-xs text-white/40">Demandé par {request.requester.username}</span>
            </div>
          )}
        </div>
        {anim && <StatusBadge status={anim.status} />}
      </div>

      {anim && (
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            {formatDateTime(anim.scheduled_at)}
          </div>
          <ServerBadge server={anim.server} />
          <VillageBadge village={anim.village} />
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
        <Button onClick={handleApprove} disabled={approving || denying} variant="destructive" size="sm" className="flex-1 gap-2">
          <Trash2 className="h-3.5 w-3.5" />
          {approving ? 'Suppression...' : 'Approuver'}
        </Button>
        <Button onClick={handleDeny} disabled={approving || denying} variant="outline" size="sm" className="flex-1 gap-2">
          <X className="h-3.5 w-3.5" />
          {denying ? 'Refus...' : 'Refuser'}
        </Button>
      </div>
    </GlassCard>
  )
}

function TimeCorrectionRequestCard({ request }: { request: TimeCorrectionRequest }) {
  const { mutate: approve, isPending: approving } = useApproveTimeCorrection()
  const { mutate: deny, isPending: denying } = useDenyTimeCorrection()
  const anim = request.animation

  const handleApprove = () => {
    if (!confirm(`Appliquer la correction de temps pour "${anim?.title ?? 'cette animation'}" ?`)) return
    approve(request.id, {
      onSuccess: () => toast.success('Correction de temps appliquée.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
    })
  }

  const handleDeny = () => {
    deny(request.id, {
      onSuccess: () => toast.success('Demande refusée.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
    })
  }

  return (
    <GlassCard className="p-5 border-amber-500/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {anim ? (
            <Link to={`/panel/animations/${anim.id}`} className="text-sm font-semibold text-white/90 hover:text-cyan-400 transition-colors">
              {anim.title}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-white/90">Animation inconnue</span>
          )}
          {request.requester && (
            <div className="flex items-center gap-1.5 mt-1">
              <UserAvatar avatarUrl={request.requester.avatar_url} username={request.requester.username} size="xs" />
              <span className="text-xs text-white/40">Demandé par {request.requester.username}</span>
            </div>
          )}
        </div>
        {anim && <StatusBadge status={anim.status} />}
      </div>

      {anim && (
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            {formatDateTime(anim.scheduled_at)}
          </div>
          <ServerBadge server={anim.server} />
          <VillageBadge village={anim.village} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-white/35 uppercase tracking-wider font-semibold mb-2">Actuel</p>
          <p className="text-white/60">Début : {anim?.started_at ? formatDateTime(anim.started_at) : anim ? formatDateTime(anim.scheduled_at) : '—'}</p>
          <p className="text-white/60">Animation : {formatDuration(anim?.actual_duration_min ?? anim?.planned_duration_min ?? 0)}</p>
          <p className="text-white/60">Préparation : {formatDuration(anim?.actual_prep_time_min ?? anim?.prep_time_min ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
          <p className="text-cyan-300 uppercase tracking-wider font-semibold mb-2">Demandé</p>
          <p className="text-white/75">Début : {formatDateTime(request.requested_started_at)}</p>
          <p className="text-white/75">Animation : {formatDuration(request.requested_actual_duration_min)}</p>
          <p className="text-white/75">Préparation : {formatDuration(request.requested_actual_prep_time_min)}</p>
        </div>
      </div>

      {request.reason && (
        <p className="text-xs text-white/50 mb-3 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
          {request.reason}
        </p>
      )}

      <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
        <Button onClick={handleApprove} disabled={approving || denying} variant="success" size="sm" className="flex-1 gap-2">
          <Check className="h-3.5 w-3.5" />
          {approving ? 'Application...' : 'Approuver'}
        </Button>
        <Button onClick={handleDeny} disabled={approving || denying} variant="outline" size="sm" className="flex-1 gap-2">
          <X className="h-3.5 w-3.5" />
          {denying ? 'Refus...' : 'Refuser'}
        </Button>
      </div>
    </GlassCard>
  )
}

export default function Validation() {
  const { permissionRoles } = useRequiredAuth()
  const canManageFullValidation = hasPermissionRole(permissionRoles, 'responsable')
  const [tab, setTab] = useState<'pending' | 'open' | 'rejected' | 'deletion' | 'time'>('pending')

  const statusMap: Record<'pending' | 'open' | 'rejected', AnimationStatus> = {
    pending: 'pending_validation',
    open: 'open',
    rejected: 'rejected',
  }

  const { data, isLoading } = useAnimations(
    tab !== 'deletion' && tab !== 'time' ? { status: statusMap[tab as 'pending' | 'open' | 'rejected'] } : {},
  )
  const { data: deletionData, isLoading: deletionLoading } = useDeletionRequests(canManageFullValidation)
  const { data: timeCorrectionData, isLoading: timeCorrectionLoading } = useTimeCorrectionRequests(canManageFullValidation)

  const animations = tab !== 'deletion' && tab !== 'time' ? (data?.animations ?? []) : []
  const visibleAnimations = canManageFullValidation
    ? animations
    : animations.filter(isPastMissionForSeniorValidation)
  const deletionRequests = deletionData?.requests ?? []
  const timeCorrectionRequests = timeCorrectionData?.requests ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Validation</h1>
        <p className="text-sm text-white/40 mt-0.5">Gestion des animations en attente</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          {canManageFullValidation && (
            <>
              <TabsTrigger value="open">Validées récemment</TabsTrigger>
              <TabsTrigger value="rejected">Refusées</TabsTrigger>
              <TabsTrigger value="deletion" className="relative">
                Supp. demandées
                {deletionRequests.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 leading-none">
                    {deletionRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="time" className="relative">
                Temps
                {timeCorrectionRequests.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.5 leading-none">
                    {timeCorrectionRequests.length}
                  </span>
                )}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {(canManageFullValidation ? (['pending', 'open', 'rejected'] as const) : (['pending'] as const)).map((t) => (
          <TabsContent key={t} value={t}>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : visibleAnimations.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <p className="text-white/30 text-sm">
                  {canManageFullValidation ? 'Aucune animation' : 'Aucune mission passée à valider'}
                </p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleAnimations.map((a) => (
                  <ValidationCard key={a.id} animation={a} canReject={canManageFullValidation} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        {canManageFullValidation && (
          <TabsContent value="deletion">
            {deletionLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : deletionRequests.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <p className="text-white/30 text-sm">Aucune demande de suppression</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deletionRequests.map((r) => <DeletionRequestCard key={r.id} request={r} />)}
              </div>
            )}
          </TabsContent>
        )}

        {canManageFullValidation && (
          <TabsContent value="time">
            {timeCorrectionLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-56" />)}
              </div>
            ) : timeCorrectionRequests.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <p className="text-white/30 text-sm">Aucune demande de correction de temps</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {timeCorrectionRequests.map((request) => (
                  <TimeCorrectionRequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
