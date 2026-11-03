// Ilmoitusasetukset: jokainen säätää itse — päälle/pois, kellonaika ja päivät.
// Linjaus: välitön hälytys vain kiiretarpeesta (työnjohto). Päiväsaldo on
// käyttäjän oma ajastettu muistutus, esim. arkisin klo 15.20.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, BellOff, Check, AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { pushSupported, getCurrentSubscription, subscribePush, unsubscribePush } from '../lib/push'

type Sub = {
  id: string; endpoint: string
  kiire_paalla: boolean
  saldo_paalla: boolean; saldo_klo: string; saldo_paivat: number[]
}

const PAIVAT = [
  { n: 1, l: 'ma' }, { n: 2, l: 'ti' }, { n: 3, l: 'ke' }, { n: 4, l: 'to' },
  { n: 5, l: 'pe' }, { n: 6, l: 'la' }, { n: 7, l: 'su' },
]

export default function IlmoituksetPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isLead = ['tyonjohtaja', 'johtaja'].includes(profile?.role ?? '')

  const [sub, setSub] = useState<Sub | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const fetchSub = useCallback(async () => {
    const current = await getCurrentSubscription()
    if (!current) { setSub(null); setLoading(false); return }
    const { data } = await supabase.from('push_subscriptions')
      .select('id, endpoint, kiire_paalla, saldo_paalla, saldo_klo, saldo_paivat')
      .eq('endpoint', current.endpoint).maybeSingle()
    setSub((data as Sub) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSub() }, [fetchSub])

  async function enable() {
    if (!user || !profile || busy) return
    setBusy(true)
    const endpoint = await subscribePush(user.id, profile.full_name ?? '', profile.organization_id)
    if (!endpoint) setToast('Ilmoituslupaa ei saatu — tarkista selaimen asetukset')
    else { setToast('Ilmoitukset käytössä tällä laitteella'); await fetchSub() }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    await unsubscribePush()
    setSub(null)
    setToast('Ilmoitukset pois tältä laitteelta')
    setBusy(false)
  }

  async function patch(p: Partial<Sub>) {
    if (!sub) return
    const next = { ...sub, ...p }
    setSub(next)
    const { error } = await supabase.from('push_subscriptions')
      .update({ ...p, updated_at: new Date().toISOString() }).eq('id', sub.id)
    if (error) { setToast('Tallennus epäonnistui'); fetchSub() }
  }

  function toggleDay(n: number) {
    if (!sub) return
    const days = sub.saldo_paivat.includes(n)
      ? sub.saldo_paivat.filter((d) => d !== n)
      : [...sub.saldo_paivat, n].sort()
    patch({ saldo_paivat: days })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" /> Ilmoitukset
        </h1>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md mx-auto space-y-4">
        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}

        {!loading && !pushSupported() && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-sm text-gray-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
              Tämä selain ei tue push-ilmoituksia. iPhonella: asenna äppi ensin kotinäytölle (Jaa → Lisää Koti-valikkoon) ja avaa se sieltä — sen jälkeen ilmoitukset toimivat.
            </p>
          </div>
        )}

        {!loading && pushSupported() && !sub && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <p className="text-sm text-gray-300 leading-relaxed">
              Ilmoitukset ovat laitekohtaisia ja täysin sinun hallinnassasi.
              {isLead ? ' Työnjohtona saat kiiretarpeet heti — muusta ei piipata.' : ' Saat halutessasi ajastetun päiväsaldon — muusta ei piipata.'}
            </p>
            <button onClick={enable} disabled={busy}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Bell className="w-4 h-4" /> {busy ? 'Otetaan käyttöön…' : 'Ota ilmoitukset käyttöön'}
            </button>
          </div>
        )}

        {!loading && sub && (
          <>
            {isLead && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-400" /> Kiiretarpeet heti</p>
                  <p className="text-xs text-gray-500 mt-0.5">Hälytys vain kun joku seisoo ilman materiaalia. Ei muusta.</p>
                </div>
                <button onClick={() => patch({ kiire_paalla: !sub.kiire_paalla })}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${sub.kiire_paalla ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
                  {sub.kiire_paalla ? 'Päällä' : 'Pois'}
                </button>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Päivän saldo</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ajastettu ilmoitus: paljonko tänään kertyi. Muistuttaa myös kirjaamaan.</p>
                </div>
                <button onClick={() => patch({ saldo_paalla: !sub.saldo_paalla })}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${sub.saldo_paalla ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
                  {sub.saldo_paalla ? 'Päällä' : 'Pois'}
                </button>
              </div>

              {sub.saldo_paalla && (
                <>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-semibold text-gray-500">Kellonaika</p>
                    <input type="time" value={sub.saldo_klo}
                      onChange={(e) => patch({ saldo_klo: e.target.value })}
                      className="px-3.5 py-2.5 text-base bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Päivät</p>
                    <div className="flex gap-1.5">
                      {PAIVAT.map((p) => (
                        <button key={p.n} onClick={() => toggleDay(p.n)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${sub.saldo_paivat.includes(p.n) ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
                          {p.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Ilmoitus lähtee valittuina päivinä noin valitulla minuutilla (Suomen aikaa), yhden kerran päivässä.
                  </p>
                </>
              )}
            </div>

            <button onClick={disable} disabled={busy}
              className="w-full py-3 bg-gray-900 border border-gray-800 rounded-2xl text-sm font-semibold text-gray-400 flex items-center justify-center gap-2">
              <BellOff className="w-4 h-4" /> Poista ilmoitukset tältä laitteelta
            </button>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}
