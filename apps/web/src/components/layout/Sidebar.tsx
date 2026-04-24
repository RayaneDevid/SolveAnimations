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
  FolderOpen,
  Banknote,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui-store'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hasRole } from '@/lib/config/discord'
import type { StaffRoleKey } from '@/lib/config/discord'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  id: string
  label: string
  minRole?: StaffRoleKey
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'base',
    label: 'Animateurs / MJ',
    items: [
      { to: '/panel/dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
      { to: '/panel/animations', label: 'Animations',         icon: Sword },
      { to: '/panel/calendar',   label: 'Calendrier',         icon: CalendarDays },
      { to: '/panel/reports',    label: 'Mes rapports',       icon: FileText },
      { to: '/panel/absences',   label: 'Absences',           icon: CalendarOff },
      { to: '/panel/villages',   label: 'Statistiques', icon: PieChart },
    ],
  },
  {
    id: 'senior',
    label: 'Anim. Senior / MJ Senior',
    minRole: 'senior',
    items: [
      // Views restricted to senior+ go here
    ],
  },
  {
    id: 'responsable',
    label: 'Responsables',
    minRole: 'responsable',
    items: [
      { to: '/panel/validation', label: 'Validation',          icon: CheckSquare },
      { to: '/panel/leaderboard',label: 'Classement',          icon: Trophy },
      { to: '/panel/members',    label: 'Membres',             icon: Users },
      { to: '/panel/casiers',    label: 'Casiers',             icon: FolderOpen },
      { to: '/panel/paies',      label: 'Paies',               icon: Banknote },
    ],
  },
]

export function Sidebar() {
  const { auth, signOut } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  if (auth.status !== 'authenticated') return null

  const { user, role } = auth

  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.minRole
        ? (hasRole(role, section.minRole) ? section.items : [])
        : section.items,
    }))
    .filter((s) => s.items.length > 0)

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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.3)]">
          <img src="/logo.png" alt="Solve Animations" className="h-8 w-8 object-contain" />
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
      <nav className={cn('flex-1 overflow-y-auto py-3', sidebarCollapsed ? 'px-0' : 'px-2')}>
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.id}>
            {/* Section separator */}
            {sectionIndex > 0 && (
              sidebarCollapsed ? (
                <div className="my-3 mx-3 border-t border-white/[0.06]" />
              ) : (
                <div className="mt-4 mb-1 px-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 truncate">
                    {section.label}
                  </p>
                </div>
              )
            )}

            {/* First section label */}
            {sectionIndex === 0 && !sidebarCollapsed && (
              <div className="mb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 truncate">
                  {section.label}
                </p>
              </div>
            )}

            <ul className={sidebarCollapsed ? 'flex flex-col items-center gap-3' : 'space-y-0.5'}>
              {section.items.map((item) => {
                const Icon = item.icon

                if (sidebarCollapsed) {
                  return (
                    <li key={item.to}>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center justify-center h-11 w-11 rounded-xl transition-colors duration-150',
                                isActive
                                  ? 'bg-cyan-400/10 text-cyan-400'
                                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]',
                              )
                            }
                          >
                            <Icon className="h-5 w-5" />
                          </NavLink>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  )
                }

                return (
                  <li key={item.to}>
                    <NavLink
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
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
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
