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
        'inline-flex items-center justify-center text-[10px] font-bold leading-none select-none',
        gender === 'femme' ? 'text-pink-400' : 'text-blue-400',
        className,
      )}
      aria-label={gender === 'femme' ? 'Femme' : 'Homme'}
    >
      {gender === 'femme' ? '♀' : '♂'}
    </span>
  )
}
