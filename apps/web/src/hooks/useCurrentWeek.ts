import { useState } from 'react'
import { getCurrentWeekBounds, getNextWeekBounds, getPrevWeekBounds } from '@/lib/utils/week'

export function useCurrentWeek() {
  const [bounds, setBounds] = useState(getCurrentWeekBounds)

  const goNext = () => setBounds((b) => getNextWeekBounds(b))
  const goPrev = () => setBounds((b) => getPrevWeekBounds(b))
  const goToday = () => setBounds(getCurrentWeekBounds())

  const isCurrentWeek = () => {
    const current = getCurrentWeekBounds()
    return bounds.start.getTime() === current.start.getTime()
  }

  return { bounds, goNext, goPrev, goToday, isCurrentWeek }
}
