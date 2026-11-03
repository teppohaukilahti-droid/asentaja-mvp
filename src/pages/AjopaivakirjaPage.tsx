// Ajopäiväkirja: km-korvaukset omalla autolla ajaville.
// Km lasketaan automaattisesti kodin ja työmaiden koordinaateista (tie-arvio),
// mutta lukua voi aina korjata käsin. Toimii myös offline — ajo jonottuu ja lähtee kun verkko palaa.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Car, Plus, X, Check, RefreshCw, Trash2, Home, LocateFixed, ArrowLeftRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDate, today, eur, parseNum } from '../lib/helpers'
import { roadKmEstimate, getPosition } from '../lib/geo'
import { insertOrQueue } from '../lib/offline'

type Trip = { id: string; pvm: string; mista: string; mihin: string; km: number; meno_paluu: boolean; selite: string | null }
type Ws = { id: string; name: string; lat: number | null; lng: number | null }

const HOME_KEY = 'profloor_koti_koordinaatit'
const RATE_KEY = 'profloor_km_korvaus'

export default function AjopaivakirjaPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [trips, setTrips] = useState<Trip[]>([])
  const [worksites, setWorksites] = useState<Ws[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [rate, setRate] = useState(() => localStorage.getItem(RATE_KEY) ?? '0,59')
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem(HOME_KEY) ?? 'null') } catch { return null }
  })

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ pvm: today(), mista: 'Koti', mihin: '', km: '', menoPaluu: true, selite: '' })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    if (!user) return
    setError(null)
    const [tripRes, wsRes] = await Promise.all([
      supabase.from('trips').select('id, pvm, mista, mihin, km, meno_paluu, selite').eq('user_id', user.id).order('pvm', { ascending: false }).limit(200),
      supabase.from('worksites').select('id, name, lat, lng').order('name'),
    ])
    if (tripRes.error) setError('Ajojen haku epäonnistui.')
    else {
      setTrips((tripRes.data ?? []).map((t) => ({ ...t, km: Number(t.km) })))
      setWorksites(wsRes.data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Automaattinen km-arvio kun molemmat päät tunnetaan
  const coordsOf = useCallback((label: string): { lat: number; lng: number } | null => {
    if (label === 'Koti') return home
    const w = worksites.find((x) => x.name === label)
    return w && w.lat != null && w.lng != null ? { lat: w.lat, lng: w.lng } : null
  }, [home, worksites])

  useEffect(() => {
    if (!addOpen || f.km !== '') return
    const a = coordsOf(f.mista), b = coordsOf(f.mihin)
    if (a && b && f.mista && f.mihin && f.mista !== f.mihin) {
      setF((prev) => prev.km === '' ? { ...prev, km: String(roadKmEstimate(a.lat, a.lng, b.lat, b.lng)).replace('.', ',') } : prev)
    }
  }, [addOpen, f.mista, f.mihin, f.km, coordsOf])

  async function saveHome() {
    const pos = await getPosition()
    if (!pos) { setToast('Sijaintia ei saatu — salli sijainti selaimessa'); return }
    setHome(pos)
    localStorage.setItem(HOME_KEY, JSON.stringify(pos))
    setToast('Kotipiste tallennettu tähän sijaintiin')
  }

  async function saveTrip() {
    if (!user || !profile || saving) return
    const kmNum = parseNum(f.km)
    if (!f.mista.trim() || !f.mihin.trim() || !Number.isFinite(kmNum) || kmNum <= 0) return
    setSaving(true)
    const result = await insertOrQueue('trips', {
      organization_id: profile.organization_id, user_id: user.id, user_name: profile.full_name ?? '',
      pvm: f.pvm, mista: f.mista.trim(), mihin: f.mihin.trim(), km: kmNum,
      meno_paluu: f.menoPaluu, selite: f.selite.trim() || null,
    })
    setToast(result === 'saved' ? 'Ajo kirjattu' : 'Ajo tallennettu — lähetetään kun verkko palaa')
    setAddOpen(false)
    setF({ pvm: today(), mista: 'Koti', mihin: '', km: '', menoPaluu: true, selite: '' })
    if (result === 'saved') fetchAll()
    setSaving(false)
  }

  async function removeTrip(id: string) {
    const { error: delErr } = await supabase.from('trips').delete().eq('id', id)
    if (delErr) setToast('Poisto epäonnistui')
    else fetchAll()
  }

  // Kuukausikooste
  const months = useMemo(() => {
    const m = new Map<string, { km: number; count: number }>()
    for (const t of trips) {
      const key = t.pvm.slice(0, 7)
      const g = m.get(key) ?? { km: 0, count: 0 }
      g.km += t.km * (t.meno_paluu ? 2 : 1)
      g.count++
      m.set(key, g)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [trips])

  const rateNum = parseNum(rate) || 0
  const kohteet = ['Koti', ...worksites.map((w) => w.name)]
  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Car className="w-4 h-4 text-amber-500" /> Ajopäiväkirja
        </h1>
        <button onClick={() => setAddOpen(true)} aria-label="Lisää ajo" className="ml-auto p-3 text-amber-400">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md mx-auto space-y-4">
        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {!home && (
              <button onClick={saveHome}
                className="w-full flex items-center gap-2.5 bg-gray-900 border border-dashed border-gray-700 rounded-2xl px-4 py-3 text-left text-sm">
                <Home className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  <span className="font-semibold block">Tallenna kotipiste</span>
                  <span className="text-xs text-gray-500">Paina tätä kotona — sen jälkeen km lasketaan automaattisesti koti ↔ työmaa.</span>
                </span>
              </button>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-300">Korvaus €/km</span>
              <input type="text" inputMode="decimal" value={rate}
                onChange={(e) => { setRate(e.target.value); localStorage.setItem(RATE_KEY, e.target.value) }}
                className="w-20 px-3 py-2 text-sm text-right bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>

            {months.map(([month, g]) => (
              <section key={month} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {new Date(month + '-01').toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })}
                  </h2>
                  <span className="text-xs font-bold tabular-nums text-gray-300">
                    {String(Math.round(g.km * 10) / 10).replace('.', ',')} km · {eur(g.km * rateNum)}
                  </span>
                </div>
                {trips.filter((t) => t.pvm.startsWith(month)).map((t) => (
                  <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {t.mista} {t.meno_paluu ? '⇄' : '→'} {t.mihin}
                        <span className="text-gray-400 font-normal"> · {String(t.km * (t.meno_paluu ? 2 : 1)).replace('.', ',')} km</span>
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(t.pvm)}{t.selite ? ` · ${t.selite}` : ''}</p>
                    </div>
                    <button onClick={() => removeTrip(t.id)} aria-label="Poista ajo" className="p-3 text-gray-600 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </section>
            ))}
            {trips.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">
                Ei vielä ajoja. Kirjaa koti–työmaa-ajot +-napista — kilometrit lasketaan valmiiksi kun kotipiste ja työmaan sijainti tunnetaan.
              </p>
            )}
          </>
        )}
      </main>

      {/* Lisää ajo */}
      {addOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Lisää ajo</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <input type="date" value={f.pvm} onChange={(e) => setF({ ...f, pvm: e.target.value })} className={inputCls} />

            <p className="text-xs font-semibold text-gray-500">Mistä</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {kohteet.map((k) => (
                <button key={k} onClick={() => setF({ ...f, mista: k, km: '' })}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold ${f.mista === k ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {k}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-500">Mihin</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {kohteet.map((k) => (
                <button key={k} onClick={() => setF({ ...f, mihin: k, km: '' })}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold ${f.mihin === k ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {k}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <input type="text" inputMode="decimal" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })}
                placeholder="km (yhteen suuntaan)" className={`${inputCls} flex-1`} />
              <button onClick={() => setF({ ...f, menoPaluu: !f.menoPaluu })}
                className={`px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 ${f.menoPaluu ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
                <ArrowLeftRight className="w-4 h-4" /> Meno-paluu
              </button>
            </div>
            {f.km !== '' && coordsOf(f.mista) && coordsOf(f.mihin) && (
              <p className="text-[11px] text-gray-500 flex items-center gap-1"><LocateFixed className="w-3 h-3" /> Automaattinen tie-arvio — korjaa jos matkamittari näyttää muuta.</p>
            )}

            <input type="text" value={f.selite} onChange={(e) => setF({ ...f, selite: e.target.value })}
              placeholder="Selite (esim. tavarahaku varastolta)" className={inputCls} />

            <button onClick={saveTrip} disabled={!f.mista.trim() || !f.mihin.trim() || !(parseNum(f.km) > 0) || saving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Kirjataan…' : `Kirjaa ajo${f.menoPaluu && parseNum(f.km) > 0 ? ` (${String(parseNum(f.km) * 2).replace('.', ',')} km)` : ''}`}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
