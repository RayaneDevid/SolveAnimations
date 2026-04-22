import { Link } from 'react-router'
import { toZonedTime } from 'date-fns-tz'
import type { Animation } from '@/types/database'

import { formatTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const TZ = 'Europe/Paris'

// Total session height in pixels per minute
const PX_PER_MIN = 1.2

// Session start = 18:00
const SESSION_START_MIN = 18 * 60


const VILLAGE_COLORS: Record<string, string> = {
  konoha: 'bg-green-500/25 border-green-500/40 text-green-300',
  suna: 'bg-yellow-600/25 border-yellow-600/40 text-yellow-300',
  oto: 'bg-purple-800/30 border-purple-700/40 text-purple-300',
  kiri: 'bg-teal-600/25 border-teal-600/40 text-teal-300',
  temple_camelias: 'bg-pink-500/25 border-pink-500/40 text-pink-300',
  autre: 'bg-white/10 border-white/20 text-white/60',
  tout_le_monde: 'bg-gradient-to-b from-cyan-500/20 to-violet-500/20 border-white/20 text-white/80',
}

function timeToMinFromMidnight(date: Date): number {
  const paris = toZonedTime(date, TZ)
  return paris.getHours() * 60 + paris.getMinutes()
}

function minutesFromSessionTop(scheduledAt: Date): number {
  const mins = timeToMinFromMidnight(scheduledAt)
  if (mins >= SESSION_START_MIN) return mins - SESSION_START_MIN
  // after midnight: 18:00 = 0, 00:00 = 6*60 = 360
  return 24 * 60 - SESSION_START_MIN + mins
}

interface AnimationBlockProps {
  animation: Animation
  lane: number
  totalLanes: number
}

export function AnimationBlock({ animation, lane, totalLanes }: AnimationBlockProps) {
  const topMin = minutesFromSessionTop(new Date(animation.scheduled_at))
  const heightMin = animation.planned_duration_min

  const top = topMin * PX_PER_MIN
  const height = Math.max(heightMin * PX_PER_MIN, 28) // min height 28px

  const colorClass = VILLAGE_COLORS[animation.village] ?? VILLAGE_COLORS.autre

  const GAP = 2 // px gap between lanes
  const EDGE = 2 // px margin from column edge
  const widthPct = 100 / totalLanes
  const leftPct = (lane * 100) / totalLanes
  const leftInset = lane === 0 ? EDGE : GAP / 2
  const rightInset = lane === totalLanes - 1 ? EDGE : GAP / 2

  return (
    <Link
      to={`/panel/animations/${animation.id}`}
      className={cn(
        'absolute rounded-lg border px-1.5 py-1 overflow-hidden group',
        'hover:brightness-125 transition-all duration-150 cursor-pointer',
        colorClass,
      )}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + ${leftInset}px)`,
        width: `calc(${widthPct}% - ${leftInset + rightInset}px)`,
      }}
    >
      <p className="text-[10px] font-semibold leading-tight truncate">{animation.title}</p>
      <p className="text-[9px] opacity-70 leading-tight truncate">
        {formatTime(animation.scheduled_at)}
      </p>
    </Link>
  )
}
