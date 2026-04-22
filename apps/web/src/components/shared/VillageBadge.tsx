import { cn } from '@/lib/utils/cn'
import type { Village } from '@/lib/schemas/animation'

interface VillageBadgeProps {
  village: Village
  className?: string
}

export const VILLAGE_LABELS: Record<Village, string> = {
  konoha: 'Konoha',
  suna: 'Suna',
  oto: 'Oto',
  kiri: 'Kiri',
  temple_camelias: 'Temple des Camélias',
  autre: 'Autre',
  tout_le_monde: 'Tout le monde',
}

const VILLAGE_STYLES: Record<Village, string> = {
  konoha: 'bg-green-500/15 text-green-400 border-green-500/25',
  suna: 'bg-yellow-600/15 text-yellow-500 border-yellow-600/25',
  oto: 'bg-purple-800/20 text-purple-300 border-purple-800/30',
  kiri: 'bg-teal-600/15 text-teal-400 border-teal-600/25',
  temple_camelias: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  autre: 'bg-white/5 text-white/50 border-white/10',
  tout_le_monde: 'bg-gradient-to-r from-cyan-500/10 to-violet-500/10 text-white/80 border-white/15',
}

export function VillageBadge({ village, className }: VillageBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        VILLAGE_STYLES[village],
        className,
      )}
    >
      {VILLAGE_LABELS[village]}
    </span>
  )
}
