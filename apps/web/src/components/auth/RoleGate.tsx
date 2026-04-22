import { Navigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { hasRole, type StaffRoleKey } from '@/lib/config/discord'

interface RoleGateProps {
  allow: StaffRoleKey[]
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

export function RoleGate({ allow, children, fallback, redirectTo }: RoleGateProps) {
  const { auth } = useAuth()

  if (auth.status !== 'authenticated') return null

  const allowed = allow.some((r) => hasRole(auth.role, r))

  if (!allowed) {
    if (redirectTo) return <Navigate to={redirectTo} replace />
    if (fallback) return <>{fallback}</>
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        Accès refusé
      </div>
    )
  }

  return <>{children}</>
}
