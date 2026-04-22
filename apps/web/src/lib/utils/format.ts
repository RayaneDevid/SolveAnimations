import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const TZ = 'Europe/Paris'

export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(toZonedTime(d, TZ), fmt, { locale: fr })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd/MM/yyyy à HH:mm')
}

export function formatTime(date: Date | string): string {
  return formatDate(date, 'HH:mm')
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: fr })
}

export function formatWeekLabel(start: Date, end: Date): string {
  return `Sem. du ${formatDate(start, 'dd/MM')} 04:00 → ${formatDate(end, 'dd/MM')} 04:00`
}
