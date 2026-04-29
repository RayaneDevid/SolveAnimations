import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ScrollText, Plus, ExternalLink, User, Users, Search, Check,
  X, AlertTriangle, ChevronDown, ShieldCheck, Clock, Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMemberDirectory, useTrameReports } from '@/hooks/queries/useAnimations'
import { useCreateTrameReport, useDeleteTrameReport } from '@/hooks/mutations/useAnimationMutations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import { formatDuration } from '@/lib/utils/format'
import { hasRole } from '@/lib/config/discord'
import type { TrameReport } from '@/types/database'

const createTrameSchema = z.object({
  title: z.string().trim().min(3, 'Titre requis (min 3 caractères)').max(120),
  documentUrl: z.string().url('URL invalide'),
  writingTimeMin: z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z.number({ required_error: 'Temps requis' }).int('Temps invalide').min(1, 'Temps requis').max(10_080, 'Temps trop long'),
  ),
  validatedBy: z.string().trim().min(2, 'Validateur requis').max(64),
})

type CreateTrameFormValues = z.infer<typeof createTrameSchema>

// ─── Trame card ───────────────────────────────────────────────────────────────

function TrameCard({
  report,
  canDelete,
  onDelete,
}: {
  report: TrameReport
  canDelete: boolean
  onDelete: (report: TrameReport) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
    >
      <GlassCard className="p-4 hover:border-white/[0.14] transition-colors">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white/90 truncate">{report.title}</h3>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {report.author && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-white/30 shrink-0" />
                  <UserAvatar avatarUrl={report.author.avatar_url} username={report.author.username} size="xs" />
                  <span className="text-xs text-white/50">{report.author.username}</span>
                </div>
              )}

              {report.co_authors && report.co_authors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-white/30 shrink-0" />
                  <div className="flex -space-x-1.5">
                    {report.co_authors.slice(0, 4).map((ca) => (
                      <UserAvatar
                        key={ca.id}
                        avatarUrl={ca.avatar_url}
                        username={ca.username}
                        size="xs"
                        className="ring-1 ring-[#0D0E14]"
                      />
                    ))}
                  </div>
                  {report.co_authors.length > 4 && (
                    <span className="text-xs text-white/30">+{report.co_authors.length - 4}</span>
                  )}
                  <span className="text-xs text-white/30">
                    {report.co_authors.map((ca) => ca.username).join(', ')}
                  </span>
                </div>
              )}

              {report.validated_by && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-white/30 shrink-0" />
                  <span className="text-xs text-white/50">{report.validated_by}</span>
                </div>
              )}

              {report.writing_time_min != null && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-white/30 shrink-0" />
                  <span className="text-xs text-white/50">{formatDuration(report.writing_time_min)}</span>
                </div>
              )}

              <span className="text-xs text-white/25">
                {format(new Date(report.created_at), 'd MMM yyyy', { locale: fr })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={report.document_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/10 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Document
            </a>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(report)}
                className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                title="Supprimer le document"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateTrameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useRequiredAuth()
  const { data: members = [] } = useMemberDirectory()
  const { mutateAsync, isPending } = useCreateTrameReport()

  const [coAuthorIds, setCoAuthorIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberListOpen, setMemberListOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTrameFormValues>({
    resolver: zodResolver(createTrameSchema),
  })

  const eligibleMembers = useMemo(() => {
    const q = memberSearch.toLowerCase()
    return members.filter(
      (m) => m.id !== user.id && m.username.toLowerCase().includes(q),
    )
  }, [members, memberSearch, user.id])

  const selectedMembers = useMemo(
    () => members.filter((m) => coAuthorIds.includes(m.id)),
    [members, coAuthorIds],
  )

  const toggleCoAuthor = (id: string) => {
    setCoAuthorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleClose = () => {
    reset()
    setCoAuthorIds([])
    setMemberSearch('')
    setMemberListOpen(false)
    onClose()
  }

  const onSubmit = async (data: CreateTrameFormValues) => {
    try {
      await mutateAsync({
        title: data.title,
        documentUrl: data.documentUrl,
        writingTimeMin: data.writingTimeMin,
        coAuthorIds,
        validatedBy: data.validatedBy,
      })
      toast.success('Rapport de trame créé !')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg bg-[#0D0E14] border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ScrollText className="h-4 w-4 text-cyan-400" />
            Nouveau rapport de trame
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre de la trame</Label>
            <Input
              id="title"
              placeholder="ex. La menace Akatsuki — Arc 1"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Document URL */}
          <div className="space-y-1.5">
            <Label htmlFor="documentUrl">Lien du document</Label>
            <Input
              id="documentUrl"
              placeholder="https://docs.google.com/..."
              {...register('documentUrl')}
            />
            {errors.documentUrl && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.documentUrl.message}
              </p>
            )}
          </div>

          {/* Writing time */}
          <div className="space-y-1.5">
            <Label htmlFor="writingTimeMin">Temps d'écriture <span className="text-red-400">*</span></Label>
            <Input
              id="writingTimeMin"
              type="number"
              min={1}
              max={10080}
              placeholder="ex. 120"
              {...register('writingTimeMin')}
            />
            {errors.writingTimeMin && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.writingTimeMin.message}
              </p>
            )}
          </div>

          {/* Validated by */}
          <div className="space-y-1.5">
            <Label htmlFor="validatedBy">Validé par <span className="text-red-400">*</span></Label>
            <Input
              id="validatedBy"
              placeholder="ex. Drackar"
              {...register('validatedBy')}
            />
            {errors.validatedBy && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.validatedBy.message}
              </p>
            )}
          </div>

          {/* Co-authors */}
          <div className="space-y-1.5">
            <Label>Co-auteurs</Label>

            {/* Selected badges */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2 rounded-full text-xs bg-cyan-400/10 border border-cyan-400/20 text-cyan-300"
                  >
                    <UserAvatar avatarUrl={m.avatarUrl} username={m.username} size="xs" />
                    {m.username}
                    <button
                      type="button"
                      onClick={() => toggleCoAuthor(m.id)}
                      className="ml-0.5 text-cyan-400/60 hover:text-cyan-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Dropdown toggle */}
            <button
              type="button"
              onClick={() => setMemberListOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white/40 hover:text-white/60 hover:border-white/[0.14] transition-colors"
            >
              <span>{selectedMembers.length === 0 ? 'Sélectionner des co-auteurs...' : `${selectedMembers.length} sélectionné${selectedMembers.length > 1 ? 's' : ''}`}</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', memberListOpen && 'rotate-180')} />
            </button>

            {/* Member list */}
            {memberListOpen && (
              <div className="border border-white/[0.08] rounded-lg bg-[#0D0E14] overflow-hidden">
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-cyan-400/30"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {eligibleMembers.length === 0 ? (
                    <p className="text-xs text-white/25 text-center py-6">Aucun membre trouvé</p>
                  ) : (
                    eligibleMembers.map((m) => {
                      const checked = coAuthorIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleCoAuthor(m.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors',
                            checked && 'bg-cyan-400/5',
                          )}
                        >
                          <div className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                            checked ? 'bg-cyan-400 border-cyan-400' : 'border-white/[0.15] bg-transparent',
                          )}>
                            {checked && <Check className="h-3 w-3 text-[#0D0E14]" />}
                          </div>
                          <UserAvatar avatarUrl={m.avatarUrl} username={m.username} size="xs" />
                          <span className="text-xs text-white/70">{m.username}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4" />
              {isPending ? 'Création...' : 'Créer le rapport'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Trames() {
  const { user, role } = useRequiredAuth()
  const { data: reports, isLoading, error } = useTrameReports()
  const { mutateAsync: deleteTrame, isPending: deleting } = useDeleteTrameReport()
  const [createOpen, setCreateOpen] = useState(false)

  const handleDelete = async (report: TrameReport) => {
    if (deleting) return
    if (!confirm(`Supprimer définitivement "${report.title}" ?`)) return
    try {
      await deleteTrame(report.id)
      toast.success('Document de trame supprimé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
            <ScrollText className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Rapports trames</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {reports ? `${reports.length} rapport${reports.length !== 1 ? 's' : ''}` : 'Chargement...'}
            </p>
          </div>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau rapport
        </Button>
      </div>

      {/* Content */}
      {error ? (
        <GlassCard className="flex items-center gap-2 p-6 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Impossible de charger les rapports de trames.
        </GlassCard>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !reports || reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <ScrollText className="h-6 w-6 text-violet-400/50" />
          </div>
          <p className="text-sm font-medium text-white/40">Aucun rapport de trame</p>
          <p className="text-xs text-white/20 mt-1">Cliquez sur "Nouveau rapport" pour en créer un.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {reports.map((report) => (
              <TrameCard
                key={report.id}
                report={report}
                canDelete={report.author_id === user.id || hasRole(role, 'responsable')}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateTrameDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
