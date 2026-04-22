import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-white/80',
        outline: 'border border-white/20 text-white/60',
        cyan: 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20',
        green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        red: 'bg-red-500/10 text-red-400 border border-red-500/20',
        orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
        gray: 'bg-white/5 text-white/40 border border-white/10',
        blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        violet: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
        gold: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
