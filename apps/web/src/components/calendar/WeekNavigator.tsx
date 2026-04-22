import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { Button } from '@/components/ui/button'

const TZ = 'Europe/Paris'

interface WeekNavigatorProps {
  weekStart: Date
  weekEnd: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  isCurrentWeek: boolean
}

export function WeekNavigator({
  weekStart,
  weekEnd,
  onPrev,
  onNext,
  onToday,
  isCurrentWeek,
}: WeekNavigatorProps) {
  const startP = toZonedTime(weekStart, TZ)
  const endP = toZonedTime(weekEnd, TZ)
  const label = `${format(startP, 'dd/MM', { locale: fr })} – ${format(endP, 'dd/MM', { locale: fr })}`

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[130px] text-center">
        <span className="text-sm font-medium text-white/80">{label}</span>
      </div>
      <Button variant="outline" size="icon" onClick={onNext} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentWeek && (
        <Button variant="ghost" size="sm" onClick={onToday} className="gap-1.5 text-xs">
          <CalendarCheck className="h-3.5 w-3.5" />
          Aujourd'hui
        </Button>
      )}
    </div>
  )
}
