import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Zap } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/auth-store'
import type { Profile } from '@/types/database'

interface AuthValidateResult {
  profile: Profile
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const { setUser, clearUser } = useAuthStore()
  const qc = useQueryClient()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function handleCallback() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          navigate('/login?error=unauthorized', { replace: true })
          return
        }

        // provider_token can be null if the session was restored from storage
        // instead of being freshly exchanged via PKCE. Force a re-login in that case
        // so auth-validate-staff always receives a live Discord token.
        if (!session.provider_token) {
          await supabase.auth.signOut()
          navigate('/login', { replace: true })
          return
        }

        const result = await invokeEdge<AuthValidateResult>('auth-validate-staff', {
          provider_token: session.provider_token,
        })
        qc.setQueryData(queryKeys.auth.me, result.profile)
        setUser(result.profile)
        navigate('/panel/dashboard', { replace: true })
      } catch {
        await supabase.auth.signOut()
        qc.clear()
        clearUser()
        navigate('/login?error=unauthorized', { replace: true })
      }
    }

    handleCallback()
  }, [navigate, setUser, clearUser, qc])

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center animate-pulse">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <p className="text-sm text-white/40">Connexion en cours...</p>
      </div>
    </div>
  )
}
