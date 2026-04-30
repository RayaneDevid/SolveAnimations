import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

const APP_URL = import.meta.env.VITE_APP_URL as string

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

export default function Login() {
  const { auth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    if (auth.status === 'authenticated') {
      navigate('/panel/dashboard', { replace: true })
    }
  }, [auth.status, navigate])

  const handleLogin = async () => {
    const redirectTo = `${APP_URL.replace(/\/+$/, '')}/auth/callback`
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify guilds.members.read',
        redirectTo,
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center relative overflow-hidden">
      {/* Orbs */}
      <div className="orb h-[500px] w-[500px] bg-cyan-500/[0.06] -top-40 -left-40" />
      <div className="orb h-[400px] w-[400px] bg-blue-600/[0.05] bottom-0 right-0" />
      <div className="orb h-[300px] w-[300px] bg-violet-600/[0.04] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="glass rounded-2xl p-8 text-center space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.4)]">
              <img src="/logo.png" alt="Solve Animations" className="h-16 w-16 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Solve Animations</h1>
              <p className="text-sm text-white/40 mt-1">Panel de gestion des animations</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-sm text-red-400">
                {error === 'unauthorized'
                  ? "Tu n'as pas les rôles nécessaires pour accéder à ce panel."
                  : error === 'revoked'
                  ? 'Tes accès ont été révoqués.'
                  : 'Une erreur est survenue lors de la connexion.'}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-3">
            <Button
              onClick={handleLogin}
              className="w-full gap-3 text-base h-11"
              disabled={auth.status === 'loading'}
            >
              <DiscordIcon className="h-5 w-5" />
              Se connecter avec Discord
            </Button>
            <p className="text-xs text-white/25">
              Réservé aux membres de la Solve Community
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
