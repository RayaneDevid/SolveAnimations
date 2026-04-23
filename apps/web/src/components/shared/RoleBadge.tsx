import { cn } from '@/lib/utils/cn'
import { ROLE_LABELS, type StaffRoleKey } from '@/lib/config/discord'

interface RoleBadgeProps {
  role: StaffRoleKey
  className?: string
  size?: 'sm' | 'md'
}

const ROLE_STYLES: Record<StaffRoleKey, string> = {
  responsable: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  responsable_mj: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  senior: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  mj_senior: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  animateur: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  mj: 'bg-red-500/15 text-red-400 border-red-500/25',
}

export function RoleBadge({ role, className, size = 'sm' }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}
