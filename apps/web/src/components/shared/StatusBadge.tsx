import { cn } from '@/lib/utils/cn'
import type { AnimationStatus } from '@/types/database'

interface StatusBadgeProps {
  status: AnimationStatus
  className?: string
}

export const STATUS_LABELS: Record<AnimationStatus, string> = {
  pending_validation: 'En attente',
  open: 'Ouverte',
  running: 'En cours',
  finished: 'Terminée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
  postponed: 'Reportée',
}

const STATUS_STYLES: Record<AnimationStatus, string> = {
  pending_validation: 'bg-white/[0.06] text-white/50 border-white/[0.1]',
  open: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  running: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  finished: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
  cancelled: 'bg-white/[0.04] text-white/30 border-white/[0.08]',
  postponed: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
}

const STATUS_DOT: Record<AnimationStatus, string> = {
  pending_validation: 'bg-white/30',
  open: 'bg-cyan-400',
  running: 'bg-emerald-400 animate-pulse',
  finished: 'bg-violet-400',
  rejected: 'bg-red-400',
  cancelled: 'bg-white/20',
  postponed: 'bg-orange-400',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  )
}
