import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ShieldCheck, ShieldOff, BellRing, BellOff, History } from 'lucide-react'
import { toast } from 'sonner'
import { createAnimationSchema, type CreateAnimationInput, SERVERS, TYPES, VILLAGES, POLES, MISSION_KINDS, type Village, type AnimationPole, type MissionKind } from '@/lib/schemas/animation'
import { useCreateAnimation } from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { RpDateTimePicker } from '@/components/animations/RpDateTimePicker'
import { cn } from '@/lib/utils/cn'
import { hasPermissionRole } from '@/lib/config/discord'

const TYPE_LABELS_FULL = { moyenne: 'Moyenne', grande: 'Grande' } as const
const TYPE_DESCRIPTIONS = {
  moyenne: 'Pour les tickets animations, les missions spontanées / BDM et les scènes MJ',
  grande: 'Pour les animations Trames et les events (+ animations très longues)',
} as const

const MISSION_KIND_CONFIG: Record<MissionKind, { label: string; description: string }> = {
  classique: {
    label: 'Animation classique',
    description: 'Animation planifiée à venir, avec validation optionnelle.',
  },
  spontanee_bdm: {
    label: 'Mission spontanée / BDM',
    description: 'Créée immédiatement, sans participant demandé.',
  },
  passee: {
    label: 'Animation passée',
    description: 'Animation déjà jouée, soumise à validation Responsable.',
  },
}

const POLE_CONFIG: Record<AnimationPole, { label: string; description: string; color: string; active: string }> = {
  animation: {
    label: 'Pôle Animation',
    description: 'Animation menée par des animateurs',
    color: 'text-blue-400',
    active: 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]',
  },
  mj: {
    label: 'Pôle MJ',
    description: 'Animation menée par des Maîtres du Jeu',
    color: 'text-red-400',
    active: 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]',
  },
  les_deux: {
    label: 'Pôle Animation & MJ',
    description: 'Animation co-menée par les deux pôles',
    color: 'text-violet-400',
    active: 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]',
  },
}

