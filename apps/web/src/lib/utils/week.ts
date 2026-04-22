import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { addDays, subDays, startOfDay } from 'date-fns'

const TZ = 'Europe/Paris'

export function getCurrentWeekBounds(): { start: Date; end: Date } {
  return getWeekBoundsFor(new Date())
}

export function getWeekBoundsFor(ts: Date): { start: Date; end: Date } {
  const local = toZonedTime(ts, TZ)
  const dow = local.getDay() // 0=Sun … 6=Sat
  const daysSinceSat = (dow + 1) % 7 // 0 if Sat, 1 if Sun, …
  let anchor = startOfDay(subDays(local, daysSinceSat))
  // anchor at 04:00
  anchor = new Date(anchor.getTime() + 4 * 60 * 60 * 1000)
  // if anchor is still in the future vs local, go back 7 days
  if (anchor > local) {
    anchor = subDays(anchor, 7)
  }
  const start = fromZonedTime(anchor, TZ)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start, end }
}

export function getNextWeekBounds(current: { start: Date; end: Date }): { start: Date; end: Date } {
  return { start: current.end, end: addDays(current.end, 7) }
}

export function getPrevWeekBounds(current: { start: Date; end: Date }): { start: Date; end: Date } {
  const start = subDays(current.start, 7)
  return { start, end: current.start }
}
