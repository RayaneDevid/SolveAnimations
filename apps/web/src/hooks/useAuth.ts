import { useAuthStore } from '@/stores/auth-store'
import type { Profile } from '@/types/database'
import type { StaffRoleKey } from '@/lib/config/discord'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: Profile; role: StaffRoleKey }

export function useAuth() {
  const { user, isLoading, logout } = useAuthStore()

  const auth: AuthState = isLoading
    ? { status: 'loading' }
    : user
    ? { status: 'authenticated', user, role: user.role }
    : { status: 'unauthenticated' }

  return { auth, signOut: logout }
}

export function useRequiredAuth() {
  const { user } = useAuthStore()
  if (!user) throw new Error('Not authenticated')
  return { status: 'authenticated' as const, user, role: user.role }
}
