import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/auth-store'
import type { Profile } from '@/types/database'

interface AuthMeResult {
  profile: Profile
}

export async function fetchMe(): Promise<Profile> {
  const result = await invokeEdge<AuthMeResult>('auth-me')
  return result.profile
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, clearUser } = useAuthStore()
  const qc = useQueryClient()

  useEffect(() => {
    let isMounted = true

    // On the OAuth callback page, skip restoration — AuthCallback handles the full flow.
    const isOAuthCallback = new URLSearchParams(window.location.search).has('code')
    if (!isOAuthCallback) {
      ;(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!isMounted) return

          if (!session) {
            clearUser()
            return
          }

          // If no cached profile, block until auth-me resolves (first load after cache clear)
          // If a cached profile exists, auth-me runs in background to revalidate silently
          const profile = await fetchMe()
          if (!isMounted) return
          qc.setQueryData(queryKeys.auth.me, profile)
          setUser(profile)
        } catch {
          if (!isMounted) return
          // Only sign out if there's no cached user (avoid flicker on transient errors)
          if (!user) {
            await supabase.auth.signOut()
            qc.clear()
            clearUser()
          }
        }
      })()
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return
      if (event === 'SIGNED_OUT') {
        qc.clear()
        clearUser()
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
