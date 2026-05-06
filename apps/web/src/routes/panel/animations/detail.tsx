import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft, Play, Square, Clock, Users, Calendar,
  Check, X, UserPlus, Pencil, Ban, Timer, LogOut, UserMinus, Hourglass, Save, Trash2, Send,
  Lock, Unlock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAnimation, useMembers } from '@/hooks/queries/useAnimations'
import {
  useStartAnimation, useStartPrepAnimation, useStopPrepAnimation,
  useStopAnimation, useCancelAnimation, useDeleteAnimation,
  useRequestDeletion,
  useApplyParticipant, useDecideParticipant, useRemoveParticipant,
  useCorrectFinishedAnimation, useAddParticipantToFinished, useRequestTimeCorrection,
  useSetRegistrationsLocked,
} from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { AnimationChat } from '@/components/animations/AnimationChat'
import { RpDateTimePicker } from '@/components/animations/RpDateTimePicker'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge, VILLAGE_LABELS } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { GenderIcon } from '@/components/shared/GenderIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime, formatDuration, formatTime } from '@/lib/utils/format'
import { hasOwnedRole, hasPermissionRole } from '@/lib/config/discord'
import { BDM_MISSION_RANKS, BDM_MISSION_TYPES, VILLAGES, SERVERS, TYPES, type BdmMissionRank, type BdmMissionType } from '@/lib/schemas/animation'
import type { AnimationParticipant, Animation, TimeCorrectionRequest } from '@/types/database'

const BDM_TYPE_LABELS = {
  jetable: 'Jetable',
  elaboree: 'Élaborée',
  grande_ampleur: 'Grande ampleur',
} as const

