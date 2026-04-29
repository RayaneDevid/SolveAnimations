import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Ticket, Plus, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronRight, X, Check, AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRequetes } from '@/hooks/queries/useAnimations'
import { useCreateRequete, useDecideRequete } from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import type { Requete, RequeteSubject, RequeteDestination } from '@/types/database'
import { hasOwnedRole, type StaffRoleKey } from '@/lib/config/discord'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUBJECTS: Record<RequeteSubject, string> = {
  grade_superieur_tkj: 'Autorisation grade supérieur à TKJ (perso Animation)',
  demande_give: 'Demande de give pour un perso Animation',
  setmodel_tenue: 'Autorisation setmodel / port de tenue "sous autorisation"',
  reservation_secteur: "Demande de réservation d'un secteur event",
  situation_problematique: 'Situation problématique avec un joueur',
  autres: 'Autres',
}

const DESTINATIONS: Record<RequeteDestination, { label: string; color: string; bg: string; border: string }> = {
  ra: {
    label: 'Responsables Animation',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20',
  },
  rmj: {
    label: 'Responsables MJ',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
  },
}

const CREATOR_ROLES = ['animateur', 'mj', 'senior', 'mj_senior', 'responsable', 'responsable_mj', 'responsable_bdm', 'bdm', 'direction', 'gerance']
const DECIDER_ROLES = ['responsable', 'responsable_mj', 'direction', 'gerance']

// ─── Zod schema ───────────────────────────────────────────────────────────────

const createRequeteSchema = z.object({
  subject: z.enum([
    'grade_superieur_tkj', 'demande_give', 'setmodel_tenue',
    'reservation_secteur', 'situation_problematique', 'autres',
  ]),
  destination: z.enum(['ra', 'rmj']),
  description: z.string().trim().min(10, 'Décrivez votre demande (min 10 caractères)').max(2000),
})

