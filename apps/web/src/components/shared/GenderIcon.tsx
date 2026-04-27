import { cn } from '@/lib/utils/cn'

interface GenderIconProps {
  gender: 'homme' | 'femme' | 'autre' | null | undefined
  className?: string
}

function MarsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <circle cx="6.5" cy="9.5" r="4" stroke="currentColor" strokeWidth="1.6" />
      <line x1="9.5" y1="6.5" x2="13.5" y2="2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="10.5" y1="2.5" x2="13.5" y2="2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="13.5" y1="2.5" x2="13.5" y2="5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function VenusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <circle cx="8" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.6" />
      <line x1="8" y1="10.5" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="5.5" y1="12.5" x2="10.5" y2="12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function GenderIcon({ gender, className }: GenderIconProps) {
  if (!gender) return null
  if (gender === 'autre') return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 h-4 w-4',
        gender === 'femme' ? 'text-pink-400' : 'text-blue-400',
        className,
      )}
      aria-label={gender === 'femme' ? 'Femme' : 'Homme'}
    >
      {gender === 'femme' ? <VenusIcon /> : <MarsIcon />}
    </span>
  )
}
