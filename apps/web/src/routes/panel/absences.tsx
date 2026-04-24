import { useState } from 'react'
import { Plus, CalendarOff, Trash2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { isAfter, parseISO } from 'date-fns'
import { useAbsences, useAbsencesSummary } from '@/hooks/queries/useAnimations'
import { useCreateAbsence, useDeleteAbsence } from '@/hooks/mutations/useAnimationMutations'
import { absenceSchema, type AbsenceInput } from '@/lib/schemas/animation'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/format'
import type { UserAbsence } from '@/types/database'

function AbsenceRow({ absence, onDelete }: { absence: UserAbsence; onDelete: (id: string) => void }) {
  const isPast = isAfter(new Date(), parseISO(absence.to_date))
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white/90">
            {formatDate(absence.from_date)} → {formatDate(absence.to_date)}
          </p>
          {isPast && (
            <span className="text-xs text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">
              Passée
            </span>
          )}
        </div>
        {absence.reason && (
          <p className="text-xs text-white/40 mt-0.5 truncate">{absence.reason}</p>
        )}
      </div>
      {!isPast && (
        <button
          onClick={() => onDelete(absence.id)}
          className="ml-3 h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function CreateAbsenceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutateAsync, isPending } = useCreateAbsence()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AbsenceInput>({
    resolver: zodResolver(absenceSchema),
  })

  const onSubmit = async (data: AbsenceInput) => {
    try {
      await mutateAsync({
        fromDate: data.fromDate.toISOString().split('T')[0],
        toDate: data.toDate.toISOString().split('T')[0],
        reason: data.reason,
      })
      toast.success('Absence déclarée !')
      reset()
      onClose()
    } catch (err) {
      toast.error('Erreur lors de la création')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déclarer une absence</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fromDate">Du</Label>
              <Input
                id="fromDate"
                type="date"
                {...register('fromDate')}
                className="[color-scheme:dark]"
              />
              {errors.fromDate && <p className="text-xs text-red-400">{errors.fromDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toDate">Au</Label>
              <Input
                id="toDate"
                type="date"
                {...register('toDate')}
                className="[color-scheme:dark]"
              />
              {errors.toDate && <p className="text-xs text-red-400">{errors.toDate.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motif (optionnel)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Vacances, IRL..."
              rows={3}
              {...register('reason')}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Déclaration...' : 'Déclarer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Absences() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: absences, isLoading } = useAbsences()
  const { data: summary } = useAbsencesSummary()
  const { mutateAsync: deleteAbsence } = useDeleteAbsence()

  const now = new Date()
  const upcoming = absences?.filter((a) => !isAfter(now, parseISO(a.to_date))) ?? []
  const past = absences?.filter((a) => isAfter(now, parseISO(a.to_date))) ?? []

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette absence ?')) return
    try {
      await deleteAbsence(id)
      toast.success('Absence supprimée')
    } catch {
      toast.error('Erreur')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Absences</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Déclare tes indisponibilités pour bloquer les inscriptions
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Déclarer
        </Button>
      </div>

      {summary && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">
                {summary.absentCount} / {summary.totalStaff} membre{summary.totalStaff > 1 ? 's' : ''} absent{summary.absentCount > 1 ? 's' : ''} cette semaine
              </p>
              <p className="text-xs text-white/30 mt-0.5">absences déclarées sur la semaine en cours</p>
            </div>
          </div>
          {summary.absentMembers.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-12">
              {summary.absentMembers.map((m) => (
                <div key={m.username} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-full px-2.5 py-1">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.username} className="h-4 w-4 rounded-full object-cover" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-white/10" />
                  )}
                  <span className="text-xs text-white/70">{m.username}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <>
          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">
              Actuelles et à venir ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-white/30 py-3 text-center">Aucune absence prévue</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {upcoming.map((a) => (
                  <AbsenceRow key={a.id} absence={a} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </GlassCard>

          {past.length > 0 && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">
                Archives ({past.length})
              </h2>
              <div className="divide-y divide-white/[0.05]">
                {past.slice(0, 10).map((a) => (
                  <AbsenceRow key={a.id} absence={a} onDelete={handleDelete} />
                ))}
              </div>
            </GlassCard>
          )}

          {!upcoming.length && !past.length && (
            <GlassCard className="p-12 text-center">
              <CalendarOff className="h-8 w-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Aucune absence enregistrée</p>
            </GlassCard>
          )}
        </>
      )}

      <CreateAbsenceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
