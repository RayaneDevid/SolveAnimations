import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { toZonedTime } from 'date-fns-tz'
import type { Animation } from '@/types/database'

import { formatTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const TZ = 'Europe/Paris'

const DEFAULT_PX_PER_MIN = 1.2
const SESSION_START_MIN = 18 * 60
const MIN_DEBRIEF_HEIGHT = 18

const TYPE_LABELS: Record<string, string> = {
  moyenne: 'Moyenne',
  grande: 'Grande',
}

const BDM_TYPE_LABELS = {
  jetable: 'Jetable',
  elaboree: 'Élaborée',
  grande_ampleur: 'Grande ampleur',
} as const

const VILLAGE_LABELS: Record<string, string> = {
  konoha: 'Konoha',
  suna: 'Suna',
  oto: 'Oto',
  kiri: 'Kiri',
  temple_camelias: 'Temple',
  autre: 'Nukenin',
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

const BDM_RANK_COLORS = {
  D: 'bg-zinc-500/25 border-zinc-300/60 text-zinc-50 ring-1 ring-zinc-300/25 shadow-[0_0_16px_rgba(212,212,216,0.14)]',
  C: 'bg-emerald-500/25 border-emerald-300/65 text-emerald-50 ring-1 ring-emerald-300/25 shadow-[0_0_16px_rgba(52,211,153,0.16)]',
  B: 'bg-teal-500/25 border-teal-300/70 text-teal-50 ring-1 ring-teal-300/30 shadow-[0_0_18px_rgba(45,212,191,0.18)]',
  A: 'bg-amber-500/25 border-amber-300/75 text-amber-50 ring-1 ring-amber-300/30 shadow-[0_0_18px_rgba(251,191,36,0.20)]',
  S: 'bg-rose-500/25 border-rose-300/80 text-rose-50 ring-1 ring-rose-300/35 shadow-[0_0_20px_rgba(251,113,133,0.22)]',
} as const

function timeToMinFromMidnight(date: Date): number {
  const paris = toZonedTime(date, TZ)
  return paris.getHours() * 60 + paris.getMinutes()
}

function minutesFromSessionTop(scheduledAt: Date): number {
  const mins = timeToMinFromMidnight(scheduledAt)
  if (mins >= SESSION_START_MIN) return mins - SESSION_START_MIN
  return 24 * 60 - SESSION_START_MIN + mins
}

function debriefStartTime(scheduledAt: Date, prepMin: number): string {
  const ms = new Date(scheduledAt).getTime() - prepMin * 60 * 1000
  return formatTime(new Date(ms).toISOString())
}

function elapsedMinutes(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000)
}

function formatDurationShort(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

interface AnimationBlockProps {
  animation: Animation
  lane: number
  totalLanes: number
  pxPerMin?: number
}

export function AnimationBlock({ animation, lane, totalLanes, pxPerMin = DEFAULT_PX_PER_MIN }: AnimationBlockProps) {
  const isRunning = animation.status === 'running' && !!animation.started_at
  const isFinished = animation.status === 'finished'
  const isBdmMission = animation.bdm_mission

  const [elapsed, setElapsed] = useState(() =>
    isRunning ? elapsedMinutes(animation.started_at!) : 0,
  )

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setElapsed(elapsedMinutes(animation.started_at!)), 30_000)
    return () => clearInterval(id)
  }, [isRunning, animation.started_at])

  const effectiveDuration = isFinished
    ? (animation.actual_duration_min ?? animation.planned_duration_min)
    : isRunning
      ? Math.max(elapsed, 1)
      : animation.planned_duration_min

  const prep = animation.prep_time_min ?? 0
  const animStartMin = minutesFromSessionTop(new Date(animation.scheduled_at))

  const topMin = animStartMin - prep
  const top = topMin * pxPerMin

  const debriefHeight = prep > 0 ? Math.max(prep * pxPerMin, MIN_DEBRIEF_HEIGHT) : 0
  const animNaturalHeight = effectiveDuration * pxPerMin
  const totalHeight = Math.max(debriefHeight + animNaturalHeight, 28)
  const animHeight = totalHeight - debriefHeight

  const colorClass = isBdmMission
    ? BDM_RANK_COLORS[animation.bdm_mission_rank]
    : VILLAGE_COLORS[animation.village] ?? VILLAGE_COLORS.autre

  const GAP = 2
  const EDGE = 2
  const widthPct = 100 / totalLanes
  const leftPct = (lane * 100) / totalLanes
  const leftInset = lane === 0 ? EDGE : GAP / 2
  const rightInset = lane === totalLanes - 1 ? EDGE : GAP / 2

  const validated = animation.validated_participants_count ?? 0
  const required = animation.required_participants
  const hasParticipantLimit = required > 0
  const isFull = hasParticipantLimit && validated >= required
  const participantsLabel = hasParticipantLimit
    ? animation.registrations_locked
      ? 'Inscriptions verrouillées'
      : (isFull ? 'Complet' : `${validated}/${required} joueurs`)
    : animation.registrations_locked
      ? 'Inscriptions verrouillées'
      : 'Aucun participant'

  const durationLabel = isFinished
    ? formatDurationShort(animation.actual_duration_min ?? animation.planned_duration_min)
    : isRunning
      ? `${formatDurationShort(elapsed)} en cours`
      : formatDurationShort(animation.planned_duration_min)

  return (
    <Link
      to={`/panel/animations/${animation.id}`}
      className={cn(
        'absolute rounded-lg border overflow-hidden group flex flex-col',
        'hover:brightness-125 transition-all duration-150 cursor-pointer',
        isBdmMission && 'border-dashed',
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
          className="shrink-0 border-b border-current/20 px-1.5 flex items-center gap-1 bg-black/20"
          style={{ height: debriefHeight }}
        >
          <p className="text-[9px] opacity-60 leading-none truncate">
            Débrief {debriefStartTime(new Date(animation.scheduled_at), prep)}
          </p>
        </div>
      )}

      {/* Animation zone */}
      <div className="flex-1 px-1.5 py-1 overflow-hidden flex flex-col gap-0.5 min-h-0">
        {isBdmMission && (
          <div className="flex items-center gap-1">
            <span className="shrink-0 rounded-sm border border-teal-200/30 bg-teal-200/15 px-1 text-[8px] font-bold leading-3 tracking-wide text-teal-50">
              BDM
            </span>
            <span className="truncate text-[8px] font-medium leading-3 text-teal-50/70">
              Rang {animation.bdm_mission_rank}
            </span>
          </div>
        )}
        <p className="text-[10px] font-semibold leading-tight truncate">
          {animation.title}{animation.creator ? ` · ${animation.creator.username}` : ''}
        </p>
        <p className="text-[9px] opacity-70 leading-tight truncate">
          {formatTime(animation.scheduled_at)} · {durationLabel}
        </p>
        {animHeight >= 40 && (
          <p className="text-[9px] opacity-60 leading-tight truncate">
            {animation.server} · {isBdmMission ? BDM_TYPE_LABELS[animation.bdm_mission_type] : TYPE_LABELS[animation.type]}
          </p>
        )}
        {animHeight >= 56 && (
          <p className={cn('text-[9px] leading-tight truncate', isFull ? 'opacity-90 font-semibold' : 'opacity-60')}>
            {VILLAGE_LABELS[animation.village]} · {participantsLabel}
          </p>
        )}
      </div>
    </Link>
  )
}
