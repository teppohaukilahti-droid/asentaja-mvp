/* eslint-disable react-refresh/only-export-components -- Context-tiedosto: useAuth-hookin vienti samasta tiedostosta on tarkoituksellista */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { setErrorLogUser } from '../lib/errorlog'

export type Profile = {
  id: string
  organization_id: string
  full_name: string
  role: 'asentaja' | 'tyonjohtaja' | 'varasto' | 'johtaja'
  approved: boolean
  gps_sallittu: boolean | null
  profession_id: string | null
  hourly_rate: number | null
  hukka_percentage: number | null
  pay_period_cutoff: number | null
  // Tililapun omat tiedot + työpari (yksi äppi tekee lapun kahdelle)
  henkilonumero: string | null
  tyopari_nimi: string | null
  tyopari_henkilonumero: string | null
  tyopari_tuntipalkka: number | null
  tyopari_osuus_pct: number
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; needsConfirm: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Kannan numeric-kentät tulevat merkkijonoina — muunnetaan numeroiksi yhdessä paikassa
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProfile(data: any): Profile {
  return {
    ...data,
    hourly_rate: data.hourly_rate === null ? null : Number(data.hourly_rate),
    hukka_percentage: data.hukka_percentage === null ? null : Number(data.hukka_percentage),
    tyopari_tuntipalkka: data.tyopari_tuntipalkka == null ? null : Number(data.tyopari_tuntipalkka),
    tyopari_osuus_pct: Number(data.tyopari_osuus_pct ?? 50),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // HUOM: onAuthStateChange-kuuntelijan sisällä EI saa await-kutsua supabasea
  // (uudemmissa supabase-js-versioissa se lukkiutuu). Siksi profiili haetaan
  // erillisessä effectissä käyttäjän vaihtuessa.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      if (!data.session) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          console.error('Profiilin haku epäonnistui:', error?.message)
          setProfile(null)
        } else {
          setProfile(normalizeProfile(data))
          setErrorLogUser(data.id, data.full_name, data.organization_id)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  // Rekisteröityminen: profiili syntyy tietokantatriggerillä (handle_new_user),
  // rooli oletuksena asentaja — työnjohto korottaa rooleja profiles-taulusta.
  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    // Jos sähköpostivahvistus on päällä Supabasessa, sessiota ei synny heti
    const needsConfirm = !error && !data.session
    return { error: error as Error | null, needsConfirm }
  }

  // Asetusten tallennuksen jälkeen: uudet tiedot heti käyttöön koko äpissä
  async function refreshProfile() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(normalizeProfile(data))
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
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
