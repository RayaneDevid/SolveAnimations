import { useState } from 'react'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useMyReports } from '@/hooks/queries/useAnimations'
import { useSubmitReport } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDuration } from '@/lib/utils/format'
import type { AnimationReport } from '@/types/database'

function ReportCard({ report }: { report: AnimationReport }) {
  const [comments, setComments] = useState(report.comments ?? '')
  const [editing, setEditing] = useState(false)
  const { mutateAsync, isPending } = useSubmitReport()

  const isSubmitted = !!report.submitted_at
  const anim = report.animation

  const handleSubmit = async () => {
    try {
      await mutateAsync({ reportId: report.id, comments })
      toast.success('Rapport soumis !')
      setEditing(false)
    } catch (err) {
      toast.error('Erreur lors de la soumission')
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <h3 className="text-sm font-semibold text-white/90">{anim?.title ?? 'Animation'}</h3>
        </div>
        {isSubmitted ? (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
            Soumis
          </span>
        ) : (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
            En attente
          </span>
        )}
      </div>

      {/* Read-only fields */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
        {[
          { label: 'Pôle', value: report.pole },
          { label: 'Perso joué', value: report.character_name },
          { label: 'Village', value: anim?.village ? (
            <VillageBadge village={anim.village} />
          ) : '—' },
          { label: 'Date', value: anim ? formatDate(anim.scheduled_at) : '—' },
          { label: 'Durée prévue', value: anim ? formatDuration(anim.planned_duration_min) : '—' },
          { label: 'Durée réelle', value: anim?.actual_duration_min ? formatDuration(anim.actual_duration_min) : '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
            <div className="text-sm text-white/80 mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Comments */}
      <div className="space-y-2">
        <p className="text-xs text-white/40 uppercase tracking-wider">Commentaires</p>
        {isSubmitted && !editing ? (
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-white/70 flex-1">
              {report.comments || <span className="text-white/30 italic">Aucun commentaire</span>}
            </p>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-xs">
                Modifier
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="Décris le déroulé de l'animation, les points positifs et négatifs..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              {isSubmitted && (
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
              )}
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Envoi...' : isSubmitted ? 'Mettre à jour' : 'Valider mon rapport'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

export default function Reports() {
  const { data: reports, isLoading } = useMyReports()

  const pending = reports?.filter((r) => !r.submitted_at) ?? []
  const submitted = reports?.filter((r) => !!r.submitted_at) ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes rapports</h1>
        <p className="text-sm text-white/40 mt-0.5">
          {pending.length > 0
            ? `${pending.length} rapport${pending.length > 1 ? 's' : ''} en attente`
            : 'Tous les rapports sont à jour'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                À compléter ({pending.length})
              </h2>
              <div className="space-y-4">
                {pending.map((r) => <ReportCard key={r.id} report={r} />)}
              </div>
            </section>
          )}

          {submitted.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Soumis ({submitted.length})
              </h2>
              <div className="space-y-4">
                {submitted.map((r) => <ReportCard key={r.id} report={r} />)}
              </div>
            </section>
          )}

          {!pending.length && !submitted.length && (
            <GlassCard className="p-12 text-center">
              <FileText className="h-8 w-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Aucun rapport pour le moment</p>
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