export default function NewAnimation() {
  const navigate = useNavigate()
  const { permissionRoles } = useRequiredAuth()
  const { mutateAsync, isPending } = useCreateAnimation()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAnimationInput>({
    resolver: zodResolver(createAnimationSchema),
    defaultValues: {
      missionKind: 'classique',
      prepTimeMin: 0,
      requiredParticipants: 4,
      plannedDurationMin: 60,
      requestValidation: false,
      pingRoles: false,
      spontaneous: false,
    },
  })

  const scheduledAt = watch('scheduledAt')
  const missionKind = watch('missionKind')
  const isInstantMission = missionKind === 'spontanee_bdm'
  const isPastMission = missionKind === 'passee'
  const canSelfValidatePastMission = hasPermissionRole(permissionRoles, 'senior')
  const requiredParticipants = watch('requiredParticipants')
  const isClassicPastDate = missionKind === 'classique' && scheduledAt instanceof Date && scheduledAt.getTime() < Date.now()
  const isPastFutureDate = isPastMission && scheduledAt instanceof Date && scheduledAt.getTime() > Date.now()

  useEffect(() => {
    if (isInstantMission) {
      setValue('scheduledAt', undefined, { shouldValidate: true })
      setValue('plannedDurationMin', 15, { shouldValidate: true })
      setValue('prepTimeMin', 0, { shouldValidate: true })
      setValue('requiredParticipants', 0, { shouldValidate: true })
      setValue('type', 'moyenne', { shouldValidate: true })
      setValue('pole', 'animation', { shouldValidate: true })
      setValue('requestValidation', false)
      setValue('pingRoles', false)
      return
    }

    if (isPastMission) {
      setValue('requestValidation', !canSelfValidatePastMission)
      setValue('pingRoles', false)
    }

    if (requiredParticipants == null) {
      setValue('requiredParticipants', 4, { shouldValidate: true })
    }
  }, [canSelfValidatePastMission, isInstantMission, isPastMission, requiredParticipants, setValue])

  const onSubmit = async (data: CreateAnimationInput) => {
    try {
      const instantMission = data.missionKind === 'spontanee_bdm'
      const pastMission = data.missionKind === 'passee'
      const result = await mutateAsync({
        ...data,
        spontaneous: instantMission,
        scheduledAt: instantMission ? undefined : data.scheduledAt,
        plannedDurationMin: instantMission ? 15 : data.plannedDurationMin,
        prepTimeMin: instantMission ? 0 : data.prepTimeMin,
        requiredParticipants: instantMission ? 0 : data.requiredParticipants,
        type: instantMission ? 'moyenne' : data.type,
        pole: instantMission ? 'animation' : data.pole,
        description: data.description,
        requestValidation: pastMission ? !canSelfValidatePastMission : instantMission ? false : data.requestValidation,
        pingRoles: pastMission || instantMission ? false : data.pingRoles,
      })
      toast.success('Animation créée avec succès !')
      navigate(`/panel/animations/${result.animation.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Créer une animation</h1>
          <p className="text-sm text-white/40">Remplis les informations ci-dessous</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Général</h2>
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre de l'animation</Label>
            <Input
              id="title"
              placeholder="Ex: Tournoi des ninjas de Konoha"
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Type de mission</Label>
            <Controller
              name="missionKind"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MISSION_KINDS.map((kind) => {
                    const config = MISSION_KIND_CONFIG[kind]
                    const selected = field.value === kind
                    const description = kind === 'passee' && canSelfValidatePastMission
                      ? 'Animation déjà jouée, auto-validée pour les Seniors et +.'
                      : config.description
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => field.onChange(kind)}
                        className={cn(
                          'p-4 rounded-xl border text-left transition-all',
                          selected
                            ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20',
                        )}
                      >
                        <span className={cn('block text-sm font-bold', selected ? 'text-cyan-300' : 'text-white')}>
                          {config.label}
                        </span>
                        <span className="block text-xs text-white/40 mt-1">{description}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            />
            {errors.missionKind && <p className="text-xs text-red-400">{errors.missionKind.message}</p>}
          </div>

          {!isInstantMission && (
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
              {isClassicPastDate && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <History className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300/80">
                    Une animation classique ne peut pas être antidatée. Utilise le type Mission passée.
                  </p>
                </div>
              )}
              {isPastFutureDate && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <History className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300/80">
                    Une mission passée doit avoir une date déjà écoulée.
                  </p>
                </div>
              )}
              {isPastMission && !isPastFutureDate && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <History className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80">
                    {canSelfValidatePastMission
                      ? 'La mission sera directement auto-validée et ajoutée comme terminée.'
                      : 'La mission sera créée en attente de validation Responsable, puis ajoutée comme terminée après validation.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Description de l'animation</Label>
            <Textarea
              id="description"
              placeholder={isInstantMission ? 'Décris rapidement la mission spontanée / BDM...' : 'Décris le contexte, les objectifs, le déroulement prévu...'}
              rows={4}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>
        </GlassCard>

        {/* Details */}
        {!isInstantMission && <GlassCard className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Détails</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div className="space-y-1.5">
              <Label>{isPastMission ? 'Durée réelle (min)' : 'Durée estimée (min)'}</Label>
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

            {/* Prep time */}
            <div className="space-y-1.5">
              <Label>{isPastMission ? 'Temps de préparation réel (min)' : 'Temps de préparation estimé (min)'}</Label>
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
            <Label htmlFor="requiredParticipants">Participants requis</Label>
            <Input
              id="requiredParticipants"
              type="number"
              min={0}
              max={100}
              placeholder="Ex: 4"
              {...register('requiredParticipants', { valueAsNumber: true })}
            />
            {errors.requiredParticipants && (
              <p className="text-xs text-red-400">{errors.requiredParticipants.message}</p>
            )}
          </div>

        </GlassCard>}

        {/* Server */}
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            {isInstantMission ? 'Secteur' : 'Serveur'}
          </h2>
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
        </GlassCard>

        {/* Village */}
        <GlassCard className="p-5 space-y-3">
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
        </GlassCard>

        {/* Type */}
        {!isInstantMission && <GlassCard className="p-5 space-y-3">
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

        {/* Pole */}
        {!isInstantMission && <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Pôle</h2>
          <Controller
            name="pole"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-3">
                {POLES.map((p) => {
                  const cfg = POLE_CONFIG[p]
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => field.onChange(p)}
                      className={cn(
                        'p-4 rounded-xl border text-left transition-all',
                        field.value === p
                          ? cfg.active
                          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20',
                      )}
                    >
                      <p className={cn('text-sm font-bold', field.value === p ? cfg.color : 'text-white')}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-white/40 mt-1">{cfg.description}</p>
                    </button>
                  )
                })}
              </div>
            )}
          />
          {errors.pole && <p className="text-xs text-red-400">{errors.pole.message}</p>}
        </GlassCard>}

        {/* Validation */}
        {isPastMission && <GlassCard className="p-5">
          <div className="flex items-start gap-4 w-full text-left">
            <div className="mt-0.5 h-5 w-5 rounded flex items-center justify-center shrink-0 border bg-cyan-500/20 border-cyan-500/50">
              <svg className="h-3 w-3 text-cyan-400" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white/80">
                  {canSelfValidatePastMission ? 'Auto-validation Senior' : 'Validation Responsable obligatoire'}
                </span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                {canSelfValidatePastMission
                  ? 'Avec ton rôle actuel, la mission passée sera validée automatiquement à la création.'
                  : "La mission passée restera en attente tant qu'un Responsable ne l'aura pas validée."
                }
              </p>
            </div>
          </div>
        </GlassCard>}

        {!isInstantMission && !isPastMission && <GlassCard className="p-5">
          <Controller
            name="requestValidation"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className="flex items-start gap-4 w-full text-left"
              >
                <div className={cn(
                  'mt-0.5 h-5 w-5 rounded flex items-center justify-center shrink-0 border transition-all',
                  field.value
                    ? 'bg-cyan-500/20 border-cyan-500/50'
                    : 'bg-white/[0.04] border-white/[0.15]',
                )}>
                  {field.value && (
                    <svg className="h-3 w-3 text-cyan-400" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {field.value
                      ? <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      : <ShieldOff className="h-4 w-4 text-white/30" />
                    }
                    <span className="text-sm font-semibold text-white/80">
                      Demander la validation d'un Responsable
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                    {field.value
                      ? "L'animation sera en attente de validation avant d'être ouverte aux inscriptions."
                      : "L'animation sera directement ouverte aux inscriptions sans validation préalable."
                    }
                  </p>
                </div>
              </button>
            )}
          />
        </GlassCard>}

        {/* Ping roles */}
        {!isInstantMission && !isPastMission && <GlassCard className="p-5">
          <Controller
            name="pingRoles"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className="flex items-start gap-4 w-full text-left"
              >
                <div className={cn(
                  'mt-0.5 h-5 w-5 rounded flex items-center justify-center shrink-0 border transition-all',
                  field.value
                    ? 'bg-cyan-500/20 border-cyan-500/50'
                    : 'bg-white/[0.04] border-white/[0.15]',
                )}>
                  {field.value && (
                    <svg className="h-3 w-3 text-cyan-400" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {field.value
                      ? <BellRing className="h-4 w-4 text-cyan-400" />
                      : <BellOff className="h-4 w-4 text-white/30" />
                    }
                    <span className="text-sm font-semibold text-white/80">
                      Notifier les rôles Discord
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                    {field.value
                      ? 'Les rôles concernés seront mentionnés lors de l\'annonce sur Discord.'
                      : 'L\'annonce sera postée sans mention de rôle.'
                    }
                  </p>
                </div>
              </button>
            )}
          />
        </GlassCard>}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Création...' : isPastMission ? 'Créer la mission passée' : isInstantMission ? 'Créer maintenant' : "Créer l'animation"}
          </Button>
        </div>
      </form>
    </div>
  )
}
