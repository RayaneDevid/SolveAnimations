import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { useAnimations } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { WeekGrid } from '@/components/calendar/WeekGrid'
import { WeekNavigator } from '@/components/calendar/WeekNavigator'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Calendar() {
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()

  const { data, isLoading } = useAnimations({
    from: bounds.start.toISOString(),
    to: bounds.end.toISOString(),
    pageSize: 100,
  })

  const animations = data?.animations ?? []

  return (
    <div className="p-6 space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendrier RP</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Journées 18h → 03h/04h, semaine samedi → samedi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WeekNavigator
            weekStart={bounds.start}
            weekEnd={bounds.end}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
            isCurrentWeek={isCurrentWeek()}
          />
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/panel/animations/new">
              <Plus className="h-3.5 w-3.5" />
              Créer
            </Link>
          </Button>
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <WeekGrid weekStart={bounds.start} animations={animations} />
        )}
      </GlassCard>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Konoha', color: 'bg-green-500/40' },
          { label: 'Suna', color: 'bg-yellow-600/40' },
          { label: 'Oto', color: 'bg-purple-800/40' },
          { label: 'Kiri', color: 'bg-teal-600/40' },
          { label: 'Temple', color: 'bg-pink-500/40' },
          { label: 'Autre', color: 'bg-white/20' },
          { label: 'Tout le monde', color: 'bg-gradient-to-r from-cyan-500/40 to-violet-500/40' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-sm ${l.color}`} />
            <span className="text-xs text-white/40">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
