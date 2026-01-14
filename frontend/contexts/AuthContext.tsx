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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (!error && data.user) {
      // Create profile entry
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: metadata.full_name,
        username: metadata.username,
        use_case: metadata.use_case,
        company_name: metadata.company_name,
        role: metadata.role,
        email_verified: false,
      })
    }

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
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
