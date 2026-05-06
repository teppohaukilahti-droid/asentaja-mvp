import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  organization_id: string
  full_name: string
  role: 'asentaja' | 'tyonjohtaja' | 'varasto' | 'johtaja'
  profession_id: string
  hourly_rate: number
  hukka_percentage: number
  pay_period_cutoff: number
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  console.log('[fetchProfile] Aloitetaan haku, userId:', userId)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  console.log('[fetchProfile] Tulos:', { data, error })

  if (error) {
    console.error('Failed to fetch profile:', error)
    return null
  }

  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  console.log('[AuthProvider] Komponentti renderöidään')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[AuthProvider] useEffect alkaa')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthProvider] getSession tulos:', {
        hasSession: !!session,
        userId: session?.user?.id
      })
      if (session?.user) {
        console.log('[AuthProvider] Haetaan profiili käyttäjälle:', session.user.id)
        setUser(session.user)
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      }
      console.log('[AuthProvider] Asetetaan loading=false')
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state muuttui:', event)
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const p = await fetchProfile(session.user.id)
          setProfile(p)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
