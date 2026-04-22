import { useState, useEffect, useCallback } from 'react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'

interface RpDateTimePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  error?: string
}

// Fri (5), Sat (6), Sun (0) → session ends at 04:00 the next morning
const EXTENDED_NIGHTS = new Set([0, 5, 6])

function maxHourForDate(date: Date): number {
  return EXTENDED_NIGHTS.has(date.getDay()) ? 4 : 3
}

function generateTimeSlots(maxH: number): string[] {
  const slots: string[] = []
  for (let h = 18; h <= 23; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  for (let h = 0; h <= maxH; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === maxH && m > 0) break
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

// Times before 18:00 are "next day" (00:00–04:00 belong to the following calendar day)
function buildDate(sessionDate: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const result = h < 18 ? addDays(sessionDate, 1) : new Date(sessionDate)
  result.setHours(h, m, 0, 0)
  return result
}

// Given a full scheduledAt, recover the session date + time string
function decompose(value: Date): { sessionDate: Date; time: string } {
  const h = value.getHours()
  const m = value.getMinutes()
  const sessionDate = new Date(h < 18 ? addDays(value, -1) : value)
  sessionDate.setHours(0, 0, 0, 0)
  const roundedM = Math.round(m / 10) * 10
  const time = `${String(h).padStart(2, '0')}:${String(Math.min(roundedM, 59)).padStart(2, '0')}`
  return { sessionDate, time }
}

// yyyy-MM-dd for the native date input
function toDateInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function RpDateTimePicker({ value, onChange, error }: RpDateTimePickerProps) {
  const initial = value ? decompose(value) : null

  const [dateStr, setDateStr] = useState<string>(
    initial ? toDateInputValue(initial.sessionDate) : '',
  )
  const [time, setTime] = useState<string>(initial?.time ?? '21:00')

  const sessionDate = dateStr ? new Date(dateStr + 'T12:00:00') : undefined
  const maxH = sessionDate ? maxHourForDate(sessionDate) : 3
  const slots = generateTimeSlots(maxH)

  // Clamp time if the extended-night slot is no longer available (e.g. switched to a regular day)
  const effectiveTime = slots.includes(time) ? time : `0${maxH}:00`

  const emit = useCallback(
    (d: Date | undefined, t: string) => {
      if (!d) { onChange(undefined); return }
      onChange(buildDate(d, t))
    },
    [onChange],
  )

  // Emit whenever date or time changes
  useEffect(() => {
    emit(sessionDate, effectiveTime)
    if (!slots.includes(time)) setTime(`0${maxH}:00`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, effectiveTime])

  const todayStr = toDateInputValue(new Date())

  const isAfterMidnight = (t: string) => parseInt(t.split(':')[0]) < 18

  const dayLabel = sessionDate
    ? format(sessionDate, 'EEEE d MMMM', { locale: fr })
    : null

  const actualDay = sessionDate && isAfterMidnight(effectiveTime)
    ? format(addDays(sessionDate, 1), 'EEEE d MMMM', { locale: fr })
    : dayLabel

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Date picker */}
        <div className="flex-1 relative">
          <input
            type="date"
            value={dateStr}
            min={todayStr}
            onChange={(e) => setDateStr(e.target.value)}
            className={cn(
              'w-full px-3 py-2 rounded-lg border text-sm bg-white/[0.03] text-white/90 focus:outline-none focus:border-cyan-500/50 transition-colors [color-scheme:dark]',
              dateStr ? 'border-white/[0.15]' : 'border-white/[0.08]',
            )}
          />
        </div>

        {/* Time picker */}
        <select
          value={effectiveTime}
          onChange={(e) => {
            setTime(e.target.value)
            emit(sessionDate, e.target.value)
          }}
          className="w-28 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white/90 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark] cursor-pointer"
        >
          <optgroup label="Soirée" className="bg-[#0A0B0F]">
            {slots.filter((s) => !isAfterMidnight(s)).map((s) => (
              <option key={s} value={s} className="bg-[#1a1b1f]">{s}</option>
            ))}
          </optgroup>
          <optgroup label="Nuit" className="bg-[#0A0B0F]">
            {slots.filter((s) => isAfterMidnight(s)).map((s) => (
              <option key={s} value={s} className="bg-[#1a1b1f]">{s}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Info line */}
      {sessionDate && (
        <p className="text-xs text-white/30 capitalize">
          {isAfterMidnight(effectiveTime)
            ? <>Session du {dayLabel} · débute le {actualDay} à {effectiveTime}</>
            : <>Session du {dayLabel} · fin de session à {maxH === 4 ? '04:00' : '03:00'}</>
          }
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
