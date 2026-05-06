import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  BDM_MISSION_RANKS,
  BDM_MISSION_TYPES,
  createAnimationSchema,
  type BdmMissionRank,
  type BdmMissionType,
  type CreateAnimationInput,
  SERVERS,
  TYPES,
  VILLAGES,
  type Village,
} from '@/lib/schemas/animation'
import { useAnimation } from '@/hooks/queries/useAnimations'
import { useUpdateAnimation } from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { RpDateTimePicker } from '@/components/animations/RpDateTimePicker'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import { hasOwnedRole, hasPermissionRole } from '@/lib/config/discord'

const TYPE_LABELS_FULL = { moyenne: 'Moyenne', grande: 'Grande' } as const
const TYPE_DESCRIPTIONS = {
  moyenne: 'Pour les tickets animations, les missions et les scènes MJ',
  grande: 'Pour les animations Trames et les events (+ animations très longues)',
} as const

const BDM_MISSION_TYPE_CONFIG: Record<BdmMissionType, { label: string; description: string }> = {
  jetable: {
    label: 'Mission jetable',
    description: 'Simple, avec un personnage non récurrent ou voué à disparaître rapidement.',
  },
  elaboree: {
    label: 'Mission élaborée',
    description: "Avec un minimum d'écriture, un contexte travaillé et du jeu sur une petite période.",
  },
  grande_ampleur: {
    label: 'Mission grande ampleur',
    description: 'Sous validation RBDM / GRP, avec préparation importante sur plusieurs jours ou parties.',
  },
}

