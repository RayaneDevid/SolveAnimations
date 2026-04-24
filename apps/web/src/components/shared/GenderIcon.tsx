import { cn } from '@/lib/utils/cn'

interface GenderIconProps {
  gender: 'homme' | 'femme' | null | undefined
  className?: string
}

export function GenderIcon({ gender, className }: GenderIconProps) {
  if (!gender) return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-xs font-bold leading-none select-none shrink-0',
        'h-4 w-4',
        gender === 'femme'
          ? 'bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/30'
          : 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
        className,
      )}
      aria-label={gender === 'femme' ? 'Femme' : 'Homme'}
    >
      {gender === 'femme' ? '♀' : '♂'}
    </span>
  )
}
