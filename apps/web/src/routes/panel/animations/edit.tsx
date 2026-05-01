import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createAnimationSchema, type CreateAnimationInput, SERVERS, TYPES, VILLAGES, type Village } from '@/lib/schemas/animation'
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
import { hasPermissionRole } from '@/lib/config/discord'

const TYPE_LABELS_FULL = { moyenne: 'Moyenne', grande: 'Grande' } as const
const TYPE_DESCRIPTIONS = {
  moyenne: 'Pour les tickets animations, les missions et les scènes MJ',
  grande: 'Pour les animations Trames et les events (+ animations très longues)',
} as const

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
  const animation = data?.animation
  const isCreator = animation?.creator_id === user.id
  const isResponsable = hasPermissionRole(permissionRoles, 'responsable')
  const scheduleOnly = !!animation && !isCreator && isResponsable && animation.status === 'open'
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

  useEffect(() => {
    if (!data?.animation) return
    const a = data.animation
    reset({
      title: a.title,
      scheduledAt: new Date(a.scheduled_at),
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

  const onSubmit = async (formData: CreateAnimationInput) => {
    if (willRemoveParticipants && !confirm(
      `${activeParticipantsCount} participant${activeParticipantsCount > 1 ? 's' : ''} seront retiré${activeParticipantsCount > 1 ? 's' : ''} et devront se réinscrire. Continuer ?`,
    )) {
      return
    }

    try {
      await mutateAsync(scheduleOnly
        ? { id: id!, scheduledAt: formData.scheduledAt }
        : { id: id!, ...formData })
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
  if (!isCreator && !scheduleOnly) {
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

          {willRemoveParticipants && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300/85">
                Changer la date ou l'heure d'une animation ouverte retirera les participants actuels.
                Ils devront se réinscrire sur la nouvelle date.
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
        {!scheduleOnly && <GlassCard className="p-5 space-y-4">
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
        {!scheduleOnly && <GlassCard className="p-5 space-y-3">
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
