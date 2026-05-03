import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Briefcase, CalendarCheck, ChevronLeft, ChevronRight, Plus, Users, Swords, Dice5 } from 'lucide-react'
import { addDays, format, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAnimations, useCalendarAvailability } from '@/hooks/queries/useAnimations'
import { useCurrentWeek } from '@/hooks/useCurrentWeek'
import { useRequiredAuth } from '@/hooks/useAuth'
import { WeekGrid } from '@/components/calendar/WeekGrid'
import { WeekNavigator } from '@/components/calendar/WeekNavigator'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { rpDayFromDate } from '@/lib/utils/calendar'

type CalendarMode = 'week' | 'day'
type PoleFilter = 'all' | 'animation' | 'mj' | 'bdm'

function dateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function minuteISOString(date = new Date()): string {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)
  return rounded.toISOString()
}

function rpDayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day)
  start.setHours(4, 0, 0, 0)
  const end = addDays(start, 1)
  return { start, end }
}

export default function Calendar() {
  const { user } = useRequiredAuth()
  const { bounds, goNext, goPrev, goToday, isCurrentWeek } = useCurrentWeek()
  const [mode, setMode] = useState<CalendarMode>('day')
  const [poleFilter, setPoleFilter] = useState<PoleFilter>(() => user.pay_pole ?? 'all')
  const [selectedDay, setSelectedDay] = useState(() => dateInputValue(rpDayFromDate(new Date())))
  const [availabilityAt, setAvailabilityAt] = useState(() => minuteISOString())

  useEffect(() => {
    const id = window.setInterval(() => setAvailabilityAt(minuteISOString()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const selectedDayDate = useMemo(() => dateFromInput(selectedDay), [selectedDay])
  const dayBounds = useMemo(() => rpDayBounds(selectedDayDate), [selectedDayDate])
  const queryBounds = mode === 'week' ? bounds : dayBounds

  const { data, isLoading } = useAnimations({
    from: queryBounds.start.toISOString(),
    to: queryBounds.end.toISOString(),
    status: ['pending_validation', 'open', 'preparing', 'running', 'finished', 'postponed'],
    pageSize: 100,
  })

  const allAnimations = data?.animations ?? []
  const animations = useMemo(() => {
    if (poleFilter === 'all') return allAnimations
    if (poleFilter === 'bdm') return allAnimations.filter((a) => a.bdm_mission)
    return allAnimations.filter((a) => a.pole === poleFilter || a.pole === 'les_deux')
  }, [allAnimations, poleFilter])
  const todayRpDay = rpDayFromDate(new Date())
  const isSelectedToday = isSameDay(selectedDayDate, todayRpDay)
  const availabilityAtDate = new Date(availabilityAt)
  const availabilityDayDate = todayRpDay
  const availabilityBounds = rpDayBounds(availabilityDayDate)
  const availabilityDay = dateInputValue(availabilityDayDate)
  const { data: availability, isLoading: availabilityLoading } = useCalendarAvailability({
    day: availabilityDay,
    from: availabilityBounds.start.toISOString(),
    to: availabilityBounds.end.toISOString(),
    at: availabilityAt,
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
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2"
            title={`${availability?.activeAnimationCount ?? 0} animation(s) occupante(s) à ${format(availabilityAtDate, 'HH:mm')} le ${format(availabilityDayDate, 'dd/MM/yyyy', { locale: fr })}`}
          >
            <Users className="h-4 w-4 text-cyan-400" />
            {[
              {
                label: 'Anim',
                icon: Swords,
                color: 'text-cyan-300',
                value: availability?.byPole.animation,
              },
              {
                label: 'MJ',
                icon: Dice5,
                color: 'text-rose-300',
                value: availability?.byPole.mj,
              },
            ].map(({ label, icon: Icon, color, value }) => (
              <div key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 py-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="text-xs font-semibold text-white/90">
                  {availabilityLoading ? '...' : `${value?.occupiedCount ?? 0}/${value?.presentCount ?? 0}`}
                </span>
                <span className="text-[10px] font-medium text-white/40">{label}</span>
              </div>
            ))}
          </div>

          <Tabs value={poleFilter} onValueChange={(v) => setPoleFilter(v as PoleFilter)}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="animation">
                <Swords className="h-3.5 w-3.5 mr-1" />Anim
              </TabsTrigger>
              <TabsTrigger value="mj">
                <Dice5 className="h-3.5 w-3.5 mr-1" />MJ
              </TabsTrigger>
              <TabsTrigger value="bdm">
                <Briefcase className="h-3.5 w-3.5 mr-1" />BDM
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
          { label: 'Mission BDM', color: 'bg-teal-500/40 border border-teal-300/70 border-dashed' },
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
