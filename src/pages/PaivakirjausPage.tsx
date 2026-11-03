// Päiväkirjaus: äppi kysyy "Mikä oli päivän saldo?" ja asentaja vastaa pikanapeilla.
// Esim: 123 → Tekstiili · 22 → Kosteat · 1 h → Paikkaus → Kirjaa kaikki.
// Pikanapit ovat asentajan OMAT eniten käyttämät TES-koodit (opitaan historiasta).
// Toimii myös offline — kirjaukset jonottuvat ja lähtevät verkon palatessa.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Check, X, RefreshCw, Delete, Trash2, Search, Clock,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { eur, parseNum, today, QUICK_HOURS, KUITATTAVA_TYPES, OMA_TYPES } from '../lib/helpers'
import TekijaValinta from '../components/TekijaValinta'
import { tekijaMerkki } from '../lib/tyopari'
import type { Tekija } from '../lib/tyopari'
import { insertOrQueue } from '../lib/offline'
import { getPosition, findNearestSite } from '../lib/geo'
import AlaNav from '../components/AlaNav'

type Ws = { id: string; name: string; lat: number | null; lng: number | null; gps_sade_m: number | null }
type Tc = { id: string; code: string; description: string; price: number; unit: string }
type TodayEntry = { id: string; entry_type: string; amount: number | null; hours: number | null; total_sum: number | null; description: string | null }

type Rivi =
  | { kind: 'urakka'; tc: Tc; maara: number; tekija: Tekija }
  | { kind: 'tunti'; laji: string; tunnit: number; kuitattava: boolean; tekija: Tekija }

