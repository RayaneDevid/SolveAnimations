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
        console.log('[auth-callback] mounted', {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
        })

        const callbackError = errorMessageFromCallback(searchParams)
        if (callbackError) {
          console.error('[auth-callback] provider returned error', callbackError)
          navigate(loginErrorUrl(callbackError), { replace: true })
          return
        }

        const code = searchParams.get('code')
        console.log('[auth-callback] code present', Boolean(code))
        const sessionResult = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.getSession()
        const { data: { session }, error } = sessionResult
        console.log('[auth-callback] session exchange result', {
          hasSession: Boolean(session),
          hasProviderToken: Boolean(session?.provider_token),
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          identities: session?.user?.identities?.map((identity) => ({
            provider: identity.provider,
            provider_id: identity.identity_data?.sub,
          })),
          error,
        })
        if (error || !session) {
          navigate(loginErrorUrl(error?.message), { replace: true })
          return
        }

        console.log('[auth-callback] calling auth-validate-staff')
        const result = await invokeEdge<AuthValidateResult>('auth-validate-staff', {
          provider_token: session.provider_token,
        })
        console.log('[auth-callback] auth-validate-staff success', {
          profileId: result.profile.id,
          discordId: result.profile.discord_id,
          role: result.profile.role,
          availableRoles: result.profile.available_roles,
        })
        qc.setQueryData(queryKeys.auth.me, result.profile)
        setUser(result.profile)
        navigate('/panel/dashboard', { replace: true })
      } catch (err) {
        console.error('[auth-callback] failed', err)
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
