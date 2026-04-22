import { cn } from '@/lib/utils/cn'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function GlassCard({ className, children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass rounded-2xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