export default function EditAnimation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, permissionRoles } = useRequiredAuth()
  const { data, isLoading } = useAnimation(id!)
  const { mutateAsync, isPending } = useUpdateAnimation()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateAnimationInput>({
    resolver: zodResolver(createAnimationSchema),
  })

  const requiredParticipants = watch('requiredParticipants')
  const scheduledAt = watch('scheduledAt')
  const missionKind = watch('missionKind')
  const bdmSpontaneous = watch('bdmSpontaneous')
  const bdmMissionType = watch('bdmMissionType')
  const animation = data?.animation
  const isCreator = animation?.creator_id === user.id
  const isResponsable = hasPermissionRole(permissionRoles, 'responsable')
  const isBdmResponsable = hasOwnedRole(permissionRoles, ['responsable_bdm'])
  const canManageMissionKind = isResponsable || isBdmResponsable
  const canFullEdit = isCreator || canManageMissionKind
  const scheduleOnly = false
  const isBdmMission = missionKind === 'mission_bdm'
  const isBdmSpontaneous = isBdmMission && bdmSpontaneous
  const activeParticipantsCount = (data?.participants ?? [])
    .filter((participant) => ['pending', 'validated'].includes(participant.status))
    .length
  const scheduleChanged = !!animation &&
    scheduledAt instanceof Date &&
    scheduledAt.getTime() !== new Date(animation.scheduled_at).getTime()
  const willRemoveParticipants = !!animation &&
    animation.status === 'open' &&
    scheduleChanged &&
    activeParticipantsCount > 0
  const willConvertToBdm = !!animation && !animation.bdm_mission && isBdmMission
  const willRemoveParticipantsForBdm = willConvertToBdm && activeParticipantsCount > 0

  useEffect(() => {
    if (!data?.animation) return
    const a = data.animation
    reset({
      title: a.title,
      missionKind: a.bdm_mission ? 'mission_bdm' : 'classique',
      spontaneous: false,
      bdmMission: a.bdm_mission,
      bdmSpontaneous: a.bdm_spontaneous,
      bdmMissionRank: a.bdm_mission_rank,
      bdmMissionType: a.bdm_mission_type,
      scheduledAt: a.bdm_mission && a.bdm_spontaneous ? undefined : new Date(a.scheduled_at),
      plannedDurationMin: a.planned_duration_min,
      requiredParticipants: a.required_participants,
      server: a.server,
      type: (a.type as string) === 'petite' ? 'moyenne' : a.type,
      pole: a.pole,
      prepTimeMin: a.prep_time_min,
      village: a.village,
      description: a.description ?? undefined,
    })
  }, [data, reset])

  const handleMissionKindChange = (kind: 'classique' | 'mission_bdm') => {
    setValue('missionKind', kind, { shouldValidate: true })
    setValue('bdmMission', kind === 'mission_bdm', { shouldValidate: true })
    if (kind === 'mission_bdm') {
      setValue('plannedDurationMin', 15, { shouldValidate: true })
      setValue('prepTimeMin', 0, { shouldValidate: true })
      setValue('requiredParticipants', 0, { shouldValidate: true })
      setValue('type', 'moyenne', { shouldValidate: true })
      setValue('pole', 'animation', { shouldValidate: true })
      if (!watch('bdmMissionRank')) setValue('bdmMissionRank', 'B', { shouldValidate: true })
      if (!watch('bdmMissionType')) setValue('bdmMissionType', 'jetable', { shouldValidate: true })
      return
    }

    setValue('bdmSpontaneous', false, { shouldValidate: true })
    if ((watch('plannedDurationMin') ?? 0) <= 15) setValue('plannedDurationMin', 60, { shouldValidate: true })
    if ((watch('requiredParticipants') ?? 0) <= 0) setValue('requiredParticipants', 4, { shouldValidate: true })
    if (!(watch('scheduledAt') instanceof Date) && animation?.scheduled_at) {
      setValue('scheduledAt', new Date(animation.scheduled_at), { shouldValidate: true })
    }
  }

  const onSubmit = async (formData: CreateAnimationInput) => {
    if (willRemoveParticipants && !confirm(
      `${activeParticipantsCount} participant${activeParticipantsCount > 1 ? 's' : ''} seront retiré${activeParticipantsCount > 1 ? 's' : ''} et devront se réinscrire. Continuer ?`,
    )) {
      return
    }
    if (willRemoveParticipantsForBdm && !confirm(
      `${activeParticipantsCount} participant${activeParticipantsCount > 1 ? 's' : ''} seront retiré${activeParticipantsCount > 1 ? 's' : ''}, car une mission BDM ne demande pas d'inscriptions. Continuer ?`,
    )) {
      return
    }

    try {
      const bdmMission = formData.missionKind === 'mission_bdm'
      await mutateAsync({
        id: id!,
        ...formData,
        bdmMission,
        bdmSpontaneous: bdmMission && formData.bdmSpontaneous,
        scheduledAt: bdmMission && formData.bdmSpontaneous ? undefined : formData.scheduledAt,
        plannedDurationMin: bdmMission ? 15 : formData.plannedDurationMin,
        prepTimeMin: bdmMission ? 0 : formData.prepTimeMin,
        requiredParticipants: bdmMission ? 0 : formData.requiredParticipants,
        type: bdmMission ? 'moyenne' : formData.type,
        pole: bdmMission ? 'animation' : formData.pole,
      })
      toast.success('Animation mise à jour !')
      navigate(`/panel/animations/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!data) return null
  if (!canFullEdit || !['pending_validation', 'open'].includes(data.animation.status)) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <GlassCard className="p-8 text-center">
          <p className="text-sm text-white/50">Cette animation ne peut pas être modifiée dans son état actuel.</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Modifier l'animation</h1>
          <p className="text-sm text-white/40 truncate max-w-xs">{data.animation.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Général */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Général</h2>
          {!scheduleOnly && (
            <div className="space-y-1.5">
              <Label htmlFor="title">Titre</Label>
              <Input id="title" placeholder="Titre de l'animation" {...register('title')} />
              {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
            </div>
          )}

          {canManageMissionKind && !scheduleOnly && (
            <div className="space-y-2">
              <Label>Nature</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ['classique', 'Animation', 'Utilise la logique classique avec type, durée et inscriptions.'],
                  ['mission_bdm', 'Mission BDM', 'Utilise le rang, le type BDM et la logique BDM.'],
                ] as const).map(([kind, label, description]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => handleMissionKindChange(kind)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all',
                      missionKind === kind
                        ? 'border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20',
                    )}
                  >
                    <span className={cn('block text-sm font-bold', missionKind === kind ? 'text-cyan-300' : 'text-white')}>
                      {label}
                    </span>
                    <span className="mt-1 block text-xs text-white/40">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isBdmSpontaneous && (
            <div className="space-y-1.5">
              <Label>Date et heure de session</Label>
              <Controller
                name="scheduledAt"
                control={control}
                render={({ field }) => (
                  <RpDateTimePicker
                    value={field.value instanceof Date ? field.value : undefined}
                    onChange={field.onChange}
                    error={errors.scheduledAt?.message}
                  />
                )}
              />
            </div>
          )}

          {isBdmMission && canManageMissionKind && !scheduleOnly && (
            <div className="space-y-4 rounded-xl border border-teal-300/20 bg-teal-400/[0.04] p-4">
              <div>
                <h2 className="text-sm font-semibold text-teal-100/90">Paramètres BDM</h2>
                <p className="mt-0.5 text-xs text-teal-100/45">
                  Ces champs peuvent être corrigés par les responsables et RBDM.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rang de la mission</Label>
                <Controller
                  name="bdmMissionRank"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {BDM_MISSION_RANKS.map((rank: BdmMissionRank) => (
                        <button
                          key={rank}
                          type="button"
                          onClick={() => field.onChange(rank)}
                          className={cn(
                            'h-10 min-w-10 rounded-lg border px-3 text-sm font-bold transition-all',
                            field.value === rank
                              ? 'border-teal-300/50 bg-teal-300/15 text-teal-100'
                              : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/80',
                          )}
                        >
                          {rank}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.bdmMissionRank && <p className="text-xs text-red-400">{errors.bdmMissionRank.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Type de mission BDM</Label>
                <Controller
                  name="bdmMissionType"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-1 gap-3">
                      {BDM_MISSION_TYPES.map((type: BdmMissionType) => {
                        const cfg = BDM_MISSION_TYPE_CONFIG[type]
                        const selected = field.value === type
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => field.onChange(type)}
                            className={cn(
                              'rounded-xl border p-4 text-left transition-all',
                              selected
                                ? 'border-teal-300/40 bg-teal-300/10 shadow-[0_0_18px_rgba(45,212,191,0.10)]'
                                : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20',
                            )}
                          >
                            <span className={cn('block text-sm font-bold', selected ? 'text-teal-100' : 'text-white')}>
                              {cfg.label}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-white/40">{cfg.description}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                />
                {errors.bdmMissionType && <p className="text-xs text-red-400">{errors.bdmMissionType.message}</p>}
              </div>

              <Controller
                name="bdmSpontaneous"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !field.value
                      field.onChange(next)
                      if (next) setValue('scheduledAt', undefined, { shouldValidate: true })
                      else if (animation?.scheduled_at) setValue('scheduledAt', new Date(animation.scheduled_at), { shouldValidate: true })
                    }}
                    className="flex w-full items-start gap-3 rounded-lg border border-white/[0.08] bg-black/10 p-3 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <div className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all',
                      field.value ? 'border-teal-300/60 bg-teal-300/20' : 'border-white/20 bg-white/[0.04]',
                    )}>
                      {field.value && (
                        <svg className="h-3 w-3 text-teal-200" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white/80">Mission spontanée</span>
                      <p className="mt-0.5 text-xs text-white/40">
                        {field.value
                          ? 'La mission sera enregistrée comme démarrée immédiatement.'
                          : 'La mission reste programmée à la date choisie.'
                        }
                      </p>
                    </div>
                  </button>
                )}
              />

              {bdmMissionType === 'grande_ampleur' && (
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200/80">
                  Ce type doit rester sous validation RBDM / GRP si la mission n'est pas encore ouverte.
                </div>
              )}
            </div>
          )}

          {willRemoveParticipants && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300/85">
                Changer la date ou l'heure d'une animation ouverte retirera les participants actuels.
                Ils devront se réinscrire sur la nouvelle date.
              </p>
            </div>
          )}
          {willRemoveParticipantsForBdm && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300/85">
                Convertir cette animation en mission BDM retirera les participants actifs.
              </p>
            </div>
          )}

          {!scheduleOnly && (
            <div className="space-y-1.5">
              <Label htmlFor="description">Description de l'animation</Label>
              <Textarea
                id="description"
                placeholder="Décris le contexte, les objectifs, le déroulement prévu..."
                rows={4}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-400">{errors.description.message}</p>
              )}
            </div>
          )}
        </GlassCard>

        {/* Détails */}
        {!scheduleOnly && !isBdmMission && <GlassCard className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Détails</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Durée prévue (min)</Label>
              <Input
                type="number"
                min={15}
                max={720}
                {...register('plannedDurationMin', { valueAsNumber: true })}
              />
              {errors.plannedDurationMin && (
                <p className="text-xs text-red-400">{errors.plannedDurationMin.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Durée du débrief (min)</Label>
              <Input
                type="number"
                min={0}
                max={600}
                {...register('prepTimeMin', { valueAsNumber: true })}
              />
              {errors.prepTimeMin && (
                <p className="text-xs text-red-400">{errors.prepTimeMin.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Participants requis</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setValue('requiredParticipants', Math.max(0, (requiredParticipants ?? 0) - 1), { shouldValidate: true })}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-2xl font-bold text-white w-8 text-center">
                {requiredParticipants ?? 0}
              </span>
              <button
                type="button"
                onClick={() => setValue('requiredParticipants', Math.min(100, (requiredParticipants ?? 0) + 1), { shouldValidate: true })}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </GlassCard>}

        {/* Serveur */}
        {!scheduleOnly && <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Serveur</h2>
          <Controller
            name="server"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {SERVERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => field.onChange(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-sm font-mono font-semibold transition-all',
                      field.value === s
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                        : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/80',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          />
          {errors.server && <p className="text-xs text-red-400">{errors.server.message}</p>}
        </GlassCard>}

        {/* Village */}
        {!scheduleOnly && !isBdmMission && <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Village</h2>
          <Controller
            name="village"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {VILLAGES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => field.onChange(v)}
                    className={cn(
                      'transition-all',
                      field.value === v
                        ? 'ring-2 ring-cyan-400/50 ring-offset-1 ring-offset-[#0A0B0F] rounded-full'
                        : 'opacity-60 hover:opacity-100',
                    )}
                  >
                    <VillageBadge village={v as Village} />
                  </button>
                ))}
              </div>
            )}
          />
          {errors.village && <p className="text-xs text-red-400">{errors.village.message}</p>}
        </GlassCard>}

        {/* Type */}
        {!scheduleOnly && <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Type</h2>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => field.onChange(t)}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      field.value === t
                        ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                        : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20',
                    )}
                  >
                    <p className="text-sm font-bold text-white">{TYPE_LABELS_FULL[t]}</p>
                    <p className="text-xs text-white/40 mt-1">{TYPE_DESCRIPTIONS[t]}</p>
                  </button>
                ))}
              </div>
            )}
          />
          {errors.type && <p className="text-xs text-red-400">{errors.type.message}</p>}
        </GlassCard>}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
