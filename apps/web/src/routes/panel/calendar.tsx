import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react'
import { addDays, format, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAnimations, useCalendarAvailability } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { WeekGrid } from '@/components/calendar/WeekGrid'
import { WeekNavigator } from '@/components/calendar/WeekNavigator'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { rpDayFromDate } from '@/lib/utils/calendar'

type CalendarMode = 'week' | 'day'

function dateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function rpDayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day)
  start.setHours(4, 0, 0, 0)
  const end = addDays(start, 1)
  return { start, end }
}

export default function Calendar() {
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const [mode, setMode] = useState<CalendarMode>('week')
  const [selectedDay, setSelectedDay] = useState(() => dateInputValue(rpDayFromDate(new Date())))

  const selectedDayDate = useMemo(() => dateFromInput(selectedDay), [selectedDay])
  const dayBounds = useMemo(() => rpDayBounds(selectedDayDate), [selectedDayDate])
  const queryBounds = mode === 'week' ? bounds : dayBounds

  const { data, isLoading } = useAnimations({
    from: queryBounds.start.toISOString(),
    to: queryBounds.end.toISOString(),
    status: ['pending_validation', 'open', 'preparing', 'running', 'finished', 'postponed'],
    pageSize: 100,
  })

  const animations = data?.animations ?? []
  const todayRpDay = rpDayFromDate(new Date())
  const isSelectedToday = isSameDay(selectedDayDate, todayRpDay)
  const availabilityDayDate = mode === 'day'
    ? selectedDayDate
    : isCurrentWeek()
      ? todayRpDay
      : rpDayFromDate(bounds.start)
  const availabilityBounds = rpDayBounds(availabilityDayDate)
  const availabilityDay = dateInputValue(availabilityDayDate)
  const { data: availability, isLoading: availabilityLoading } = useCalendarAvailability({
    day: availabilityDay,
    from: availabilityBounds.start.toISOString(),
    to: availabilityBounds.end.toISOString(),
  })

  const goPrevDay = () => setSelectedDay(dateInputValue(addDays(selectedDayDate, -1)))
  const goNextDay = () => setSelectedDay(dateInputValue(addDays(selectedDayDate, 1)))
  const goTodayDay = () => setSelectedDay(dateInputValue(todayRpDay))

  return (
    <div className="p-6 space-y-4 max-w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendrier RP</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Journées 18h → 03h/04h, semaine samedi → samedi
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div
            className="h-9 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3"
            title={`${availability?.activeAnimationCount ?? 0} animation(s) ouverte(s), en débrief ou en cours sur la session du ${format(availabilityDayDate, 'dd/MM/yyyy', { locale: fr })}`}
          >
            <Users className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white/90">
              {availabilityLoading
                ? '...'
                : `${availability?.occupiedCount ?? 0} / ${availability?.presentCount ?? 0}`}
            </span>
            <span className="text-xs text-white/45">
              occupés
            </span>
          </div>

          <Tabs value={mode} onValueChange={(value) => setMode(value as CalendarMode)}>
            <TabsList>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="day">Jour</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'week' ? (
            <WeekNavigator
              weekStart={bounds.start}
              weekEnd={bounds.end}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
              isCurrentWeek={isCurrentWeek()}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goPrevDay} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="h-8 w-[150px]"
              />
              <Button variant="outline" size="icon" onClick={goNextDay} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isSelectedToday && (
                <Button variant="ghost" size="sm" onClick={goTodayDay} className="gap-1.5 text-xs">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Aujourd'hui
                </Button>
              )}
            </div>
          )}

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
          <WeekGrid
            weekStart={bounds.start}
            animations={animations}
            day={mode === 'day' ? selectedDayDate : undefined}
          />
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
          { label: 'Nukenin', color: 'bg-white/20' },
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
