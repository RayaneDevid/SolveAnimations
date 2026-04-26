import { useMemo, useRef } from 'react'
import { format, addDays, isSameDay } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Animation } from '@/types/database'
import { rpDayFromDate, sessionEndHour } from '@/lib/utils/calendar'
import { AnimationBlock } from './AnimationBlock'
import { cn } from '@/lib/utils/cn'

const TZ = 'Europe/Paris'
const PX_PER_MIN = 1.2
const DAY_VIEW_PX_PER_MIN = 2.4
const SESSION_START = 18 // 18:00

// Week column order: Sat, Sun, Mon, Tue, Wed, Thu, Fri
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5] // JS getDay()
const DAY_SHORT = ['Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
const DAY_SHORT_BY_DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface AnimationLayout {
  animation: Animation
  lane: number
  totalLanes: number
}

function computeLayout(anims: Animation[]): AnimationLayout[] {
  if (anims.length === 0) return []

  const events = anims
    .map((a) => {
      const prep = (a.prep_time_min ?? 0) * 60 * 1000
      const scheduledMs = new Date(a.scheduled_at).getTime()
      return {
        animation: a,
        start: scheduledMs - prep,
        end: scheduledMs + a.planned_duration_min * 60 * 1000,
      }
    })
    .sort((a, b) => a.start - b.start)

  // Split into clusters of overlapping animations (connected components)
  const clusters: (typeof events)[] = []
  let current: typeof events = []
  let clusterEnd = -Infinity

  for (const ev of events) {
    if (ev.start < clusterEnd) {
      current.push(ev)
      clusterEnd = Math.max(clusterEnd, ev.end)
    } else {
      if (current.length > 0) clusters.push(current)
      current = [ev]
      clusterEnd = ev.end
    }
  }
  if (current.length > 0) clusters.push(current)

  const result: AnimationLayout[] = []

  for (const cluster of clusters) {
    const laneEnds: number[] = []

    for (const ev of cluster) {
      let lane = laneEnds.findIndex((end) => end <= ev.start)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = ev.end
      result.push({ animation: ev.animation, lane, totalLanes: 0 })
    }

    const totalLanes = laneEnds.length
    for (const item of result.slice(result.length - cluster.length)) {
      item.totalLanes = totalLanes
    }
  }

  return result
}

interface WeekGridProps {
  weekStart: Date // saturday 04:00 Europe/Paris
  animations: Animation[]
  day?: Date
}

function buildHourLabels(endHour: 3 | 4): number[] {
  // from 18 to endHour (next day)
  const hours: number[] = []
  for (let h = SESSION_START; h < 24; h++) hours.push(h)
  for (let h = 0; h <= endHour; h++) hours.push(h)
  return hours
}

function columnHeightMin(endHour: 3 | 4): number {
  return (24 - SESSION_START + endHour) * 60
}

export function WeekGrid({ weekStart, animations, day }: WeekGridProps) {
  const nowRef = useRef<HTMLDivElement>(null)
  const pxPerMin = day ? DAY_VIEW_PX_PER_MIN : PX_PER_MIN

  // Group animations by RP day
  const byDay = useMemo(() => {
    const map: Record<string, Animation[]> = {}
    for (const a of animations) {
      const rpDay = rpDayFromDate(new Date(a.scheduled_at))
      const key = format(rpDay, 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(a)
    }
    return map
  }, [animations])

  // Column dates in order (Sat, Sun, ..., Fri), or one selected RP day.
  // weekStart is Saturday 04:00 Paris time
  const weekStartParis = toZonedTime(weekStart, TZ)
  const columns = day
    ? (() => {
      const date = toZonedTime(day, TZ)
      const dow = date.getDay()
      return [{ date, dow, label: DAY_SHORT_BY_DOW[dow] }]
    })()
    : DAY_ORDER.map((dow, i) => {
      // weekStart is Saturday = 0, Sunday = +1, ..., Friday = +6
      const date = addDays(weekStartParis, i)
      return { date, dow, label: DAY_SHORT[i] }
    })

  const now = new Date()
  const nowParis = toZonedTime(now, TZ)
  const nowMins = nowParis.getHours() * 60 + nowParis.getMinutes()
  const isSessionTime = nowMins >= SESSION_START * 60 || nowMins <= 4 * 60
  const nowTop = isSessionTime
    ? nowMins >= SESSION_START * 60
      ? (nowMins - SESSION_START * 60) * pxPerMin
      : (24 * 60 - SESSION_START * 60 + nowMins) * pxPerMin
    : -1

  // Shared hour axis (use Fri hours = 04:00 end for max)
  const hourLabels = buildHourLabels(4)
  const maxHeight = columnHeightMin(4) * pxPerMin

  return (
    <div className="flex overflow-x-auto">
      {/* Time axis */}
      <div className="shrink-0 w-12 pt-10">
        <div className="relative" style={{ height: maxHeight }}>
          {hourLabels.map((h) => {
            const top = ((h >= SESSION_START ? h - SESSION_START : 24 - SESSION_START + h) * 60) * pxPerMin
            return (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-white/25 -translate-y-1/2"
                style={{ top }}
              >
                {String(h).padStart(2, '0')}h
              </div>
            )
          })}
        </div>
      </div>

      {/* Columns */}
      {columns.map(({ date, dow, label }) => {
        const endHour = sessionEndHour(dow)
        const colHeight = columnHeightMin(endHour) * pxPerMin
        const dateKey = format(date, 'yyyy-MM-dd')
        const dayAnims = byDay[dateKey] ?? []
        const isToday = isSameDay(date, nowParis)

        return (
          <div key={dateKey} className={cn('flex-1', day ? 'min-w-[720px]' : 'min-w-[90px]')}>
            {/* Header */}
            <div
              className={cn(
                'h-10 flex flex-col items-center justify-center border-b border-white/[0.06]',
                isToday && 'text-cyan-400',
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {label}
              </p>
              <p className={cn('text-sm font-bold', isToday ? 'text-cyan-400' : 'text-white/70')}>
                {format(date, 'd')}
              </p>
            </div>

            {/* Column body */}
            <div
              className="relative border-r border-white/[0.04]"
              style={{ height: maxHeight }}
            >
              {/* Hour grid lines */}
              {hourLabels.map((h) => {
                const top = ((h >= SESSION_START ? h - SESSION_START : 24 - SESSION_START + h) * 60) * pxPerMin
                return (
                  <div
                    key={h}
                    className="absolute w-full border-t border-white/[0.04]"
                    style={{ top }}
                  />
                )
              })}

              {/* Out-of-session area (after column endHour) */}
              {endHour < 4 && (
                <div
                  className="absolute w-full bg-white/[0.01] border-t border-white/[0.04]"
                  style={{
                    top: colHeight,
                    bottom: 0,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.01) 4px, rgba(255,255,255,0.01) 8px)',
                  }}
                />
              )}

              {/* Now indicator */}
              {isToday && nowTop >= 0 && nowTop <= colHeight && (
                <div
                  ref={nowRef}
                  className="absolute w-full z-10 flex items-center"
                  style={{ top: nowTop }}
                >
                  <div className="h-2 w-2 rounded-full bg-red-400 shrink-0 -ml-1" />
                  <div className="flex-1 h-[1px] bg-red-400/60" />
                </div>
              )}

              {/* Animations */}
              {computeLayout(dayAnims).map(({ animation, lane, totalLanes }) => (
                <AnimationBlock
                  key={animation.id}
                  animation={animation}
                  lane={lane}
                  totalLanes={totalLanes}
                  pxPerMin={pxPerMin}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
