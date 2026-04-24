import { Outlet } from 'react-router'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/query/keys'

export default function PanelLayout() {
  const { auth } = useAuth()
  const logout = useAuthStore((s) => s.logout)
  const qc = useQueryClient()

  // Revalidate role every hour, trigger re-validate if > 24h
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const check = async () => {
      const hoursSince =
        (Date.now() - new Date(auth.user.last_role_check_at).getTime()) / 3_600_000
      if (hoursSince >= 24) {
        await qc.invalidateQueries({ queryKey: queryKeys.auth.me })
      }
    }
    check()
    const id = setInterval(check, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [auth, qc])

  // Realtime: sign out immediately if account is deactivated
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const userId = auth.user.id
    const channel = supabase
      .channel(`profile-active:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if ((payload.new as { is_active: boolean }).is_active === false) {
            logout()
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [auth.status, auth.status === 'authenticated' ? auth.user.id : null, logout])

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-[#0A0B0F]">
        {/* Orbs */}
        <div className="orb h-[600px] w-[600px] bg-cyan-500/[0.04] -top-64 -left-64 pointer-events-none" />
        <div className="orb h-[400px] w-[400px] bg-blue-600/[0.04] top-1/2 right-0 pointer-events-none" />

        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
