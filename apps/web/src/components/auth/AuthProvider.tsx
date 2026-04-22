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
  const { setUser, clearUser } = useAuthStore()
  const qc = useQueryClient()

  useEffect(() => {
    let isMounted = true

    // On the OAuth callback page, skip restoration — AuthCallback handles the full flow.
    // Without this guard, restoreSession() would race with the code exchange and
    // potentially call auth-me before the profile exists (first login).
    const isOAuthCallback = new URLSearchParams(window.location.search).has('code')
    if (!isOAuthCallback) {
      // Must be called outside onAuthStateChange to avoid deadlock:
      // supabase.functions.invoke calls auth.getSession() internally,
      // which deadlocks when invoked from within an onAuthStateChange callback.
      ;(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!isMounted) return
          if (!session) {
            clearUser()
            return
          }
          const profile = await fetchMe()
          if (!isMounted) return
          qc.setQueryData(queryKeys.auth.me, profile)
          setUser(profile)
        } catch {
          if (!isMounted) return
          await supabase.auth.signOut()
          qc.clear()
          clearUser()
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
  }, [setUser, clearUser, qc])

  return <>{children}</>
}
