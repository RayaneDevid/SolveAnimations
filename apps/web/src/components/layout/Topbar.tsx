import { useLocation } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { getCurrentWeekBounds } from '@/lib/utils/week'
import { useAnimation } from '@/hooks/queries/useAnimations'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  animations: 'Animations',
  calendar: 'Calendrier',
  reports: 'Mes rapports',
  absences: 'Mes absences',
  validation: 'Validation',
  leaderboard: 'Classement',
  members: 'Membres',
  villages: 'Graphique villages',
  new: 'Nouvelle animation',
  edit: 'Modifier',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function usePageLabel(): string {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]

  const animId = UUID_RE.test(last) && segments.includes('animations') ? last : ''
  const { data } = useAnimation(animId)

  if (animId) return data?.animation?.title ?? '…'
  return ROUTE_LABELS[last] ?? last
}

function WeekIndicator() {
  const { start, end } = getCurrentWeekBounds()
  const tz = 'Europe/Paris'
  const startParis = toZonedTime(start, tz)
  const endParis = toZonedTime(end, tz)
  const label = `Sem. ${format(startParis, 'dd/MM', { locale: fr })} → ${format(endParis, 'dd/MM', { locale: fr })}`
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
      <span className="text-xs font-medium text-white/60">{label}</span>
    </div>
  )
}

export function Topbar() {
  const pageLabel = usePageLabel()

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-white/[0.06] bg-[#0A0B0F]/80 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/30">Solve Animations</span>
        <ChevronRight className="h-3.5 w-3.5 text-white/20" />
        <span className="text-white/80 font-medium">{pageLabel}</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <WeekIndicator />
      </div>
    </header>
  )
}
