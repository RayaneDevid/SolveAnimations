import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  Sword,
  CalendarDays,
  FileText,
  CalendarOff,
  CheckSquare,
  Trophy,
  Users,
  PieChart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui-store'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hasRole } from '@/lib/config/discord'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  requiresRole?: 'responsable'
}

const NAV_ITEMS: NavItem[] = [
  { to: '/panel/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/panel/animations', label: 'Animations', icon: Sword },
  { to: '/panel/calendar', label: 'Calendrier', icon: CalendarDays },
  { to: '/panel/reports', label: 'Mes rapports', icon: FileText },
  { to: '/panel/absences', label: 'Mes absences', icon: CalendarOff },
  { to: '/panel/validation', label: 'Validation', icon: CheckSquare, requiresRole: 'responsable' },
  { to: '/panel/leaderboard', label: 'Classement', icon: Trophy, requiresRole: 'responsable' },
  { to: '/panel/members', label: 'Membres', icon: Users, requiresRole: 'responsable' },
  { to: '/panel/villages', label: 'Graphique villages', icon: PieChart, requiresRole: 'responsable' },
]

export function Sidebar() {
  const { auth, signOut } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  if (auth.status !== 'authenticated') return null

  const { user, role } = auth
  const isResponsable = hasRole(role, 'responsable')

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-[#0D0E14] border-r border-white/[0.06] transition-all duration-300 ease-in-out shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]',
        sidebarCollapsed && 'justify-center px-0',
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <p className="text-sm font-bold text-white leading-none">Solve</p>
            <p className="text-xs text-cyan-400 font-medium leading-tight">Animations</p>
          </div>
        )}
      </div>

      {/* User card */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]',
        sidebarCollapsed && 'justify-center px-0',
      )}>
        <UserAvatar
          avatarUrl={user.avatar_url}
          username={user.username}
          size={sidebarCollapsed ? 'sm' : 'md'}
        />
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/90 truncate">{user.username}</p>
            <RoleBadge role={role} className="mt-0.5" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.requiresRole && !isResponsable) return null
          const Icon = item.icon

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.to} delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-center h-9 w-full rounded-lg transition-colors duration-150',
                        isActive
                          ? 'bg-cyan-400/10 text-cyan-400'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-cyan-400/10 text-cyan-400'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-2">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center h-8 w-full rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Sign out */}
      <div className="px-2 pb-4 border-t border-white/[0.06] pt-2">
        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-3 h-9 w-full rounded-lg text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors duration-150',
            sidebarCollapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && 'Déconnexion'}
        </button>
      </div>
    </aside>
  )
}
