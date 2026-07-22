import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { authAPI } from '@/services/api'

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

interface AuthResult {
  error: Error | null
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
  }) => Promise<AuthResult>
  signIn: (identifier: string, password: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signInWithGithub: () => Promise<AuthResult>
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
    } catch {
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) setLoading(false)
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) void fetchProfile(session.user.id)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
        void fetchProfile(session.user.id)
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
    try {
      const availability = await authAPI.getUsernameAvailability(metadata.username)
      if (!availability.data.available) {
        return { error: new Error('Username is already taken') }
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return { error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Registration failed') }
    }
  }

  const signIn = async (identifier: string, password: string): Promise<AuthResult> => {
    try {
      const response = await authAPI.passwordSignIn(identifier, password)
      const { error } = await supabase.auth.setSession({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      })
      return { error }
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Sign in failed') }
    }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const signInWithGithub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
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