export default function PaivakirjausPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const hourlyRate = profile?.hourly_rate ?? 0

  const [worksites, setWorksites] = useState<Ws[]>([])
  const [codes, setCodes] = useState<Tc[]>([])
  const [topCodeIds, setTopCodeIds] = useState<string[]>([])
  const [todays, setTodays] = useState<TodayEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [wsId, setWsId] = useState<string | null>(null)
  const [maara, setMaara] = useState('')
  const [selCode, setSelCode] = useState<Tc | null>(null)
  const [rivit, setRivit] = useState<Rivi[]>([])
  const [tuntiMode, setTuntiMode] = useState(false)
  const [tuntiLaji, setTuntiLaji] = useState('Paikkaus')
  const [tuntiKuitattava, setTuntiKuitattava] = useState(true)
  // Työpari: kenen työtä rivi on (ilman työparia aina 'mina')
  const pariNimi = profile?.tyopari_nimi?.trim() || ''
  const [tekija, setTekija] = useState<Tekija>('molemmat')
  const tekijaNyt: Tekija = pariNimi ? tekija : 'mina'
  const [haku, setHaku] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    if (!user) return
    setError(null)
    const [wsRes, tcRes, histRes, todayRes] = await Promise.all([
      supabase.from('worksites').select('id, name, lat, lng, gps_sade_m').eq('status', 'active').order('name'),
      supabase.from('tes_codes').select('id, code, description, price, unit').eq('active', true).order('code'),
      supabase.from('entries').select('tes_code_id').eq('user_id', user.id).not('tes_code_id', 'is', null).limit(500),
      supabase.from('entries').select('id, entry_type, amount, hours, total_sum, description').eq('user_id', user.id).eq('entry_date', today()),
    ])
    if (wsRes.error || tcRes.error) { setError('Tietojen haku epäonnistui.'); setLoading(false); return }
    setWorksites(wsRes.data ?? [])
    setCodes((tcRes.data ?? []).map((c) => ({ ...c, price: Number(c.price) })))
    setTodays((todayRes.data ?? []).map((e) => ({ ...e, amount: e.amount === null ? null : Number(e.amount), hours: e.hours === null ? null : Number(e.hours), total_sum: e.total_sum === null ? null : Number(e.total_sum) })))
    // Omat suosikit: eniten käytetyt koodit historiasta
    const counts = new Map<string, number>()
    for (const h of histRes.data ?? []) {
      if (h.tes_code_id) counts.set(h.tes_code_id, (counts.get(h.tes_code_id) ?? 0) + 1)
    }
    setTopCodeIds([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id))
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  // GPS esivalitsee työmaan jos ollaan paikan päällä
  useEffect(() => {
    if (wsId || worksites.length === 0 || !profile?.gps_sallittu) return
    getPosition(5000).then((pos) => {
      if (!pos) return
      const hit = findNearestSite(worksites, pos.lat, pos.lng)
      if (hit) setWsId(hit.site.id)
    })
  }, [worksites, wsId, profile])

  const quickCodes = useMemo(() => {
    const top = topCodeIds.map((id) => codes.find((c) => c.id === id)).filter(Boolean) as Tc[]
    return top.length > 0 ? top : codes.slice(0, 6)
  }, [topCodeIds, codes])

  const searchResults = useMemo(() => {
    const q = haku.toLowerCase().trim()
    if (!q) return []
    return codes.filter((c) => `${c.code} ${c.description}`.toLowerCase().includes(q)).slice(0, 6)
  }, [haku, codes])

  const maaraNum = parseNum(maara)
  const maaraValid = Number.isFinite(maaraNum) && maaraNum > 0

  function press(k: string) {
    if (k === 'back') { setMaara((v) => v.slice(0, -1)); return }
    if (k === ',') { setMaara((v) => (v.includes(',') || v === '' ? v : v + ',')); return }
    setMaara((v) => (v.length >= 6 ? v : v + k))
  }

  // Järjestyksellä ei ole väliä: määrä ensin tai työlaji ensin — kumpikin käy.
  // Kun molemmat ovat kasassa, rivi syntyy — kummin päin tahansa.
  function addUrakka(tc: Tc) {
    if (maaraValid) {
      setRivit((r) => [...r, { kind: 'urakka', tc, maara: maaraNum, tekija: tekijaNyt }])
      setMaara('')
      setHaku('')
      setSelCode(null)
    } else if (selCode?.id === tc.id) {
      setSelCode(null) // toinen painallus peruu valinnan
    } else {
      setSelCode(tc)
      setHaku('')
    }
  }

  function addSelected() {
    if (!selCode || !maaraValid) return
    setRivit((r) => [...r, { kind: 'urakka', tc: selCode, maara: maaraNum, tekija: tekijaNyt }])
    setMaara('')
    setSelCode(null)
  }

  function addTunti(h: number) {
    setRivit((r) => [...r, { kind: 'tunti', laji: tuntiLaji, tunnit: h, kuitattava: tuntiKuitattava, tekija: tekijaNyt }])
    setTuntiMode(false)
  }

  const riviSumma = (r: Rivi) => r.kind === 'urakka' ? Math.round(r.maara * r.tc.price * 100) / 100 : r.tunnit * hourlyRate
  const yhteensa = rivit.reduce((s, r) => s + riviSumma(r), 0)
  const todaysSaldo = todays.reduce((s, e) => s + (e.entry_type === 'tunti' ? (e.hours ?? 0) * hourlyRate : (e.total_sum ?? 0)), 0)

  async function saveAll() {
    if (!user || !wsId || rivit.length === 0 || saving) return
    setSaving(true)
    let queued = 0
    for (const r of rivit) {
      const row = r.kind === 'urakka'
        ? {
            user_id: user.id, worksite_id: wsId, entry_type: 'urakka', tes_code_id: r.tc.id,
            amount: r.maara, unit_price: r.tc.price,
            total_sum: Math.round(r.maara * r.tc.price * 100) / 100,
            description: `${r.tc.code} ${r.tc.description}`, entry_date: today(),
            tekija: r.tekija,
          }
        : {
            user_id: user.id, worksite_id: wsId, entry_type: 'tunti', hours: r.tunnit,
            description: r.laji, hour_category: r.kuitattava ? 'kuitattava' : 'oma', entry_date: today(),
            tekija: r.tekija,
          }
      const result = await insertOrQueue('entries', row)
      if (result === 'queued') queued++
    }
    setToast(queued > 0
      ? `${rivit.length} kirjausta tallennettu — lähetetään kun verkko palaa`
      : `Päivän saldo kirjattu: ${eur(yhteensa)}`)
    setRivit([])
    fetchAll()
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">Kirjaa päivä</h1>
      </header>

      <main className="px-4 py-4 pb-28 max-w-md mx-auto space-y-4">
        {loading && <div className="bg-gray-900 rounded-xl h-40 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {todays.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-400">Tänään jo kirjattu</span>
                <span className="text-sm font-semibold tabular-nums">{eur(todaysSaldo)} · {todays.length} kirjausta</span>
              </div>
            )}

            {/* 1. Työmaa */}
            <section>
              <p className="text-sm font-medium text-gray-400 mb-2">Työmaa</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
                {worksites.map((w) => (
                  <button key={w.id} onClick={() => setWsId(w.id)}
                    className={`shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold ${wsId === w.id ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                    {w.name}
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Määrä + pikanapit */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              {pariNimi && <TekijaValinta value={tekija} onChange={setTekija} pariNimi={pariNimi} />}
              <div className="flex items-baseline justify-between bg-gray-800 rounded-xl px-4 py-3">
                <span className="text-3xl font-bold tabular-nums">
                  {maara || '0'}
                  {selCode && <span className="text-base font-semibold text-gray-400 ml-1.5">{selCode.unit}</span>}
                </span>
                <button onClick={() => setTuntiMode(true)} className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Kirjaan tunteja
                </button>
              </div>
              {selCode && !maaraValid && (
                <p className="text-xs text-amber-300/90">{selCode.code} {selCode.description} valittu — näppäile määrä</p>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', 'back'].map((k) => (
                  <button key={k} onClick={() => press(k)}
                    className="h-10 rounded-xl bg-gray-800 text-lg font-bold flex items-center justify-center active:bg-gray-700 transition-colors">
                    {k === 'back' ? <Delete className="w-5 h-5" /> : k}
                  </button>
                ))}
              </div>

              {selCode && maaraValid && (
                <button onClick={addSelected}
                  className="w-full py-3 bg-amber-500 text-gray-950 font-bold rounded-xl active:scale-95 transition-transform">
                  Lisää {maara} {selCode.unit} · {selCode.description.length > 22 ? selCode.description.slice(0, 22) + '…' : selCode.description}
                </button>
              )}

              <p className="text-xs font-semibold text-gray-500">Mitä työtä? (omat yleisimmät — järjestyksellä ei väliä)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {quickCodes.map((tc) => (
                  <button key={tc.id} onClick={() => addUrakka(tc)}
                    className={`min-h-12 px-3 py-2 rounded-xl text-left active:scale-95 transition-transform ${selCode?.id === tc.id ? 'bg-gray-100 text-gray-950' : 'bg-gray-800'}`}>
                    <span className="block text-sm font-bold leading-tight">{tc.description.length > 26 ? tc.description.slice(0, 26) + '…' : tc.description}</span>
                    <span className={`block text-[11px] ${selCode?.id === tc.id ? 'text-gray-800' : 'text-gray-500'}`}>{tc.code} · {eur(tc.price)}/{tc.unit}</span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="search" value={haku} onChange={(e) => setHaku(e.target.value)}
                  placeholder="Hae muu työlaji (koodi tai nimi)…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {searchResults.map((tc) => (
                <button key={tc.id} onClick={() => addUrakka(tc)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800 text-left text-sm">
                  <b>{tc.code}</b> {tc.description} <span className="text-gray-500">· {eur(tc.price)}/{tc.unit}</span>
                </button>
              ))}
            </section>

            {/* 3. Kertyneet rivit */}
            {rivit.length > 0 && (
              <section className="bg-gray-900 border border-amber-500/40 rounded-xl p-4 space-y-2">
                {rivit.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {r.kind === 'urakka'
                        ? <>{String(r.maara).replace('.', ',')} {r.tc.unit} · {r.tc.description}</>
                        : <>{String(r.tunnit).replace('.', ',')} h · {r.laji} <span className="text-gray-500">({r.kuitattava ? 'kuitattava' : 'Heikkinen'})</span></>}
                      {tekijaMerkki(r.tekija, pariNimi) && <span className="text-gray-500"> · {tekijaMerkki(r.tekija, pariNimi)}</span>}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <b className="tabular-nums">{eur(riviSumma(r))}</b>
                      <button onClick={() => setRivit((x) => x.filter((_, j) => j !== i))} aria-label="Poista rivi" className="p-1 text-gray-600 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-800 pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Päivän saldo</span>
                  <span className="text-lg font-semibold tabular-nums">{eur(yhteensa)}</span>
                </div>
                <button onClick={saveAll} disabled={!wsId || saving}
                  className="w-full h-13 py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" /> {saving ? 'Kirjataan…' : !wsId ? 'Valitse työmaa ensin' : `Kirjaa ${rivit.length} riviä`}
                </button>
              </section>
            )}
          </>
        )}
      </main>

      {/* Tuntien pikakirjaus */}
      {tuntiMode && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setTuntiMode(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> Tunnit</h3>
              <button onClick={() => setTuntiMode(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            {pariNimi && <TekijaValinta value={tekija} onChange={setTekija} pariNimi={pariNimi} />}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setTuntiKuitattava(true); setTuntiLaji(KUITATTAVA_TYPES[0]) }}
                className={`py-3 rounded-xl text-sm font-bold ${tuntiKuitattava ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Kuitattavat
              </button>
              <button onClick={() => { setTuntiKuitattava(false); setTuntiLaji(OMA_TYPES[0]) }}
                className={`py-3 rounded-xl text-sm font-bold ${!tuntiKuitattava ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Heikkisen tunnit
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(tuntiKuitattava ? KUITATTAVA_TYPES : OMA_TYPES).map((t) => (
                <button key={t} onClick={() => setTuntiLaji(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${tuntiLaji === t ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-500">Montako tuntia?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {QUICK_HOURS.map((h) => (
                <button key={h} onClick={() => addTunti(parseNum(h))}
                  className="py-3.5 rounded-xl bg-gray-800 text-base font-bold active:bg-gray-700 transition-colors">
                  {h} h
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" /> {toast}
        </div>
      )}

      <AlaNav />
    </div>
  )
}
