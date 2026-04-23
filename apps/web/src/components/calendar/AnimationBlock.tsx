import { Link } from 'react-router'
import { toZonedTime } from 'date-fns-tz'
import type { Animation } from '@/types/database'

import { formatTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const TZ = 'Europe/Paris'

const PX_PER_MIN = 1.2
const SESSION_START_MIN = 18 * 60

const TYPE_LABELS: Record<string, string> = {
  petite: 'Petite',
  moyenne: 'Moyenne',
  grande: 'Grande',
}

const VILLAGE_LABELS: Record<string, string> = {
  konoha: 'Konoha',
  suna: 'Suna',
  oto: 'Oto',
  kiri: 'Kiri',
  temple_camelias: 'Temple',
  autre: 'Autre',
  tout_le_monde: 'Tous',
}

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
  return 24 * 60 - SESSION_START_MIN + mins
}

// Returns a time string `prep_time_min` minutes before scheduledAt
function debriefStartTime(scheduledAt: Date, prepMin: number): string {
  const ms = new Date(scheduledAt).getTime() - prepMin * 60 * 1000
  return formatTime(new Date(ms).toISOString())
}

interface AnimationBlockProps {
  animation: Animation
  lane: number
  totalLanes: number
}

export function AnimationBlock({ animation, lane, totalLanes }: AnimationBlockProps) {
  const prep = animation.prep_time_min ?? 0
  const animStartMin = minutesFromSessionTop(new Date(animation.scheduled_at))
  const totalMin = prep + animation.planned_duration_min

  // Block starts at debrief start (or animation start if no debrief)
  const topMin = animStartMin - prep
  const top = topMin * PX_PER_MIN
  const totalHeight = Math.max(totalMin * PX_PER_MIN, 28)
  const debriefHeight = prep * PX_PER_MIN
  const animHeight = totalHeight - debriefHeight

  const colorClass = VILLAGE_COLORS[animation.village] ?? VILLAGE_COLORS.autre

  const GAP = 2
  const EDGE = 2
  const widthPct = 100 / totalLanes
  const leftPct = (lane * 100) / totalLanes
  const leftInset = lane === 0 ? EDGE : GAP / 2
  const rightInset = lane === totalLanes - 1 ? EDGE : GAP / 2

  const validated = animation.validated_participants_count ?? 0
  const required = animation.required_participants
  const isFull = validated >= required

  return (
    <Link
      to={`/panel/animations/${animation.id}`}
      className={cn(
        'absolute rounded-lg border overflow-hidden group flex flex-col',
        'hover:brightness-125 transition-all duration-150 cursor-pointer',
        colorClass,
      )}
      style={{
        top,
        height: totalHeight,
        left: `calc(${leftPct}% + ${leftInset}px)`,
        width: `calc(${widthPct}% - ${leftInset + rightInset}px)`,
      }}
    >
      {/* Debrief zone */}
      {prep > 0 && (
        <div
          className="shrink-0 border-b border-current/20 px-1.5 flex items-center gap-1 bg-black/20 overflow-hidden"
          style={{ height: debriefHeight }}
        >
          <p className="text-[9px] opacity-60 leading-none truncate">
            Débrief {debriefStartTime(new Date(animation.scheduled_at), prep)}
          </p>
        </div>
      )}

      {/* Animation zone */}
      <div className="flex-1 px-1.5 py-1 overflow-hidden flex flex-col gap-0.5 min-h-0">
        <p className="text-[10px] font-semibold leading-tight truncate">
          {animation.title}{animation.creator ? ` · ${animation.creator.username}` : ''}
        </p>
        <p className="text-[9px] opacity-70 leading-tight truncate">
          {formatTime(animation.scheduled_at)}
        </p>
        {animHeight >= 40 && (
          <p className="text-[9px] opacity-60 leading-tight truncate">
            {animation.server} · {TYPE_LABELS[animation.type]}
          </p>
        )}
        {animHeight >= 56 && (
          <p className={cn('text-[9px] leading-tight truncate', isFull ? 'opacity-90 font-semibold' : 'opacity-60')}>
            {VILLAGE_LABELS[animation.village]} · {isFull ? 'Complet' : `${validated}/${required} joueurs`}
          </p>
        )}
      </div>
    </Link>
  )
}
