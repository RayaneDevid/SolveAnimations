import { subHours, startOfDay } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TZ = 'Europe/Paris'

export function rpDayFromDate(scheduledAt: Date): Date {
  const paris = toZonedTime(scheduledAt, TZ)
  const shifted = subHours(paris, 4)
  return startOfDay(shifted)
}

export const RP_DAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const // Sat, Sun, Mon, Tue, Wed, Thu, Fri

export const RP_WEEK_DAY_LABELS = ['Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven'] as const

export function sessionEndHour(dayOfWeek: number): 3 | 4 {
  // Friday (5), Saturday (6) and Sunday (0) sessions end at 04:00, others at 03:00
  return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6 ? 4 : 3
}

export function minutesFromSessionStart(scheduledAt: Date): number {
  const paris = toZonedTime(scheduledAt, TZ)
  const h = paris.getHours()
  const m = paris.getMinutes()
  // session starts at 18:00
  const totalMins = h * 60 + m
  const sessionStart = 18 * 60
  if (totalMins >= sessionStart) {
    return totalMins - sessionStart
  }
  // after midnight
  return 24 * 60 - sessionStart + totalMins
}
