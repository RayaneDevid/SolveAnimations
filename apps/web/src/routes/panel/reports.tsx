import { useState, useMemo } from 'react'
import {
  FileText, CheckCircle2, AlertCircle, ChevronRight,
  Calendar, Clock, Sword, Edit2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMyReports } from '@/hooks/queries/useAnimations'
import { useSubmitReport } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, formatDateTime, formatDuration, formatWeekLabel } from '@/lib/utils/format'
import { getWeekBoundsFor } from '@/lib/utils/week'
import { cn } from '@/lib/utils/cn'
import type { AnimationReport } from '@/types/database'

// ─── Report detail modal ──────────────────────────────────────────────────────

function ReportModal({ report, onClose }: { report: AnimationReport; onClose: () => void }) {
  const [characterName, setCharacterName] = useState(report.character_name ?? '')
  const [comments, setComments] = useState(report.comments ?? '')
  const [editing, setEditing] = useState(!report.submitted_at)
  const { mutateAsync, isPending } = useSubmitReport()

  const isSubmitted = !!report.submitted_at
  const anim = report.animation

  const handleSubmit = async () => {
    if (!characterName.trim()) {
      toast.error('Le nom du personnage est requis')
      return
    }
    try {
      await mutateAsync({ reportId: report.id, characterName, comments })
      toast.success(isSubmitted ? 'Rapport mis à jour !' : 'Rapport soumis !')
      setEditing(false)
    } catch {
      toast.error('Erreur lors de la soumission')
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0D0E14] border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-white leading-snug pr-6">
              {anim?.title ?? 'Animation'}
            </DialogTitle>
            <span className={cn(
              'shrink-0 text-[10px] rounded-full px-2.5 py-1 font-medium',
              isSubmitted
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
            )}>
              {isSubmitted ? 'Soumis' : 'À compléter'}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Animation info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Calendar, label: 'Date', value: anim ? formatDateTime(anim.scheduled_at) : '—' },
              { icon: Sword, label: 'Pôle', value: report.pole === 'mj' ? 'Maître du Jeu' : 'Animateur' },
              { icon: Clock, label: 'Durée prévue', value: anim ? formatDuration(anim.planned_duration_min) : '—' },
              { icon: Clock, label: 'Durée réelle', value: anim?.actual_duration_min ? formatDuration(anim.actual_duration_min) : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3 w-3 text-white/30" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-sm text-white/80 font-medium">{value}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          {anim && (
            <div className="flex items-center gap-2 flex-wrap">
              <ServerBadge server={anim.server} />
              <VillageBadge village={anim.village} />
            </div>
          )}

          <div className="border-t border-white/[0.06]" />

          {/* Editable section */}
          {isSubmitted && !editing ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Personnage joué</p>
                <p className="text-sm text-white/80">
                  {report.character_name || <span className="text-white/25 italic">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Commentaires</p>
                <p className="text-sm text-white/70 whitespace-pre-wrap">
                  {report.comments || <span className="text-white/25 italic">Aucun commentaire</span>}
                </p>
              </div>
              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-white/25">
                  Soumis le {formatDate(report.submitted_at!)}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5 text-xs">
                  <Edit2 className="h-3.5 w-3.5" />
                  Modifier
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-white/50">
                  Personnage joué <span className="text-red-400">*</span>
                </p>
                <Input
                  placeholder="Nom de ton personnage"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  autoFocus={!isSubmitted}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-white/50">Commentaires</p>
                <Textarea
                  placeholder="Décris le déroulé de l'animation, les points positifs et négatifs..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                />
              </div>
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
      </DialogContent>
    </Dialog>
  )
}

// ─── Report row ───────────────────────────────────────────────────────────────

function ReportRow({ report, onClick }: { report: AnimationReport; onClick: () => void }) {
  const submitted = !!report.submitted_at
  const anim = report.animation

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all group"
    >
      {submitted ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate group-hover:text-white/95 transition-colors">
          {anim?.title ?? 'Animation'}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {anim?.scheduled_at && (
            <span className="text-xs text-white/30">{formatDateTime(anim.scheduled_at)}</span>
          )}
          {anim?.village && <VillageBadge village={anim.village} />}
          {anim?.server && <ServerBadge server={anim.server} />}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:block text-[10px] text-white/30 uppercase">
          {report.pole === 'mj' ? 'MJ' : 'Anim.'}
        </span>
        <span className={cn(
          'text-[10px] rounded-full px-2 py-0.5 font-medium',
          submitted
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-amber-400 bg-amber-500/10',
        )}>
          {submitted ? 'Soumis' : 'À compléter'}
        </span>
        <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
      </div>
    </button>
  )
}

// ─── Week group ───────────────────────────────────────────────────────────────

interface WeekGroup {
  weekStart: Date
  weekEnd: Date
  reports: AnimationReport[]
}

function WeekSection({ group, onSelect }: { group: WeekGroup; onSelect: (r: AnimationReport) => void }) {
  const pending = group.reports.filter((r) => !r.submitted_at).length
  const total = group.reports.length

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          {formatWeekLabel(group.weekStart, group.weekEnd)}
        </p>
        <span className={cn(
          'text-[10px] tabular-nums',
          pending > 0 ? 'text-amber-400' : 'text-emerald-400/60',
        )}>
          {pending > 0 ? `${total - pending}/${total} soumis` : `${total}/${total} soumis`}
        </span>
      </div>

      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden p-1">
        {group.reports.map((report) => (
          <ReportRow key={report.id} report={report} onClick={() => onSelect(report)} />
        ))}
      </GlassCard>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Reports() {
  const { data: reports, isLoading } = useMyReports()
  const [selected, setSelected] = useState<AnimationReport | null>(null)

  const pendingCount = reports?.filter((r) => !r.submitted_at).length ?? 0

  const grouped = useMemo<WeekGroup[]>(() => {
    if (!reports) return []

    const map = new Map<string, WeekGroup>()

    for (const r of reports) {
      const scheduledAt = r.animation?.scheduled_at
      if (!scheduledAt) continue

      const bounds = getWeekBoundsFor(new Date(scheduledAt))
      const key = bounds.start.toISOString()

      if (!map.has(key)) {
        map.set(key, { weekStart: bounds.start, weekEnd: bounds.end, reports: [] })
      }
      map.get(key)!.reports.push(r)
    }

    // Newest week first, within each week: pending first then by date desc
    return Array.from(map.values())
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .map((g) => ({
        ...g,
        reports: [...g.reports].sort((a, b) => {
          const aPending = !a.submitted_at ? 0 : 1
          const bPending = !b.submitted_at ? 0 : 1
          if (aPending !== bPending) return aPending - bPending
          const aDate = a.animation?.scheduled_at ?? ''
          const bDate = b.animation?.scheduled_at ?? ''
          return bDate.localeCompare(aDate)
        }),
      }))
  }, [reports])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
          <FileText className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Mes rapports</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} rapport${pendingCount > 1 ? 's' : ''} en attente`
              : reports && reports.length > 0
              ? 'Tous les rapports sont à jour'
              : 'Aucun rapport pour le moment'}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          {[...Array(2)].map((_, g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="h-4 w-48 rounded" />
              <GlassCard className="p-1 space-y-1">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </GlassCard>
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <FileText className="h-6 w-6 text-violet-400/50" />
          </div>
          <p className="text-sm text-white/30">Aucun rapport pour le moment</p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <WeekSection
              key={g.weekStart.toISOString()}
              group={g}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ReportModal report={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
