import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, profile } = useAuth()

  console.log('🔵 [ProtectedRoute] Checking access:', { user: user?.id, loading, profile: profile?.id })

  if (loading) {
    console.log('🔵 [ProtectedRoute] Still loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('🔴 [ProtectedRoute] No user, redirecting to login')
    return <Navigate to="/login" replace />
  }

  console.log('🟢 [ProtectedRoute] Access granted')
  return <>{children}</>
}
