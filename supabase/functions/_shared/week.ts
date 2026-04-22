// Returns the current admin week bounds (Saturday 04:00 Europe/Paris)
// Mirrors the SQL week_start() / week_end() functions for use in Edge Functions.

export function weekStartFor(ts: Date = new Date()): Date {
  // Convert to Europe/Paris
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(ts).map(({ type, value }) => [type, value])
  )
  const localDate = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  )

  const dow = localDate.getDay() // 0=Sun … 6=Sat
  const daysSinceSat = (dow + 1) % 7
  const anchor = new Date(localDate)
  anchor.setDate(anchor.getDate() - daysSinceSat)
  anchor.setHours(4, 0, 0, 0)

  if (anchor > localDate) {
    anchor.setDate(anchor.getDate() - 7)
  }

  // Convert back to UTC
  return new Date(
    new Date(`${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}T${String(anchor.getHours()).padStart(2, '0')}:00:00`)
      .toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  )
}

export function weekEndFor(ts: Date = new Date()): Date {
  const start = weekStartFor(ts)
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
}

export function currentWeekBounds() {
  const start = weekStartFor()
  const end = weekEndFor()
  return { start: start.toISOString(), end: end.toISOString() }
}
