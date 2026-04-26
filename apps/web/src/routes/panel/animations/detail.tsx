import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft, Play, Square, Clock, Users, Calendar,
  Check, X, UserPlus, Pencil, Ban, Timer, LogOut, UserMinus, Hourglass, Save, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAnimation, useMembers } from '@/hooks/queries/useAnimations'
import {
  useStartAnimation, useStartPrepAnimation, useStopPrepAnimation,
  useStopAnimation, useCancelAnimation, useDeleteAnimation,
  useRequestDeletion,
  useApplyParticipant, useDecideParticipant, useRemoveParticipant,
  useCorrectFinishedAnimation, useAddParticipantToFinished,
} from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { AnimationChat } from '@/components/animations/AnimationChat'
import { RpDateTimePicker } from '@/components/animations/RpDateTimePicker'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { GenderIcon } from '@/components/shared/GenderIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime, formatDuration, formatTime } from '@/lib/utils/format'
import { hasRole } from '@/lib/config/discord'
import { VILLAGES, SERVERS, TYPES } from '@/lib/schemas/animation'
import type { AnimationParticipant, Animation } from '@/types/database'

function FinishedEditForm({ animation }: { animation: Animation }) {
  const { mutateAsync: correct, isPending } = useCorrectFinishedAnimation()
  const [editing, setEditing] = useState(false)
  const [animMin, setAnimMin] = useState(animation.actual_duration_min ?? 0)
  const [prepMin, setPrepMin] = useState(animation.actual_prep_time_min ?? 0)
  const [village, setVillage] = useState(animation.village)
  const [server, setServer] = useState(animation.server)
  const [type, setType] = useState(animation.type)
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(
    animation.scheduled_at ? new Date(animation.scheduled_at) : undefined,
  )

  const handleSave = async () => {
    try {
      await correct({
        id: animation.id,
        actual_duration_min: animMin,
        actual_prep_time_min: animation.prep_time_min > 0 ? prepMin : undefined,
        village,
        server,
        type,
        scheduled_at: scheduledAt?.toISOString(),
      })
      toast.success('Animation corrigée')
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const inputCls = 'w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50'
  const labelCls = 'text-xs text-white/40 mb-1 block'

  return (
    <GlassCard className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          Durée réelle
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Corriger
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <div>
            <p className="text-xs text-white/40 mb-0.5">Animation</p>
            <p className="text-2xl font-bold text-white">
              {formatDuration(animation.actual_duration_min ?? 0)}
            </p>
          </div>
          {animation.actual_prep_time_min != null && (
            <div>
              <p className="text-xs text-white/40 mb-0.5">Débrief</p>
              <p className="text-lg font-semibold text-white/70">
                {formatDuration(animation.actual_prep_time_min)}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Date et heure de session</label>
            <RpDateTimePicker value={scheduledAt} onChange={setScheduledAt} />
          </div>
          <div>
            <label className={labelCls}>Durée animation (min)</label>
            <input
              type="number"
              min={0}
              value={animMin}
              onChange={(e) => setAnimMin(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          {animation.prep_time_min > 0 && (
            <div>
              <label className={labelCls}>Durée débrief (min)</label>
              <input
                type="number"
                min={0}
                value={prepMin}
                onChange={(e) => setPrepMin(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Village</label>
            <select value={village} onChange={(e) => setVillage(e.target.value as typeof VILLAGES[number])} className={inputCls}>
              {VILLAGES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Serveur</label>
            <select value={server} onChange={(e) => setServer(e.target.value as typeof SERVERS[number])} className={inputCls}>
              {SERVERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof TYPES[number])} className={inputCls}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} disabled={isPending} className="flex-1 gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

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
  canRemove,
  isSelf,
  animationId,
}: {
  p: AnimationParticipant
  canDecide: boolean
  canRemove: boolean
  isSelf: boolean
  animationId: string
}) {
  const { mutateAsync: decide, isPending: deciding } = useDecideParticipant()
  const { mutateAsync: remove, isPending: removing } = useRemoveParticipant()

  const handleDecide = async (decision: 'validated' | 'rejected') => {
    try {
      await decide({ participantId: p.id, decision, animationId })
    } catch {
      toast.error('Erreur')
    }
  }

  const handleRemove = async () => {
    const msg = isSelf
      ? 'Te retirer de cette animation ?'
      : `Retirer ${p.user?.username ?? 'ce participant'} de l'animation ?`
    if (!confirm(msg)) return
    try {
      await remove({ participantId: p.id, animationId })
      toast.success(isSelf ? 'Tu t\'es retiré de l\'animation' : 'Participant retiré')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <UserAvatar avatarUrl={p.user?.avatar_url} username={p.user?.username ?? '?'} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-white/90 truncate">{p.user?.username}</p>
          <GenderIcon gender={p.user?.gender} />
        </div>
        {p.character_name && (
          <p className="text-xs text-white/40 truncate">Perso: {p.character_name}</p>
        )}
      </div>
      {p.user?.role && <RoleBadge role={p.user.role} size="sm" />}
      {canDecide && p.status === 'pending' && (
        <div className="flex gap-1.5">
          <button
            onClick={() => handleDecide('validated')}
            disabled={deciding}
            className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDecide('rejected')}
            disabled={deciding}
            className="h-7 w-7 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {canRemove && p.status === 'validated' && (
        <button
          onClick={handleRemove}
          disabled={removing}
          title={isSelf ? 'Me retirer' : 'Retirer ce participant'}
          className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center disabled:opacity-50"
        >
          {isSelf ? <LogOut className="h-3.5 w-3.5" /> : <UserMinus className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

function AddParticipantToFinishedDialog({ animationId, existingUserIds, open, onClose }: {
  animationId: string
  existingUserIds: string[]
  open: boolean
  onClose: () => void
}) {
  const { data: members = [], isLoading } = useMembers()
  const { mutateAsync: addParticipant, isPending } = useAddParticipantToFinished()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const filtered = members.filter(
    (m) => !existingUserIds.includes(m.id) &&
      m.username.toLowerCase().includes(search.toLowerCase()),
  )

  const toggle = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedIds.size === 0) return
    try {
      const { added } = await addParticipant({ animationId, userIds: [...selectedIds] })
      toast.success(`${added} participant${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`)
      onClose()
      setSelectedIds(new Set())
      setSearch('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0F1014] border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Ajouter des participants</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Membres</Label>
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-52 overflow-y-auto rounded-lg border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.05]">
              {isLoading ? (
                <p className="text-xs text-white/40 p-3">Chargement...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-white/40 p-3">Aucun membre disponible</p>
              ) : filtered.map((m) => {
                const checked = selectedIds.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      checked ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                      checked ? 'bg-cyan-500/30 border-cyan-500/60' : 'border-white/20 bg-white/[0.04]'
                    }`}>
                      {checked && (
                        <svg className="h-2.5 w-2.5 text-cyan-400" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-white/90 flex-1">{m.username}</span>
                    <span className="text-xs text-white/40">{m.role}</span>
                  </button>
                )
              })}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs text-cyan-400">{selectedIds.size} membre{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isPending || selectedIds.size === 0}>
              {isPending ? 'Ajout...' : `Ajouter${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AnimationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, role } = useRequiredAuth()
  const [addParticipantOpen, setAddParticipantOpen] = useState(false)

  const { data, isLoading } = useAnimation(id!)
  const { mutateAsync: start, isPending: starting } = useStartAnimation()
  const { mutateAsync: startPrep, isPending: startingPrep } = useStartPrepAnimation()
  const { mutateAsync: stopPrep, isPending: stoppingPrep } = useStopPrepAnimation()
  const { mutateAsync: stop, isPending: stopping } = useStopAnimation()
  const { mutateAsync: cancel, isPending: cancelling } = useCancelAnimation()
  const { mutate: deleteAnim, isPending: deleting } = useDeleteAnimation()
  const { mutate: requestDeletion, isPending: requestingDeletion } = useRequestDeletion()
  const { mutateAsync: apply, isPending: applying } = useApplyParticipant()

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!data) return null

  const { animation, participants, deletionRequest } = data
  const isCreator = animation.creator_id === user.id
  const isResponsable = hasRole(role, 'responsable')
  const isParticipant = participants.some(
    (p) => p.user_id === user.id && (p.status === 'pending' || p.status === 'validated'),
  )

  const validated = participants.filter((p) => p.status === 'validated')
  const pending = participants.filter((p) => p.status === 'pending')
  const participantProgress = Math.min(100, (validated.length / animation.required_participants) * 100)

  const handleStartPrep = async () => {
    try {
      await startPrep(animation.id)
      toast.success('Débrief démarré !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleStopPrep = async () => {
    try {
      await stopPrep(animation.id)
      toast.success('Débrief terminé ! Lance maintenant l\'animation.')
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

  const handleDelete = () => {
    if (!confirm(`Supprimer définitivement "${animation.title}" ? Cette action est irréversible.`)) return
    deleteAnim(animation.id, {
      onSuccess: () => {
        toast.success('Animation supprimée.')
        navigate('/panel/animations')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
    })
  }

  const handleRequestDeletion = () => {
    if (!confirm(`Demander la suppression de "${animation.title}" ? Un responsable devra valider.`)) return
    requestDeletion(animation.id, {
      onSuccess: () => toast.success('Demande de suppression envoyée aux responsables.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
    })
  }

  const handleApply = async () => {
    try {
      await apply({ animationId: animation.id })
      toast.success('Tu es inscrit à cette animation !')
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

      {/* Pending validation banner */}
      {animation.status === 'pending_validation' && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <Hourglass className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">En cours de validation</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Cette animation est en attente de validation par un Responsable avant d'être ouverte aux inscriptions.
            </p>
          </div>
        </div>
      )}

      {/* Meta bar */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Calendar className="h-4 w-4 text-cyan-400" />
            {animation.prep_time_min > 0 ? (
              <span>
                <span className="text-white/40">Débrief </span>
                {formatTime(new Date(new Date(animation.scheduled_at).getTime() - animation.prep_time_min * 60_000).toISOString())}
                <span className="text-white/30 mx-1">·</span>
                <span className="text-white/40">Animation </span>
                {formatTime(animation.scheduled_at)}
              </span>
            ) : (
              formatDateTime(animation.scheduled_at)
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Clock className="h-4 w-4 text-violet-400" />
            {formatDuration(animation.planned_duration_min)}
            {animation.prep_time_min > 0 && ` · Débrief ${formatDuration(animation.prep_time_min)}`}
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
                {validated.map((p) => {
                  const isSelf = p.user_id === user.id
                  const canRemove =
                    ['open', 'preparing'].includes(animation.status) && (isCreator || isSelf)
                  return (
                    <ParticipantRow
                      key={p.id}
                      p={p}
                      canDecide={isCreator && ['open', 'preparing'].includes(animation.status)}
                      canRemove={canRemove}
                      isSelf={isSelf}
                      animationId={animation.id}
                    />
                  )
                })}
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
                    canRemove={false}
                    isSelf={p.user_id === user.id}
                    animationId={animation.id}
                  />
                ))}
              </div>
            </GlassCard>
          )}

          {/* Apply CTA */}
          {['pending_validation', 'open', 'preparing', 'running'].includes(animation.status) && !isCreator && !isParticipant && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white/80">Se proposer</h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Rejoins cette animation en tant que participant
                  </p>
                </div>
                <Button onClick={handleApply} disabled={applying} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  {applying ? 'Envoi...' : 'S\'inscrire'}
                </Button>
              </div>
            </GlassCard>
          )}

          {/* Add participant (responsable, finished only) */}
          {isResponsable && animation.status === 'finished' && (
            <>
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white/80">Ajouter un participant</h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      Ajouter un membre présent non inscrit
                    </p>
                  </div>
                  <Button onClick={() => setAddParticipantOpen(true)} className="gap-2" variant="secondary">
                    <UserPlus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
              </GlassCard>
              <AddParticipantToFinishedDialog
                animationId={animation.id}
                existingUserIds={participants.filter((p) => p.status === 'validated').map((p) => p.user_id)}
                open={addParticipantOpen}
                onClose={() => setAddParticipantOpen(false)}
              />
            </>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {(isCreator || isResponsable) && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
                Contrôle
              </h2>
              <div className="space-y-4">

                {/* ── Débrief (indépendant) ── */}
                {isCreator && animation.prep_time_min > 0 && ['open', 'preparing'].includes(animation.status) && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Débrief</p>
                    {!animation.prep_started_at && (
                      <Button onClick={handleStartPrep} disabled={startingPrep} variant="secondary" className="w-full gap-2">
                        <Timer className="h-4 w-4" />
                        Démarrer le débrief
                      </Button>
                    )}
                    {animation.prep_started_at && !animation.prep_ended_at && (
                      <>
                        <ElapsedTimer since={animation.prep_started_at} label="Débrief en cours" />
                        <Button onClick={handleStopPrep} disabled={stoppingPrep} variant="secondary" className="w-full gap-2">
                          <Square className="h-4 w-4" />
                          Arrêter le débrief
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ── Animation (indépendant) ── */}
                {(isCreator || isResponsable) && (
                  <div className="space-y-2">
                    {isCreator && animation.prep_time_min > 0 && ['open', 'preparing'].includes(animation.status) && (
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Animation</p>
                    )}
                    {isCreator && ['open', 'preparing'].includes(animation.status) && (
                      <Button onClick={handleStart} disabled={starting} className="w-full gap-2">
                        <Play className="h-4 w-4" />
                        Démarrer l'animation
                      </Button>
                    )}
                    {animation.status === 'running' && (
                      <>
                        <ElapsedTimer since={animation.started_at!} label="Animation en cours" />
                        <Button onClick={handleStop} disabled={stopping} variant="secondary" className="w-full gap-2">
                          <Square className="h-4 w-4" />
                          Terminer l'animation
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ── Actions secondaires ── */}
                {(isCreator || isResponsable) && ['open', 'pending_validation', 'preparing', ...(isResponsable ? ['running'] : [])].includes(animation.status) && (
                  <div className="pt-3 border-t border-white/[0.06] space-y-2">
                    <Button onClick={handleCancel} disabled={cancelling} variant="destructive" className="w-full gap-2">
                      <Ban className="h-4 w-4" />
                      Annuler
                    </Button>
                    {animation.status === 'open' && isCreator && (
                      <Link to={`/panel/animations/${animation.id}/edit`} className="block mt-2">
                        <Button variant="outline" className="w-full gap-2">
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </Button>
                      </Link>
                    )}
                  </div>
                )}

                {/* ── Suppression (responsable) ── */}
                {isResponsable && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <Button onClick={handleDelete} disabled={deleting} variant="destructive" className="w-full gap-2 opacity-70 hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                      {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                    </Button>
                  </div>
                )}

                {/* ── Demande de suppression (créateur) ── */}
                {isCreator && !isResponsable && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    {['cancelled', 'rejected'].includes(animation.status) ? (
                      <Button onClick={handleDelete} disabled={deleting} variant="destructive" className="w-full gap-2 opacity-70 hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                        {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                      </Button>
                    ) : deletionRequest ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Hourglass className="h-4 w-4 text-amber-400 shrink-0" />
                        <p className="text-xs text-amber-300">Demande de suppression en attente de validation</p>
                      </div>
                    ) : (
                      <Button onClick={handleRequestDeletion} disabled={requestingDeletion} variant="destructive" className="w-full gap-2 opacity-70 hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                        {requestingDeletion ? 'Envoi...' : 'Demander la suppression'}
                      </Button>
                    )}
                  </div>
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

          {animation.status === 'finished' && (
            isResponsable ? (
              <FinishedEditForm animation={animation} />
            ) : animation.actual_duration_min ? (
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
                    <p className="text-xs text-white/40 mb-0.5">Débrief</p>
                    <p className="text-lg font-semibold text-white/70">
                      {formatDuration(animation.actual_prep_time_min)}
                    </p>
                  </div>
                )}
              </GlassCard>
            ) : null
          )}
        </div>
      </div>

      {/* Chat */}
      <AnimationChat animationId={animation.id} currentUserId={user.id} />

    </div>
  )
}
