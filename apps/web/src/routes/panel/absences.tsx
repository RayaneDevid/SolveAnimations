import { useState } from 'react'
import { Plus, CalendarOff, Trash2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { isAfter, parseISO } from 'date-fns'
import { useAbsences, useAbsencesSummary, useMemberDirectory } from '@/hooks/queries/useAnimations'
import { useCreateAbsence, useDeleteAbsence } from '@/hooks/mutations/useAnimationMutations'
import { absenceSchema, type AbsenceInput } from '@/lib/schemas/animation'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/format'
import { hasRole } from '@/lib/config/discord'
import type { UserAbsence } from '@/types/database'

type SummaryMember = {
  username: string
  avatar_url: string | null
}

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
        <p className="text-[11px] text-white/25 mt-1">
          Déclarée par {absence.declarer?.username ?? 'inconnu'}
        </p>
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
  const { user, role } = useRequiredAuth()
  const { mutateAsync, isPending } = useCreateAbsence()
  const canDeclareForOther = hasRole(role, 'senior')
  const { data: members = [] } = useMemberDirectory()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AbsenceInput>({
    resolver: zodResolver(absenceSchema),
    defaultValues: { userId: user.id },
  })

  const onSubmit = async (data: AbsenceInput) => {
    try {
      const targetUserId = canDeclareForOther ? data.userId : undefined
      await mutateAsync({
        fromDate: data.fromDate.toISOString().split('T')[0],
        toDate: data.toDate.toISOString().split('T')[0],
        reason: data.reason,
        userId: targetUserId && targetUserId !== user.id ? targetUserId : undefined,
      })
      toast.success(targetUserId && targetUserId !== user.id ? 'Absence déclarée pour le membre !' : 'Absence déclarée !')
      reset({ userId: user.id })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déclarer une absence</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {canDeclareForOther && (
            <div className="space-y-1.5">
              <Label htmlFor="userId">Membre</Label>
              <select
                id="userId"
                {...register('userId')}
                className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/90 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
              >
                <option value={user.id} className="bg-[#1a1b1f]">Moi-même</option>
                {members
                  .filter((member) => member.id !== user.id)
                  .map((member) => (
                    <option key={member.id} value={member.id} className="bg-[#1a1b1f]">
                      {member.username}
                    </option>
                  ))}
              </select>
            </div>
          )}

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

function MemberPill({ member }: { member: SummaryMember }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-full px-2.5 py-1">
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={member.username} className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <div className="h-4 w-4 rounded-full bg-white/10" />
      )}
      <span className="text-xs text-white/70">{member.username}</span>
    </div>
  )
}

function PoleAbsencesCard({
  title,
  absent,
  total,
  tone,
}: {
  title: string
  absent: SummaryMember[]
  total: number
  tone: 'cyan' | 'violet'
}) {
  const toneClass = tone === 'cyan'
    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
    : 'bg-violet-500/10 border-violet-500/20 text-violet-400'

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">{title}</p>
        <span className={`text-xs font-medium rounded-full border px-2 py-0.5 ${toneClass}`}>
          {absent.length} / {total}
        </span>
      </div>
      {absent.length === 0 ? (
        <p className="text-xs text-white/25">Aucune absence actuelle ou à venir</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {absent.map((member) => (
            <MemberPill key={member.username} member={member} />
          ))}
        </div>
      )}
    </div>
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
                {summary.absentCount} / {summary.totalStaff} membre{summary.totalStaff > 1 ? 's' : ''} avec une absence actuelle ou à venir
              </p>
              <p className="text-xs text-white/30 mt-0.5">absences dont la date de fin n'est pas passée</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-12">
            <PoleAbsencesCard
              title="Pôle Animation"
              absent={summary.absentByPole?.animation ?? []}
              total={summary.totalByPole?.animation ?? 0}
              tone="cyan"
            />
            <PoleAbsencesCard
              title="Pôle MJ"
              absent={summary.absentByPole?.mj ?? []}
              total={summary.totalByPole?.mj ?? 0}
              tone="violet"
            />
          </div>
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
