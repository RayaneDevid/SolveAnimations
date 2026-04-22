import { useState } from 'react'
import { Link } from 'react-router'
import { Check, X, ExternalLink, Calendar, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAnimations } from '@/hooks/queries/useAnimations'
import { useValidateAnimation, useRejectAnimation } from '@/hooks/mutations/useAnimationMutations'
import type { AnimationStatus } from '@/types/database'
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

function ValidationCard({ animation }: { animation: Animation }) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const { mutateAsync: validate, isPending: validating } = useValidateAnimation()

  const handleValidate = async () => {
    try {
      await validate(animation.id)
      toast.success('Animation validée !')
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
            {formatDuration(animation.planned_duration_min)}
          </div>
          <ServerBadge server={animation.server} />
          <VillageBadge village={animation.village} />
        </div>

        {animation.document_url && (
          <a
            href={animation.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mb-3"
          >
            <ExternalLink className="h-3 w-3" />
            Voir le document
          </a>
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
            <Button
              onClick={() => setRejectOpen(true)}
              variant="destructive"
              size="sm"
              className="flex-1 gap-2"
            >
              <X className="h-3.5 w-3.5" />
              Refuser
            </Button>
          </div>
        )}
      </GlassCard>
      <RejectModal animation={animation} open={rejectOpen} onClose={() => setRejectOpen(false)} />
    </>
  )
}

export default function Validation() {
  const [tab, setTab] = useState<'pending' | 'open' | 'rejected'>('pending')

  const statusMap: Record<typeof tab, AnimationStatus> = {
    pending: 'pending_validation',
    open: 'open',
    rejected: 'rejected',
  }

  const { data, isLoading } = useAnimations({ status: statusMap[tab] })
  const animations = data?.animations ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Validation</h1>
        <p className="text-sm text-white/40 mt-0.5">Gestion des animations en attente</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="open">Validées récemment</TabsTrigger>
          <TabsTrigger value="rejected">Refusées</TabsTrigger>
        </TabsList>

        {(['pending', 'open', 'rejected'] as const).map((t) => (
          <TabsContent key={t} value={t}>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : animations.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <p className="text-white/30 text-sm">Aucune animation</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {animations.map((a) => <ValidationCard key={a.id} animation={a} />)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
