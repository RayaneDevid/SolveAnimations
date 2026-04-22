import { cn } from '@/lib/utils/cn'
import type { AnimationServer } from '@/lib/schemas/animation'

interface ServerBadgeProps {
  server: AnimationServer
  className?: string
}

export function ServerBadge({ server, className }: ServerBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-white/[0.07] border border-white/[0.12] px-2 py-0.5 text-xs font-mono font-semibold text-white/80',
        className,
      )}
    >
      {server}
    </span>
  )
}