type CreateRequeteValues = z.infer<typeof createRequeteSchema>

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Requete['status'] }) {
  const cfg = {
    pending: { icon: Clock, label: 'En attente', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    accepted: { icon: CheckCircle2, label: 'Acceptée', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    refused: { icon: XCircle, label: 'Refusée', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  }[status]
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 border', cfg.cls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function DestBadge({ destination }: { destination: RequeteDestination }) {
  const d = DESTINATIONS[destination]
  return (
    <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5 border', d.color, d.bg, d.border)}>
      {d.label}
    </span>
  )
}

// ─── Ticket row ───────────────────────────────────────────────────────────────

function RequeteRow({ requete, onClick }: { requete: Requete; onClick: () => void }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all group"
    >
      {/* Status dot */}
      <div className={cn('h-2 w-2 rounded-full shrink-0', {
        'bg-amber-400 animate-pulse': requete.status === 'pending',
        'bg-emerald-400': requete.status === 'accepted',
        'bg-red-400': requete.status === 'refused',
      })} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate group-hover:text-white/95 transition-colors">
          {SUBJECTS[requete.subject]}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <DestBadge destination={requete.destination} />
          {requete.creator && (
            <div className="flex items-center gap-1">
              <UserAvatar avatarUrl={requete.creator.avatar_url} username={requete.creator.username} size="xs" />
              <span className="text-xs text-white/30">{requete.creator.username}</span>
            </div>
          )}
          <span className="text-xs text-white/25">
            {formatDistanceToNow(new Date(requete.created_at), { locale: fr, addSuffix: true })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={requete.status} />
        <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
      </div>
    </motion.button>
  )
}

// ─── Ticket detail modal ──────────────────────────────────────────────────────

function RequeteModal({
  requete,
  canDecide,
  onClose,
}: {
  requete: Requete
  canDecide: boolean
  onClose: () => void
}) {
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')
  const { mutateAsync: decide, isPending } = useDecideRequete()

  const isPending_ = requete.status === 'pending'
  const canAct = canDecide && isPending_

  const handleAccept = async () => {
    try {
      await decide({ id: requete.id, decision: 'accepted' })
      toast.success('Requête acceptée')
      onClose()
    } catch {
      toast.error('Erreur lors de la décision')
    }
  }

  const handleRefuse = async () => {
    if (reason.trim().length < 5) {
      toast.error('Veuillez indiquer une raison (min 5 caractères)')
      return
    }
    try {
      await decide({ id: requete.id, decision: 'refused', reason })
      toast.success('Requête refusée')
      onClose()
    } catch {
      toast.error('Erreur lors de la décision')
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0D0E14] border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <DialogTitle className="text-base font-semibold text-white leading-snug flex-1">
              {SUBJECTS[requete.subject]}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusBadge status={requete.status} />
            <DestBadge destination={requete.destination} />
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Creator */}
          {requete.creator && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <UserAvatar avatarUrl={requete.creator.avatar_url} username={requete.creator.username} size="sm" />
              <div>
                <p className="text-sm font-medium text-white/80">{requete.creator.username}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={requete.creator.role as StaffRoleKey} />
                  <span className="text-xs text-white/30">
                    {format(new Date(requete.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Détail de la demande</p>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {requete.description}
              </p>
            </div>
          </div>

          {/* Decision section */}
          {requete.status !== 'pending' && (
            <div className={cn(
              'p-4 rounded-xl border',
              requete.status === 'accepted'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-red-500/5 border-red-500/20',
            )}>
              <div className="flex items-center gap-2 mb-2">
                {requete.status === 'accepted' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <p className={cn('text-sm font-semibold', requete.status === 'accepted' ? 'text-emerald-400' : 'text-red-400')}>
                  {requete.status === 'accepted' ? 'Requête acceptée' : 'Requête refusée'}
                </p>
              </div>
              {requete.decider && (
                <p className="text-xs text-white/40 mb-1">
                  par <span className="text-white/60">{requete.decider.username}</span>
                  {requete.decided_at && (
                    <> · {format(new Date(requete.decided_at), 'd MMM yyyy à HH:mm', { locale: fr })}</>
                  )}
                </p>
              )}
              {requete.decision_reason && (
                <p className="text-sm text-white/70 mt-2 italic">"{requete.decision_reason}"</p>
              )}
            </div>
          )}

          {/* RA/RMJ action panel */}
          {canAct && (
            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Votre décision</p>

              {!refusing ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    variant="ghost"
                    onClick={handleAccept}
                    disabled={isPending}
                  >
                    <Check className="h-4 w-4" />
                    Accepter
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                    variant="ghost"
                    onClick={() => setRefusing(true)}
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                    Refuser
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/50">
                      Raison du refus <span className="text-red-400">*</span>
                    </Label>
                    <Textarea
                      placeholder="Expliquez la raison du refus..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setRefusing(false)} disabled={isPending} className="flex-1">
                      Retour
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRefuse}
                      disabled={isPending}
                      className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                      variant="ghost"
                    >
                      {isPending ? 'Envoi...' : 'Confirmer le refus'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateRequeteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutateAsync, isPending } = useCreateRequete()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateRequeteValues>({
    resolver: zodResolver(createRequeteSchema),
  })

  const subject = watch('subject')
  const destination = watch('destination')

  const handleClose = () => { reset(); onClose() }

  const onSubmit = async (data: CreateRequeteValues) => {
    try {
      await mutateAsync(data)
      toast.success('Requête envoyée !')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg bg-[#0D0E14] border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Ticket className="h-4 w-4 text-amber-400" />
            Nouvelle requête
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label>Sujet</Label>
            <div className="space-y-1.5">
              {(Object.entries(SUBJECTS) as [RequeteSubject, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setValue('subject', key, { shouldValidate: true })}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-all',
                    subject === key
                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/[0.14] hover:text-white/80',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.subject && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Veuillez sélectionner un sujet
              </p>
            )}
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <Label>Destinataires</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(DESTINATIONS) as [RequeteDestination, typeof DESTINATIONS.ra][]).map(([key, d]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setValue('destination', key, { shouldValidate: true })}
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-sm border transition-all text-center',
                    destination === key
                      ? `${d.bg} ${d.border} ${d.color}`
                      : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/[0.14]',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {errors.destination && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Veuillez sélectionner les destinataires
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">
              Détaillez votre demande <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Expliquez votre demande en détail : contexte, raison, informations utiles..."
              rows={5}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4" />
              {isPending ? 'Envoi...' : 'Envoyer la requête'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <AlertCircle className="h-8 w-8 text-white/15 mb-1" />
      <p className="text-sm text-white/30">{label}</p>
    </div>
  )
}

// ─── Requetes list ────────────────────────────────────────────────────────────

function RequeteList({
  requetes,
  canDecide,
}: {
  requetes: Requete[]
  canDecide: boolean
}) {
  const [selected, setSelected] = useState<Requete | null>(null)

  if (requetes.length === 0) return <EmptyState label="Aucune requête" />

  return (
    <>
      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden p-1">
        <AnimatePresence mode="popLayout">
          {requetes.map((r) => (
            <RequeteRow key={r.id} requete={r} onClick={() => setSelected(r)} />
          ))}
        </AnimatePresence>
      </GlassCard>

      {selected && (
        <RequeteModal
          requete={selected}
          canDecide={canDecide}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Requetes() {
  const { permissionRoles } = useRequiredAuth()
  const { data, isLoading } = useRequetes()
  const [createOpen, setCreateOpen] = useState(false)

  const canCreate = hasOwnedRole(permissionRoles, CREATOR_ROLES as StaffRoleKey[])
  const canDecide = hasOwnedRole(permissionRoles, DECIDER_ROLES as StaffRoleKey[])

  const mine = data?.mine ?? []
  const incoming = data?.incoming ?? []
  const pendingCount = incoming.filter((r) => r.status === 'pending').length

  const defaultTab = canDecide && pendingCount > 0 ? 'incoming' : 'mine'

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Ticket className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Requêtes</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {canDecide
                ? `${pendingCount} en attente de décision`
                : mine.length > 0
                ? `${mine.length} requête${mine.length > 1 ? 's' : ''} envoyée${mine.length > 1 ? 's' : ''}`
                : 'Envoyez une requête aux responsables'}
            </p>
          </div>
        </div>

        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle requête
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <GlassCard className="p-1 space-y-1">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </GlassCard>
      ) : canDecide ? (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="mine">
              Mes requêtes {mine.length > 0 && `(${mine.length})`}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2">
              À traiter
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-4.5 min-w-[1.25rem] px-1 rounded-full bg-amber-400/20 text-amber-400 text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            {mine.length === 0
              ? <EmptyState label="Vous n'avez envoyé aucune requête" />
              : <RequeteList requetes={mine} canDecide={false} />
            }
          </TabsContent>

          <TabsContent value="incoming" className="mt-4">
            <RequeteList requetes={incoming} canDecide={canDecide} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-2">
          {mine.length === 0
            ? <EmptyState label="Vous n'avez envoyé aucune requête" />
            : <RequeteList requetes={mine} canDecide={false} />
          }
        </div>
      )}

      <CreateRequeteDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
