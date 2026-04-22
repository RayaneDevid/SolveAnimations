import { Navigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

export default function Index() {
  const { auth } = useAuth()

  if (auth.status === 'loading') return null
  if (auth.status === 'unauthenticated') return <Navigate to="/login" replace />
  return <Navigate to="/panel/dashboard" replace />
}
