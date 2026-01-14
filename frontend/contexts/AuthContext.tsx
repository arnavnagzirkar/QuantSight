import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'

interface UserProfile {
  id: string
  email: string
  full_name: string
  username: string
  use_case: 'personal' | 'company' | 'student'
  company_name?: string
  role?: string
  email_verified: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, metadata: {
    full_name: string
    username: string
    use_case: string
    company_name?: string
    role?: string
  }) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signInWithGithub: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    console.log('🔵 [AuthContext] Initializing auth')
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('🔴 [AuthContext] Session fetch error:', error)
      }
      console.log('🔵 [AuthContext] Initial session:', session?.user?.id || 'none')
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔵 [AuthContext] Auth event:', event, 'user:', session?.user?.id || 'none')
      
      // Only clear on explicit signout
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (
    email: string,
    password: string,
    metadata: {
      full_name: string
      username: string
      use_case: string
      company_name?: string
      role?: string
    }
  ) => {
    console.log('🔵 [AuthContext] signUp called with:', { email, metadata })
    
    try {
      console.log('🔵 [AuthContext] Calling supabase.auth.signUp...')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      console.log('🔵 [AuthContext] signUp response:', { data, error })

      if (error) {
        console.error('🔴 [AuthContext] signUp error:', error)
        return { error }
      }

      if (data.user) {
        console.log('🟢 [AuthContext] User created:', data.user.id)
        console.log('🟢 [AuthContext] User details:', {
          id: data.user.id,
          email: data.user.email,
          email_confirmed_at: data.user.email_confirmed_at,
          user_metadata: data.user.user_metadata
        })
        console.log('✉️ [AuthContext] Profile will be created after email verification')
      } else {
        console.warn('⚠️ [AuthContext] No user returned from signUp')
      }

      return { error }
    } catch (err) {
      console.error('🔴 [AuthContext] signUp exception:', err)
      return { error: err as any }
    }
  }

  const signIn = async (emailOrUsername: string, password: string) => {
    console.log('🔵 [AuthContext] signIn called with:', emailOrUsername)
    
    let emailToUse = emailOrUsername
    
    // Check if input is an email (contains @) or username
    if (!emailOrUsername.includes('@')) {
      console.log('🔵 [AuthContext] Input is username, looking up email')
      // Look up email from username
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', emailOrUsername)
        .single()
      
      if (lookupError || !profile) {
        console.error('🔴 [AuthContext] Username lookup failed:', lookupError)
        return { error: { message: 'Invalid username or password' } as any }
      }
      
      emailToUse = profile.email
      console.log('🟢 [AuthContext] Found email for username:', emailToUse)
    }
    
    console.log('🔵 [AuthContext] Signing in with email:', emailToUse)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    })
    console.log('🔵 [AuthContext] signIn response:', { data, error })
    if (error) {
      console.error('🔴 [AuthContext] signIn error:', error)
    } else {
      console.log('🟢 [AuthContext] signIn successful')
    }
    return { error }
  }

  const signInWithGoogle = async () => {
    console.log('🔵 [AuthContext] signInWithGoogle called')
    console.log('🔵 [AuthContext] Redirect URL:', `${window.location.origin}/auth/callback`)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    console.log('🔵 [AuthContext] Google OAuth result:', { error })
    if (error) {
      console.error('❌ [AuthContext] Google OAuth error:', error.message, error)
    } else {
      console.log('✅ [AuthContext] Google OAuth initiated successfully')
    }
    return { error }
  }

  const signInWithGithub = async () => {
    console.log('🟣 [AuthContext] signInWithGithub called')
    console.log('🟣 [AuthContext] Redirect URL:', `${window.location.origin}/auth/callback`)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    console.log('🟣 [AuthContext] GitHub OAuth result:', { error })
    if (error) {
      console.error('❌ [AuthContext] GitHub OAuth error:', error.message, error)
    } else {
      console.log('✅ [AuthContext] GitHub OAuth initiated successfully')
    }
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