function FinishedEditForm({
  animation,
  canEditTiming,
  canEditBdm,
}: {
  animation: Animation
  canEditTiming: boolean
  canEditBdm: boolean
}) {
  const { mutateAsync: correct, isPending } = useCorrectFinishedAnimation()
  const [editing, setEditing] = useState(false)
  const [animMin, setAnimMin] = useState(animation.actual_duration_min ?? 0)
  const [prepMin, setPrepMin] = useState(animation.actual_prep_time_min ?? 0)
  const [village, setVillage] = useState(animation.village)
  const [server, setServer] = useState(animation.server)
  const [type, setType] = useState((animation.type as string) === 'petite' ? 'moyenne' : animation.type)
  const [bdmMission, setBdmMission] = useState(animation.bdm_mission)
  const [bdmRank, setBdmRank] = useState(animation.bdm_mission_rank)
  const [bdmType, setBdmType] = useState(animation.bdm_mission_type)
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(
    animation.scheduled_at ? new Date(animation.scheduled_at) : undefined,
  )

  const handleSave = async () => {
    try {
      await correct({
        id: animation.id,
        ...(canEditTiming ? {
          actual_duration_min: animMin,
          actual_prep_time_min: animation.prep_time_min > 0 ? prepMin : undefined,
          village,
          server,
          type,
          scheduled_at: scheduledAt?.toISOString(),
        } : {}),
        ...(canEditBdm ? {
          bdm_mission: bdmMission,
          ...(bdmMission ? {
            bdm_mission_rank: bdmRank,
            bdm_mission_type: bdmType,
          } : {}),
        } : {}),
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
          {animation.bdm_mission && (
            <div>
              <p className="text-xs text-white/40 mb-0.5">Mission BDM</p>
              <p className="text-sm font-semibold text-white/70">
                Rang {animation.bdm_mission_rank} · {BDM_TYPE_LABELS[animation.bdm_mission_type]}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {canEditTiming && (
            <>
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
                  {VILLAGES.map((v) => <option key={v} value={v}>{VILLAGE_LABELS[v]}</option>)}
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
            </>
          )}

          {canEditBdm && (
            <div>
              <label className={labelCls}>Nature</label>
              <select value={bdmMission ? 'mission_bdm' : 'animation'} onChange={(e) => setBdmMission(e.target.value === 'mission_bdm')} className={inputCls}>
                <option value="animation">Animation</option>
                <option value="mission_bdm">Mission BDM</option>
              </select>
            </div>
          )}

          {bdmMission && canEditBdm && (
            <div>
              <label className={labelCls}>Rang BDM</label>
              <select value={bdmRank} onChange={(e) => setBdmRank(e.target.value as BdmMissionRank)} className={inputCls}>
                {BDM_MISSION_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
              </select>
            </div>
          )}
          {bdmMission && canEditBdm && (
            <div>
              <label className={labelCls}>Type BDM</label>
              <select value={bdmType} onChange={(e) => setBdmType(e.target.value as BdmMissionType)} className={inputCls}>
                {BDM_MISSION_TYPES.map((missionType) => (
                  <option key={missionType} value={missionType}>{BDM_TYPE_LABELS[missionType]}</option>
                ))}
              </select>
            </div>
          )}
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

function TimeCorrectionRequestDialog({
  animation,
  open,
  onClose,
}: {
  animation: Animation
  open: boolean
  onClose: () => void
}) {
  const { mutateAsync, isPending } = useRequestTimeCorrection()
  const defaultStartedAt = animation.started_at ?? animation.scheduled_at
  const [startedAt, setStartedAt] = useState<Date | undefined>(() => new Date(defaultStartedAt))
  const [durationMin, setDurationMin] = useState(animation.actual_duration_min ?? animation.planned_duration_min)
  const [prepMin, setPrepMin] = useState(animation.actual_prep_time_min ?? animation.prep_time_min ?? 0)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setStartedAt(new Date(defaultStartedAt))
    setDurationMin(animation.actual_duration_min ?? animation.planned_duration_min)
    setPrepMin(animation.actual_prep_time_min ?? animation.prep_time_min ?? 0)
    setReason('')
  }, [animation.actual_duration_min, animation.actual_prep_time_min, animation.planned_duration_min, animation.prep_time_min, defaultStartedAt, open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!startedAt || Number.isNaN(startedAt.getTime())) {
      toast.error('Date de début invalide')
      return
    }
    if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 720) {
      toast.error('Durée animation invalide')
      return
    }
    if (!Number.isInteger(prepMin) || prepMin < 0 || prepMin > 600) {
      toast.error('Durée de préparation invalide')
      return
    }

    try {
      await mutateAsync({
        animationId: animation.id,
        requestedStartedAt: startedAt.toISOString(),
        requestedActualDurationMin: durationMin,
        requestedActualPrepTimeMin: prepMin,
        reason: reason.trim() || undefined,
      })
      toast.success('Demande de correction envoyée aux responsables.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="bg-[#0F1014] border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Demander une correction de temps</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Début réel</Label>
            <RpDateTimePicker value={startedAt} onChange={setStartedAt} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Animation (min)</Label>
              <Input
                type="number"
                min={1}
                max={720}
                value={durationMin}
                onChange={(event) => setDurationMin(Number(event.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Préparation (min)</Label>
              <Input
                type="number"
                min={0}
                max={600}
                value={prepMin}
                onChange={(event) => setPrepMin(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motif</Label>
            <Textarea
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex: chrono lancé trop tard, arrêt oublié..."
            />
            <p className="text-xs text-white/30 text-right">{reason.length}/500</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              <Send className="h-3.5 w-3.5" />
              {isPending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TimeCorrectionRequestPanel({
  animation,
  pendingRequest,
}: {
  animation: Animation
  pendingRequest: TimeCorrectionRequest | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <GlassCard className="p-5 space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Correction du temps
          </h2>
          <p className="text-xs text-white/35 mt-1">
            Pour corriger un chrono oublié ou arrêté trop tard.
          </p>
        </div>

        {pendingRequest ? (
          <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs font-medium text-amber-300">Demande en attente de validation</p>
            </div>
            <div className="text-xs text-amber-100/70 space-y-1">
              <p>Début : {formatDateTime(pendingRequest.requested_started_at)}</p>
              <p>Animation : {formatDuration(pendingRequest.requested_actual_duration_min)}</p>
              <p>Préparation : {formatDuration(pendingRequest.requested_actual_prep_time_min)}</p>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setOpen(true)} className="w-full gap-2">
            <Clock className="h-4 w-4" />
            Demander une correction
          </Button>
        )}
      </GlassCard>
      <TimeCorrectionRequestDialog animation={animation} open={open} onClose={() => setOpen(false)} />
    </>
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
  animationStartedAt,
}: {
  p: AnimationParticipant
  canDecide: boolean
  canRemove: boolean
  isSelf: boolean
  animationId: string
  animationStartedAt: string | null
}) {
  const { mutateAsync: decide, isPending: deciding } = useDecideParticipant()
  const { mutateAsync: remove, isPending: removing } = useRemoveParticipant()

  const joinOffsetMin = (() => {
    if (!animationStartedAt || !p.joined_at) return null
    const diff = new Date(p.joined_at).getTime() - new Date(animationStartedAt).getTime()
    if (diff <= 0) return 0
    return Math.floor(diff / 60_000)
  })()

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

  const joinLabel = joinOffsetMin == null
    ? null
    : joinOffsetMin === 0
      ? 'Au démarrage'
      : `Rejoint à T+${joinOffsetMin >= 60 ? `${Math.floor(joinOffsetMin / 60)}h${String(joinOffsetMin % 60).padStart(2, '0')}` : `${joinOffsetMin}min`}`

  return (
    <div className="flex items-center gap-3 py-2.5">
      <UserAvatar avatarUrl={p.user?.avatar_url} username={p.user?.username ?? '?'} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-white/90 truncate">{p.user?.username}</p>
          <GenderIcon gender={p.user?.gender} />
          {joinLabel && (
            <span className={joinOffsetMin && joinOffsetMin > 0
              ? 'rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300'
              : 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300'}>
              {joinLabel}
            </span>
          )}
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
      {canRemove && p.status === 'pending' && (
        <button
          onClick={handleRemove}
          disabled={removing}
          title="Retirer cette demande"
          className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center disabled:opacity-50"
        >
          <UserMinus className="h-3.5 w-3.5" />
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${checked ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04]'
                      }`}
                  >
                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-cyan-500/30 border-cyan-500/60' : 'border-white/20 bg-white/[0.04]'
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
  const { user, permissionRoles } = useRequiredAuth()
  const [addParticipantOpen, setAddParticipantOpen] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

  const { data, isLoading } = useAnimation(id!)
  const { mutateAsync: start, isPending: starting } = useStartAnimation()
  const { mutateAsync: startPrep, isPending: startingPrep } = useStartPrepAnimation()
  const { mutateAsync: stopPrep, isPending: stoppingPrep } = useStopPrepAnimation()
  const { mutateAsync: stop, isPending: stopping } = useStopAnimation()
  const { mutateAsync: cancel, isPending: cancelling } = useCancelAnimation()
  const { mutate: deleteAnim, isPending: deleting } = useDeleteAnimation()
  const { mutate: requestDeletion, isPending: requestingDeletion } = useRequestDeletion()
  const { mutateAsync: apply, isPending: applying } = useApplyParticipant()
  const { mutateAsync: setRegistrationsLocked, isPending: togglingRegistrationsLock } = useSetRegistrationsLocked()

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!data) return null

  const { animation, participants, deletionRequest, timeCorrectionRequest } = data
  const isCreator = animation.creator_id === user.id
  const isResponsable = hasPermissionRole(permissionRoles, 'responsable')
  const isBdmResponsable = hasOwnedRole(permissionRoles, ['responsable_bdm'])
  const canManageAnimation = isResponsable || isBdmResponsable
  const canControlTimers = isCreator || hasPermissionRole(permissionRoles, 'senior')
  const canCorrectFinished = hasPermissionRole(permissionRoles, 'senior')
  const canCorrectFinishedBdm = canManageAnimation
  const scheduledAtHasPassed = new Date(animation.scheduled_at).getTime() <= Date.now()
  const canManageRegistrations =
    (isCreator || isResponsable) &&
    ['pending_validation', 'open', 'preparing', 'running'].includes(animation.status)
  const isParticipant = participants.some(
    (p) => p.user_id === user.id && (p.status === 'pending' || p.status === 'validated'),
  )
  const canShowRegistrationCta =
    ['pending_validation', 'open', 'preparing', 'running'].includes(animation.status) &&
    !isCreator &&
    !isParticipant
  const canRequestTimeCorrection =
    isCreator &&
    ['open', 'preparing', 'running', 'finished'].includes(animation.status) &&
    (scheduledAtHasPassed || ['preparing', 'running', 'finished'].includes(animation.status)) &&
    !(animation.status === 'finished' && canCorrectFinished)

  const validated = participants.filter((p) => p.status === 'validated')
  const pending = participants.filter((p) => p.status === 'pending')
  const hasParticipantLimit = animation.required_participants > 0
  const participantProgress = hasParticipantLimit
    ? Math.min(100, (validated.length / animation.required_participants) * 100)
    : 100
  const descriptionNeedsToggle = (animation.description?.length ?? 0) > 180

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

  const handleToggleRegistrationsLock = async () => {
    const locked = !animation.registrations_locked
    try {
      await setRegistrationsLocked({ animationId: animation.id, locked })
      toast.success(locked ? 'Inscriptions verrouillées.' : 'Inscriptions rouvertes.')
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
            {animation.bdm_mission && (
              <span className="inline-flex items-center rounded-full border border-teal-300/35 bg-teal-300/10 px-2 py-0.5 text-xs font-bold text-teal-200">
                BDM rang {animation.bdm_mission_rank} · {BDM_TYPE_LABELS[animation.bdm_mission_type]}
              </span>
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
          {animation.bdm_mission && (
            <span className="inline-flex items-center rounded-full border border-teal-300/35 bg-teal-300/10 px-2.5 py-1 text-xs font-bold text-teal-200">
              BDM rang {animation.bdm_mission_rank} · {BDM_TYPE_LABELS[animation.bdm_mission_type]}
              {animation.bdm_spontaneous ? ' · Spontanée' : ''}
            </span>
          )}
          <ServerBadge server={animation.server} />
          <VillageBadge village={animation.village} />
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Users className="h-4 w-4 text-emerald-400" />
            {hasParticipantLimit
              ? `${validated.length}/${animation.required_participants}`
              : 'Aucun participant demandé'}
          </div>
          {animation.registrations_locked && (
            <div className="flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300">
              <Lock className="h-3.5 w-3.5" />
              Inscriptions verrouillées
            </div>
          )}
          {animation.description && (
            <div className="w-full basis-full pt-1">
              <p className={`text-sm leading-relaxed text-white/60 whitespace-pre-wrap break-words ${descriptionExpanded ? '' : 'line-clamp-2'}`}>
                {animation.description}
              </p>
              {descriptionNeedsToggle && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                  className="mt-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {descriptionExpanded ? 'Voir moins' : 'Voir plus'}
                </button>
              )}
            </div>
          )}
        </div>
        <Progress value={participantProgress} className="mt-3" />
      </GlassCard>

      {/* Chat */}
      <AnimationChat animationId={animation.id} currentUserId={user.id} />

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
                    isResponsable || (['open', 'preparing', 'running'].includes(animation.status) && (isCreator || isSelf))
                  return (
                    <ParticipantRow
                      key={p.id}
                      p={p}
                      canDecide={isCreator && ['open', 'preparing'].includes(animation.status)}
                      canRemove={canRemove}
                      isSelf={isSelf}
                      animationId={animation.id}
                      animationStartedAt={animation.started_at}
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
                    canRemove={isResponsable}
                    isSelf={p.user_id === user.id}
                    animationId={animation.id}
                    animationStartedAt={animation.started_at}
                  />
                ))}
              </div>
            </GlassCard>
          )}

          {/* Apply CTA */}
          {canShowRegistrationCta && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white/80">
                    {animation.registrations_locked ? 'Inscriptions verrouillées' : 'Se proposer'}
                  </h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    {animation.registrations_locked
                      ? "Le créateur a fermé les inscriptions pour cette animation."
                      : 'Rejoins cette animation en tant que participant'
                    }
                  </p>
                </div>
                {animation.registrations_locked ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/10 text-orange-300">
                    <Lock className="h-4 w-4" />
                  </div>
                ) : (
                  <Button onClick={handleApply} disabled={applying} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    {applying ? 'Envoi...' : 'S\'inscrire'}
                  </Button>
                )}
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
          {(canControlTimers || isResponsable) && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
                Contrôle
              </h2>
              <div className="space-y-4">
                {canManageRegistrations && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Inscriptions</p>
                    <Button
                      onClick={handleToggleRegistrationsLock}
                      disabled={togglingRegistrationsLock}
                      variant={animation.registrations_locked ? 'secondary' : 'outline'}
                      className="w-full gap-2"
                    >
                      {animation.registrations_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {togglingRegistrationsLock
                        ? 'Mise à jour...'
                        : animation.registrations_locked
                          ? 'Rouvrir les inscriptions'
                          : 'Verrouiller les inscriptions'
                      }
                    </Button>
                  </div>
                )}

                {/* ── Débrief (indépendant) ── */}
                {canControlTimers && animation.prep_time_min > 0 && ['open', 'preparing'].includes(animation.status) && (
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
                {canControlTimers && (
                  <div className="space-y-2">
                    {animation.prep_time_min > 0 && ['open', 'preparing'].includes(animation.status) && (
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Animation</p>
                    )}
                    {['open', 'preparing'].includes(animation.status) && (
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
                {(isCreator || canManageAnimation) && ['open', 'pending_validation', 'preparing', ...(isResponsable ? ['running'] : [])].includes(animation.status) && (
                  <div className="pt-3 border-t border-white/[0.06] space-y-2">
                    {(isCreator || isResponsable) && (
                      <Button onClick={handleCancel} disabled={cancelling} variant="destructive" className="w-full gap-2">
                        <Ban className="h-4 w-4" />
                        Annuler
                      </Button>
                    )}
                    {['open', 'pending_validation'].includes(animation.status) && (isCreator || canManageAnimation) && (
                      <Link to={`/panel/animations/${animation.id}/edit`} className="block mt-2">
                        <Button variant="outline" className="w-full gap-2">
                          <Pencil className="h-4 w-4" />
                          {isCreator || canManageAnimation ? 'Modifier' : 'Modifier date/heure'}
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

          {canRequestTimeCorrection && (
            <TimeCorrectionRequestPanel
              animation={animation}
              pendingRequest={timeCorrectionRequest}
            />
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
            canCorrectFinished || canCorrectFinishedBdm ? (
              <FinishedEditForm
                animation={animation}
                canEditTiming={canCorrectFinished}
                canEditBdm={canCorrectFinishedBdm}
              />
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
    </div>
  )
}
