import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_NAV_ORDER = [
  '/panel/dashboard',
  '/panel/animations',
  '/panel/calendar',
  '/panel/reports',
  '/panel/absences',
  '/panel/validation',
  '/panel/leaderboard',
  '/panel/members',
  '/panel/casiers',
  '/panel/paies',
  '/panel/villages',
]

interface UIStore {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  navOrder: string[]
  setNavOrder: (order: string[]) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      navOrder: DEFAULT_NAV_ORDER,
      setNavOrder: (order) => set({ navOrder: order }),
    }),
    { name: 'solve-ui' },
  ),
)

export { DEFAULT_NAV_ORDER }
