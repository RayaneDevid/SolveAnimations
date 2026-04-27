import { cn } from '@/lib/utils/cn'
import { getRoleLabel, type StaffRoleKey } from '@/lib/config/discord'

interface RoleBadgeProps {
  role: StaffRoleKey
  gender?: 'homme' | 'femme' | 'autre' | null
  className?: string
  size?: 'sm' | 'md'
}

const ROLE_STYLES: Record<StaffRoleKey, string> = {
  direction: 'bg-slate-100/15 text-slate-100 border-slate-100/25',
  gerance: 'bg-purple-400/15 text-purple-400 border-purple-400/25',
  responsable: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  responsable_mj: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  senior: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  mj_senior: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  animateur: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  mj: 'bg-red-500/15 text-red-400 border-red-500/25',
}

export function RoleBadge({ role, gender, className, size = 'sm' }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        ROLE_STYLES[role],
        className,
      )}
    >
      {getRoleLabel(role, gender)}
    </span>
  )
}
