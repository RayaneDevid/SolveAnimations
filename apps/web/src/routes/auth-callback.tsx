import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/auth-store'
import type { Profile } from '@/types/database'

interface AuthValidateResult {
  profile: Profile
}

function errorMessageFromCallback(searchParams: URLSearchParams): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    searchParams.get('error_description') ??
    searchParams.get('error') ??
    hashParams.get('error_description') ??
    hashParams.get('error')
  )
}

function loginErrorUrl(message?: string): string {
  const params = new URLSearchParams({ error: message ? 'auth_callback' : 'unauthorized' })
  if (message) params.set('message', message)
  return `/login?${params.toString()}`
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser, clearUser } = useAuthStore()
  const qc = useQueryClient()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function handleCallback() {
      try {
        const callbackError = errorMessageFromCallback(searchParams)
        if (callbackError) {
          navigate(loginErrorUrl(callbackError), { replace: true })
          return
        }

        const code = searchParams.get('code')
        const sessionResult = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.getSession()
        const { data: { session }, error } = sessionResult
        if (error || !session) {
          navigate(loginErrorUrl(error?.message), { replace: true })
          return
        }

        const result = await invokeEdge<AuthValidateResult>('auth-validate-staff', {
          provider_token: session.provider_token,
        })
        qc.setQueryData(queryKeys.auth.me, result.profile)
        setUser(result.profile)
        navigate('/panel/dashboard', { replace: true })
      } catch (err) {
        await supabase.auth.signOut()
        qc.clear()
        clearUser()
        navigate(loginErrorUrl(err instanceof Error ? err.message : undefined), { replace: true })
      }
    }

    handleCallback()
  }, [navigate, searchParams, setUser, clearUser, qc])

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl overflow-hidden animate-pulse">
          <img src="/logo.png" alt="Solve Animations" className="h-12 w-12 object-contain" />
        </div>
        <p className="text-sm text-white/40">Connexion en cours...</p>
      </div>
    </div>
  )
}
