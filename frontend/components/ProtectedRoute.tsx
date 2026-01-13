import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
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
    return <Navigate to="/login" replace />
  }

  // Check if email is verified
  if (user && !user.email_confirmed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="rounded-full bg-yellow-500/10 w-16 h-16 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold">Email Verification Required</h2>
          <p className="text-muted-foreground">
            Please verify your email address to access QuantSight. Check your inbox for the verification link.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
