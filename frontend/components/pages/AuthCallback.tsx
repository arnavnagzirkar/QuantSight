import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing sign in...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔵 [AuthCallback] Processing auth callback')
        // Handle the OAuth callback or email verification
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('🔴 [AuthCallback] Auth callback error:', error)
          navigate('/login?error=auth_failed')
          return
        }

        if (data.session) {
          console.log('🟢 [AuthCallback] Session found:', data.session.user.id)
          const user = data.session.user
          
          // Check if profile exists
          setStatus('Setting up your profile...')
          console.log('🔵 [AuthCallback] Checking for existing profile')
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()
          
          if (profileCheckError && profileCheckError.code === 'PGRST116') {
            // Profile doesn't exist, create it
            console.log('🔵 [AuthCallback] No profile found, creating one')
            const profileData = {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
              username: user.user_metadata?.username || user.email?.split('@')[0] || '',
              use_case: user.user_metadata?.use_case || 'personal',
              company_name: user.user_metadata?.company_name,
              role: user.user_metadata?.role,
              email_verified: true,
            }
            
            console.log('🔵 [AuthCallback] Creating profile with data:', profileData)
            const { error: insertError } = await supabase
              .from('profiles')
              .insert(profileData)
            
            if (insertError) {
              console.error('🔴 [AuthCallback] Profile creation error:', insertError)
              // Continue anyway - user is authenticated
            } else {
              console.log('🟢 [AuthCallback] Profile created successfully')
            }
          } else if (existingProfile) {
            console.log('🟢 [AuthCallback] Profile already exists')
          }
          
          // Successfully authenticated
          console.log('🟢 [AuthCallback] Redirecting to dashboard')
          navigate('/dashboard')
        } else {
          console.log('⚠️ [AuthCallback] No session found, redirecting to login')
          navigate('/login')
        }
      } catch (err) {
        console.error('🔴 [AuthCallback] Unexpected error:', err)
        navigate('/login?error=unexpected')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  )
}
