import { useMemo } from 'react'
import { NavLink } from 'react-router'
import { Reorder } from 'framer-motion'
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
import { useUIStore, DEFAULT_NAV_ORDER } from '@/stores/ui-store'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hasRole } from '@/lib/config/discord'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  requiresRole?: 'responsable' | 'responsable_mj'
}

const NAV_ITEMS_MAP: Record<string, NavItem> = {
  '/panel/calendar': { to: '/panel/calendar', label: 'Calendrier', icon: CalendarDays },
  '/panel/dashboard': { to: '/panel/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  '/panel/animations': { to: '/panel/animations', label: 'Animations', icon: Sword },
  '/panel/reports': { to: '/panel/reports', label: 'Mes rapports', icon: FileText },
  '/panel/absences': { to: '/panel/absences', label: 'Mes absences', icon: CalendarOff },
  '/panel/validation': { to: '/panel/validation', label: 'Validation', icon: CheckSquare, requiresRole: 'responsable' },
  '/panel/leaderboard': { to: '/panel/leaderboard', label: 'Classement', icon: Trophy, requiresRole: 'responsable' },
  '/panel/members': { to: '/panel/members', label: 'Membres', icon: Users, requiresRole: 'responsable' },
  '/panel/casiers': { to: '/panel/casiers', label: 'Casiers', icon: FolderOpen, requiresRole: 'responsable' },
  '/panel/paies': { to: '/panel/paies', label: 'Paies', icon: Banknote, requiresRole: 'responsable' },
  '/panel/villages': { to: '/panel/villages', label: 'Graphique villages', icon: PieChart, requiresRole: 'responsable' },
}

export function Sidebar() {
  const { auth, signOut } = useAuth()
  const { sidebarCollapsed, toggleSidebar, navOrder, setNavOrder } = useUIStore()

  if (auth.status !== 'authenticated') return null

  const { user, role } = auth
  const isResponsable = hasRole(role, 'responsable')

  // Merge stored order with defaults to handle new items added later
  const orderedKeys = useMemo(() => {
    const stored = navOrder.filter((k) => DEFAULT_NAV_ORDER.includes(k))
    const missing = DEFAULT_NAV_ORDER.filter((k) => !stored.includes(k))
    return [...stored, ...missing]
  }, [navOrder])

  const visibleItems = orderedKeys
    .map((key) => NAV_ITEMS_MAP[key])
    .filter((item): item is NavItem => !!item && (!item.requiresRole || isResponsable))

  const visibleKeys = visibleItems.map((item) => item.to)

  function handleReorder(newOrder: string[]) {
    // Rebuild full order: put reordered visible keys in place, keep hidden keys in their slots
    const hiddenKeys = orderedKeys.filter((k) => !visibleKeys.includes(k))
    // Interleave: we just replace the visible slots with newOrder and append hidden at end
    const combined = [...newOrder, ...hiddenKeys]
    setNavOrder(combined)
  }

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
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <Reorder.Group
          axis="y"
          values={visibleKeys}
          onReorder={handleReorder}
          className={sidebarCollapsed ? 'space-y-2' : 'space-y-0.5'}
          as="ul"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon

            if (sidebarCollapsed) {
              return (
                <Reorder.Item key={item.to} value={item.to} as="li" dragListener={false}>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center justify-center h-11 w-full rounded-xl transition-colors duration-150',
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
                </Reorder.Item>
              )
            }

            return (
              <Reorder.Item
                key={item.to}
                value={item.to}
                as="li"
                className="cursor-grab active:cursor-grabbing"
                whileDrag={{ scale: 1.02, opacity: 0.9 }}
              >
                <NavLink
                  to={item.to}
                  draggable={false}
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
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
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
