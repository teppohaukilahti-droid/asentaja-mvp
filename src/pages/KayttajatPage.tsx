// Käyttäjähallinta (työnjohto/johtaja): hyväksy uudet tilit, vaihda roolit,
// poista oikeudet. Kukaan ei pääse dataan käsiksi ennen hyväksyntää.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Check, X, RefreshCw, ShieldCheck, ShieldOff, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Row = {
  id: string
  full_name: string
  role: 'asentaja' | 'tyonjohtaja' | 'varasto' | 'johtaja'
  approved: boolean
  created_at?: string
}

const ROLES: { key: Row['role']; label: string }[] = [
  { key: 'asentaja', label: 'Asentaja' },
  { key: 'tyonjohtaja', label: 'Työnjohtaja' },
  { key: 'varasto', label: 'Varasto' },
  { key: 'johtaja', label: 'Johtaja' },
]
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]))

export default function KayttajatPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pickRole, setPickRole] = useState<Record<string, Row['role']>>({})

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, approved')
      .order('approved', { ascending: true })
      .order('full_name')
    if (qErr) setError('Käyttäjien haku epäonnistui.')
    else setRows((data ?? []) as Row[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function setApproved(id: string, approved: boolean, role?: Row['role']) {
    const patch: Record<string, unknown> = { approved }
    if (role) patch.role = role
    const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', id)
    if (upErr) setToast('Päivitys epäonnistui')
    else { setToast(approved ? 'Käyttäjä hyväksytty' : 'Oikeudet poistettu'); fetchAll() }
  }

  async function setRole(id: string, role: Row['role']) {
    const { error: upErr } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (upErr) setToast('Roolin vaihto epäonnistui')
    else { setToast(`Rooli: ${ROLE_LABEL[role]}`); fetchAll() }
  }

  const pending = rows.filter((r) => !r.approved)
  const active = rows.filter((r) => r.approved)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-500" /> Käyttäjät
        </h1>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md mx-auto space-y-5">
        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Odottaa hyväksyntää ({pending.length})
              </h2>
              {pending.length === 0 && (
                <p className="text-gray-500 text-sm">Ei odottavia tilejä. Uudet rekisteröityneet ilmestyvät tähän — kukaan ei näe mitään dataa ennen kuin hyväksyt tilin.</p>
              )}
              {pending.map((r) => (
                <div key={r.id} className="bg-gray-900 border border-amber-500/40 rounded-2xl p-4 space-y-3">
                  <p className="font-semibold text-sm">{r.full_name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES.map((role) => (
                      <button key={role.key} onClick={() => setPickRole({ ...pickRole, [r.id]: role.key })}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ${(pickRole[r.id] ?? 'asentaja') === role.key ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                        {role.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setApproved(r.id, true, pickRole[r.id] ?? 'asentaja')}
                      className="flex-1 py-2.5 bg-green-600 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Hyväksy
                    </button>
                    <button onClick={() => setToast('Tili jää odottamaan — voit poistaa sen Supabasesta')}
                      className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold text-gray-400 flex items-center gap-1.5">
                      <X className="w-4 h-4" /> Hylkää
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Hyväksytyt ({active.length})
              </h2>
              {active.map((r) => {
                const isSelf = r.id === user?.id
                return (
                  <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{r.full_name}{isSelf ? ' (sinä)' : ''}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500/90 bg-amber-500/10 rounded-full px-2 py-0.5">{ROLE_LABEL[r.role]}</span>
                    </div>
                    {!isSelf && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {ROLES.map((role) => (
                            <button key={role.key} onClick={() => role.key !== r.role && setRole(r.id, role.key)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${r.role === role.key ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                              {role.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setApproved(r.id, false)}
                          className="w-full py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-red-400 flex items-center justify-center gap-1.5">
                          <ShieldOff className="w-3.5 h-3.5" /> Poista oikeudet
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </section>

            <p className="text-[11px] text-gray-600 text-center">
              Hyväksyntä ja roolit: {profile?.full_name}. Oikeuksien poisto lukitsee tilin heti — kirjaukset säilyvät.
            </p>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
