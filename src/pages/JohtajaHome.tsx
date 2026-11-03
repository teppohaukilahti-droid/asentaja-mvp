// Johtajan näkymä v2 — "Riidaton mittaristo".
// Periaate: jokainen luku aukeaa allekirjoitukseen asti (kate → työmaa → rivit →
// lukittu pöytäkirja). Kolmen lauseen viikko on laskettua suomea (EI AI:ta).
// Kaksi toimintoa suoraan näkymästä: Kysy työnjohtajalta + Vie laskutukseen.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, RefreshCw, Clock, Building2, ChevronRight, Archive,
  UserCheck, Wrench, HardHat, Star, CalendarDays, Banknote, Bell, X, Check,
  MessageCircleQuestion, Scale, TrendingUp, TrendingDown, AlertTriangle, Landmark,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { eur } from '../lib/helpers'
import { kateEnnuste, kolmeLausetta } from '../lib/johtaja'
import type { KateTulos, Lause, ViikkoTilanne } from '../lib/johtaja'

type Entry = { worksite_id: string; entry_type: string; amount: number | null; hours: number | null; total_sum: number | null; entry_date: string }
type Ws = {
  id: string; name: string; client_company: string | null; status: string
  urakkasumma: number | null; tavoite_kate_pct: number | null; valmius_pct: number | null
}
type Pickup = { id: string; product_name: string; maara: number; unit: string; user_name: string | null; worksites: { name: string } | null }
type Yksikko = { id: string; nimi: string; kate_pct: number | null; hukka_pct: number | null; tuntia_m2: number | null; laskuttamaton_eur: number | null; demo: boolean }

function mondayOfWeek(): string {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // ma=0
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
const daysAgoISO = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const pctFmt = (n: number) => `${n.toFixed(1).replace('.', ',')} %`

export default function JohtajaHome() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const [entries, setEntries] = useState<Entry[]>([])
  const [worksites, setWorksites] = useState<Ws[]>([])
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [yksikot, setYksikot] = useState<Yksikko[]>([])
  const [toolsVialla, setToolsVialla] = useState(0)
  const [toolsEtsinnassa, setToolsEtsinnassa] = useState(0)
  const [myohassa, setMyohassa] = useState(0)
  const [eskaloidut, setEskaloidut] = useState(0)
  const [avgStars, setAvgStars] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Kysy työnjohtajalta -sheet
  const [kysyWs, setKysyWs] = useState<{ id: string | null; name: string } | null>(null)
  const [kysyTeksti, setKysyTeksti] = useState('')
  const [kysySaving, setKysySaving] = useState(false)
  const [viemassa, setViemassa] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const today = new Date().toISOString().slice(0, 10)
    const [entRes, wsRes, pickRes, yksRes, toolRes, reqRes, mitRes, palRes] = await Promise.all([
      supabase.from('entries').select('worksite_id, entry_type, amount, hours, total_sum, entry_date'),
      supabase.from('worksites').select('id, name, client_company, status, urakkasumma, tavoite_kate_pct, valmius_pct').order('created_at', { ascending: false }),
      supabase.from('material_pickups').select('id, product_name, maara, unit, user_name, worksites(name)').eq('status', 'kirjattu').eq('suunta', 'otto'),
      supabase.from('konserni_yksikot').select('id, nimi, kate_pct, hukka_pct, tuntia_m2, laskuttamaton_eur, demo').order('kate_pct', { ascending: false }),
      supabase.from('tools').select('id, status, vika_ilmoitettu'),
      supabase.from('material_requests').select('id', { count: 'exact', head: true }).lt('toimitus_pvm', today).not('toimitus_pvm', 'is', null).neq('status', 'toimitettu'),
      supabase.from('mittapoytakirjat').select('id', { count: 'exact', head: true }).eq('eskaloitu', true).neq('status', 'lukittu'),
      supabase.from('mestari_palaute').select('tahdet'),
    ])
    if (entRes.error || wsRes.error) {
      setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setEntries((entRes.data ?? []) as Entry[])
      setWorksites((wsRes.data ?? []) as Ws[])
      setPickups((pickRes.data ?? []) as unknown as Pickup[])
      setYksikot((yksRes.data ?? []) as Yksikko[])
      const tools = (toolRes.data ?? []) as Array<{ status: string; vika_ilmoitettu: string | null }>
      setToolsVialla(tools.filter((t) => t.vika_ilmoitettu !== null).length)
      setToolsEtsinnassa(tools.filter((t) => t.status === 'kadonnut').length)
      setMyohassa(reqRes.count ?? 0)
      setEskaloidut(mitRes.count ?? 0)
      const stars = (palRes.data ?? []).map((p: { tahdet: number | null }) => p.tahdet).filter((t): t is number => t != null)
      setAvgStars(stars.length ? stars.reduce((a: number, b: number) => a + b, 0) / stars.length : null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Laskenta ──
  const activeSites = useMemo(() => worksites.filter((w) => w.status === 'active'), [worksites])

  const siteCost = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) m.set(e.worksite_id, (m.get(e.worksite_id) ?? 0) + Number(e.total_sum ?? 0))
    return m
  }, [entries])

  const kateRivit: KateTulos[] = useMemo(
    () => activeSites.map((w) => kateEnnuste({
      worksiteId: w.id, name: w.name,
      urakkasumma: w.urakkasumma != null ? Number(w.urakkasumma) : null,
      tavoiteKatePct: w.tavoite_kate_pct != null ? Number(w.tavoite_kate_pct) : null,
      valmiusPct: w.valmius_pct, kustannus: siteCost.get(w.id) ?? 0,
    })),
    [activeSites, siteCost],
  )

  const week = useMemo(() => {
    const monday = mondayOfWeek()
    const wk = entries.filter((e) => e.entry_date >= monday)
    return {
      tunnit: wk.filter((e) => e.entry_type === 'tunti').reduce((s, e) => s + Number(e.hours ?? 0), 0),
      urakkaEur: wk.filter((e) => e.entry_type !== 'tunti').reduce((s, e) => s + Number(e.total_sum ?? 0), 0),
      kirjauksia: wk.length,
    }
  }, [entries])

  // Hiljainen työmaa: kirjauksia on ollut, mutta ei viimeiseen 3 päivään
  const hiljaiset = useMemo(() => {
    const raja = daysAgoISO(3)
    return activeSites
      .filter((w) => {
        const siteEntries = entries.filter((e) => e.worksite_id === w.id)
        return siteEntries.length > 0 && !siteEntries.some((e) => e.entry_date >= raja)
      })
      .map((w) => {
        const viimeisin = entries.filter((e) => e.worksite_id === w.id).map((e) => e.entry_date).sort().at(-1)!
        const paivia = Math.floor((Date.now() - new Date(viimeisin).getTime()) / 86400000)
        return { worksiteId: w.id, name: w.name, paivia }
      })
  }, [activeSites, entries])

  const tilanne: ViikkoTilanne = useMemo(() => ({
    kateRivit, laskuttamatonKpl: pickups.length, hiljaisetTyomaat: hiljaiset,
    myohassaToimituksia: myohassa, koneitaVialla: toolsVialla, koneitaEtsinnassa: toolsEtsinnassa,
    kirjauksiaViikolla: week.kirjauksia,
  }), [kateRivit, pickups.length, hiljaiset, myohassa, toolsVialla, toolsEtsinnassa, week.kirjauksia])

  const lauseet = useMemo(() => kolmeLausetta(tilanne), [tilanne])

  // Oma yksikkö yksikkövertailuun (live-rivi demorivien rinnalle)
  const omaYksikko = useMemo(() => {
    const mitatut = kateRivit.filter((r) => r.ennustePct != null && r.urakkasumma)
    const painotettu = mitatut.reduce((s, r) => s + r.ennustePct! * r.urakkasumma!, 0)
    const summa = mitatut.reduce((s, r) => s + r.urakkasumma!, 0)
    const tunnit = entries.filter((e) => e.entry_type === 'tunti').reduce((s, e) => s + Number(e.hours ?? 0), 0)
    const m2 = entries.filter((e) => e.entry_type !== 'tunti').reduce((s, e) => s + Number(e.amount ?? 0), 0)
    return {
      kate: summa > 0 ? painotettu / summa : null,
      tuntiaM2: m2 > 0 ? tunnit / m2 : null,
      laskuttamatonKpl: pickups.length,
    }
  }, [kateRivit, entries, pickups.length])

  // ── Toiminnot ──
  function avaaLause(l: Lause) {
    if (l.kohde.tyyppi === 'tyomaa') navigate(`/tyomaa/${l.kohde.worksiteId}`)
    else if (l.kohde.tyyppi === 'laskutus') navigate('/raportti')
    else if (l.kohde.tyyppi === 'tyokalut') navigate('/tyokalut')
  }

  async function lahetaKysymys() {
    if (!user || !profile || !kysyTeksti.trim() || kysySaving) return
    setKysySaving(true)
    const { error: e } = await supabase.from('tehtavat').insert({
      organization_id: profile.organization_id,
      pvm: new Date().toISOString().slice(0, 10),
      teksti: `Johtajan kysymys${kysyWs?.name ? ` (${kysyWs.name})` : ''}: ${kysyTeksti.trim()}`,
      worksite_id: kysyWs?.id ?? null,
      lahde: 'johtaja',
      created_by: user.id,
      created_by_name: profile.full_name ?? '',
    })
    if (e) setToast('Kysymyksen lähetys epäonnistui')
    else { setToast('Kysymys lähti työnjohtajan tehtävälistalle'); setKysyWs(null); setKysyTeksti('') }
    setKysySaving(false)
  }

  async function vieLaskutukseen() {
    if (viemassa || pickups.length === 0) return
    setViemassa(true)
    const { error: e } = await supabase.from('material_pickups')
      .update({ status: 'laskutettu' }).in('id', pickups.map((p) => p.id))
    if (e) setToast('Vienti epäonnistui')
    else { setToast(`${pickups.length} hakua merkitty laskutetuiksi`); fetchAll() }
    setViemassa(false)
  }

  const sectionTitle = 'text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2'
  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">FloorData</h1>
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider -mt-0.5">Johtaja</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/kalenteri')} aria-label="Kalenteri" title="Kalenteri" className="p-3 text-amber-400 hover:text-amber-300 transition-colors">
            <CalendarDays className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/ilmoitukset')} aria-label="Ilmoitukset" className="p-3 text-gray-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/kayttajat')} aria-label="Käyttäjät" className="p-3 text-gray-400 hover:text-white transition-colors">
            <UserCheck className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/arkisto')} aria-label="Arkisto" className="p-3 text-gray-400 hover:text-white transition-colors">
            <Archive className="w-5 h-5" />
          </button>
          <button onClick={signOut} aria-label="Kirjaudu ulos" title="Kirjaudu ulos" className="p-3 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md lg:max-w-5xl mx-auto space-y-5">
        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ===== 1. KOLMEN LAUSEEN VIIKKO — laskettua suomea, ei AI:ta ===== */}
            <section className="space-y-2">
              <p className={sectionTitle}>Viikko kolmella lauseella</p>
              {lauseet.map((l, i) => (
                <button key={i} onClick={() => avaaLause(l)} disabled={l.kohde.tyyppi === 'ei'}
                  className={`w-full text-left rounded-2xl px-4 py-3.5 border transition-colors ${
                    l.sav === 'huono' ? 'bg-gray-900 border-red-900/50 hover:border-red-800'
                    : l.sav === 'hyva' ? 'bg-gray-900 border-green-900/50 hover:border-green-800'
                    : 'bg-gray-900 border-gray-800'} ${l.kohde.tyyppi === 'ei' ? '' : 'cursor-pointer'}`}>
                  <span className="flex items-start gap-2.5">
                    {l.sav === 'huono' ? <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      : l.sav === 'hyva' ? <TrendingUp className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      : <Check className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />}
                    <span className="text-sm leading-snug">{l.teksti}</span>
                    {l.kohde.tyyppi !== 'ei' && <ChevronRight className="w-4 h-4 text-gray-600 ml-auto mt-0.5 shrink-0" />}
                  </span>
                </button>
              ))}
              <p className="text-[11px] text-gray-600">Laskettu suoraan kuitatuista kirjauksista — ei tekoälyä. Jokainen luku aukeaa allekirjoitukseen asti.</p>
            </section>

            <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
              <div className="space-y-5">
                {/* ===== 2. KATE-VAAKA ===== */}
                <section className="space-y-2">
                  <p className={sectionTitle}><Scale className="w-4 h-4" /> Kate-vaaka työmaittain</p>
                  {kateRivit.length === 0 && <p className="text-gray-500 text-sm">Ei aktiivisia työmaita.</p>}
                  {kateRivit.map((r) => (
                    <div key={r.worksiteId} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
                      <button onClick={() => navigate(`/tyomaa/${r.worksiteId}`)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{r.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                              {r.urakkasumma
                                ? `${eur(r.kustannus)} / urakka ${eur(r.urakkasumma)}${r.valmiusPct ? ` · valmius ${r.valmiusPct} %` : ' · valmius ?'}`
                                : `kustannus ${eur(r.kustannus)} · urakkasumma puuttuu`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {r.ennustePct != null ? (
                              <>
                                <p className={`text-lg font-bold tabular-nums leading-none ${
                                  r.fade != null && r.fade < -2 ? 'text-red-400' : r.fade != null && r.fade > 1 ? 'text-green-400' : 'text-gray-200'}`}>
                                  {pctFmt(r.ennustePct)}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                  kate-ennuste{r.tavoiteKatePct != null ? ` / tavoite ${pctFmt(r.tavoiteKatePct)}` : ''}
                                </p>
                              </>
                            ) : (
                              <p className="text-[11px] text-gray-600 max-w-24 text-right">syötä urakkasumma ja valmius</p>
                            )}
                          </div>
                        </div>
                        {/* Vaaka: kustannus vs urakka */}
                        {r.urakkasumma != null && r.urakkasumma > 0 && (
                          <div className="mt-2.5 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                            <div className={`h-full ${r.fade != null && r.fade < -2 ? 'bg-red-500/70' : 'bg-green-500/60'}`}
                              style={{ width: `${Math.min(100, (r.kustannus / r.urakkasumma) * 100)}%` }} />
                          </div>
                        )}
                      </button>
                      <button onClick={() => { setKysyWs({ id: r.worksiteId, name: r.name }); setKysyTeksti('') }}
                        className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 py-1">
                        <MessageCircleQuestion className="w-3.5 h-3.5" /> Kysy työnjohtajalta
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-600">Napautus avaa työmaan: kirjausrivit → lukittu pöytäkirja → mestarin allekirjoitus. Riidaton luku.</p>
                </section>

                {/* ===== 3. LASKUTTAMATON RAHA ===== */}
                <section className="space-y-2">
                  <p className={sectionTitle}><Banknote className="w-4 h-4" /> Laskuttamaton raha</p>
                  <div className={`bg-gray-900 border rounded-2xl p-4 ${pickups.length > 0 ? 'border-amber-500/40' : 'border-gray-800'}`}>
                    <p className="text-2xl font-bold tabular-nums leading-none">{pickups.length}</p>
                    <p className="text-[11px] text-gray-500 mt-1">laskuttamatonta varastohakua{eskaloidut > 0 ? ` · ${eskaloidut} eskaloitua pöytäkirjaa` : ''}</p>
                    {pickups.slice(0, 3).map((p) => (
                      <p key={p.id} className="text-xs text-gray-400 mt-1.5 truncate">
                        {p.product_name} {String(p.maara).replace('.', ',')} {p.unit} → {p.worksites?.name ?? ''}
                      </p>
                    ))}
                    {pickups.length > 3 && <p className="text-xs text-gray-600 mt-1">+ {pickups.length - 3} muuta</p>}
                    {pickups.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={() => navigate('/raportti')} className="py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold">
                          Avaa laskutuspino
                        </button>
                        <button onClick={vieLaskutukseen} disabled={viemassa}
                          className="py-2.5 bg-amber-500 text-gray-950 rounded-xl text-xs font-bold disabled:opacity-40">
                          {viemassa ? 'Viedään…' : 'Merkitse laskutetuiksi'}
                        </button>
                      </div>
                    )}
                    {pickups.length === 0 && <p className="text-xs text-green-400/80 mt-1.5">Kaikki haut laskutettu — ei rahaa pöydällä.</p>}
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                {/* ===== 4. YKSIKKÖVERTAILU ===== */}
                <section className="space-y-2">
                  <p className={sectionTitle}><Landmark className="w-4 h-4" /> Yksikkövertailu
                    {yksikot.some((y) => y.demo) && <span className="text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-full px-2 py-0.5">DEMO</span>}
                  </p>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800">
                      <span>Yksikkö</span><span className="text-right">Kate</span><span className="text-right">Hukka</span><span className="text-right">h/m²</span>
                    </div>
                    {[{ id: 'oma', nimi: 'Oma yksikkö', kate_pct: omaYksikko.kate, hukka_pct: null, tuntia_m2: omaYksikko.tuntiaM2, laskuttamaton_eur: null, demo: false, live: true },
                      ...yksikot.map((y) => ({ ...y, live: false }))]
                      .sort((a, b) => (b.kate_pct ?? -999) - (a.kate_pct ?? -999))
                      .map((y) => (
                        <div key={y.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2.5 border-b border-gray-800/60 last:border-0 items-baseline">
                          <span className="text-sm font-semibold truncate">
                            {y.nimi}{y.live && <span className="ml-1.5 text-[9px] font-bold text-amber-400 uppercase">live</span>}
                          </span>
                          <span className={`text-sm font-bold tabular-nums text-right ${
                            y.kate_pct != null && y.kate_pct >= 13 ? 'text-green-400' : y.kate_pct != null && y.kate_pct < 10 ? 'text-red-400' : 'text-gray-200'}`}>
                            {y.kate_pct != null ? pctFmt(y.kate_pct) : '—'}
                          </span>
                          <span className="text-xs tabular-nums text-right text-gray-400">{y.hukka_pct != null ? pctFmt(y.hukka_pct) : '—'}</span>
                          <span className="text-xs tabular-nums text-right text-gray-400">{y.tuntia_m2 != null ? y.tuntia_m2.toFixed(2).replace('.', ',') : '—'}</span>
                        </div>
                      ))}
                  </div>
                  <p className="text-[11px] text-gray-600">Ero selittyy ajureista: hukka-% ja tuntia/m². Konsernitaso näkee summat, ei nimiä. Tätä lukua yksikkö ei voi tuottaa itse.</p>
                </section>

                {/* ===== 5. RISKIKAISTA ===== */}
                {(hiljaiset.length > 0 || myohassa > 0 || toolsVialla > 0 || toolsEtsinnassa > 0 || eskaloidut > 0) && (
                  <section className="space-y-2">
                    <p className={sectionTitle}><AlertTriangle className="w-4 h-4 text-red-400" /> Vaatii huomiota</p>
                    {hiljaiset.map((h) => (
                      <button key={h.worksiteId} onClick={() => navigate(`/tyomaa/${h.worksiteId}`)}
                        className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-sm min-w-0 truncate">{h.name}: hiljainen työmaa — ei kirjauksia {h.paivia} pv</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      </button>
                    ))}
                    {myohassa > 0 && (
                      <button onClick={() => navigate('/kalenteri')} className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-sm">{myohassa} toimituslupaus{myohassa > 1 ? 'ta' : ''} myöhässä</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      </button>
                    )}
                    {(toolsVialla > 0 || toolsEtsinnassa > 0) && (
                      <button onClick={() => navigate('/tyokalut')} className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-sm">Kalusto: {[toolsVialla > 0 ? `${toolsVialla} vialla` : '', toolsEtsinnassa > 0 ? `${toolsEtsinnassa} etsinnässä` : ''].filter(Boolean).join(', ')}</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      </button>
                    )}
                    {eskaloidut > 0 && (
                      <button onClick={() => navigate('/tyonjohto')} className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-sm">{eskaloidut} pöytäkirja{eskaloidut > 1 ? 'a' : ''} odottaa mestarin allekirjoitusta (eskaloitu)</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      </button>
                    )}
                  </section>
                )}

                {/* ===== 6. VIIKON PERUSLUVUT + PIKALINKIT ===== */}
                <section className="space-y-2">
                  <p className={sectionTitle}><Clock className="w-4 h-4" /> Tämä viikko</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3.5">
                      <p className="text-2xl font-bold tabular-nums leading-none">{String(week.tunnit).replace('.', ',')} h</p>
                      <p className="text-[11px] text-gray-500 mt-1">tunnit tällä viikolla</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3.5">
                      <p className="text-2xl font-bold tabular-nums leading-none">{eur(week.urakkaEur)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">urakat tällä viikolla</p>
                    </div>
                  </div>
                  {avgStars !== null && (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-300 flex items-center gap-2"><Star className="w-4 h-4 text-gray-500" /> Mestaripalaute keskimäärin</span>
                      <span className="text-sm font-bold tabular-nums">{avgStars.toFixed(1).replace('.', ',')} / 5</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => navigate('/tyonjohto')} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-2xl px-3.5 py-3 text-sm font-semibold hover:border-gray-700 transition-colors">
                      <HardHat className="w-4 h-4 text-amber-400 shrink-0" /> Työnjohto
                    </button>
                    <button onClick={() => navigate('/kalenteri')} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-2xl px-3.5 py-3 text-sm font-semibold hover:border-gray-700 transition-colors">
                      <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" /> Kalenteri
                    </button>
                    <button onClick={() => navigate('/tyokalut')} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-2xl px-3.5 py-3 text-sm font-semibold hover:border-gray-700 transition-colors">
                      <Wrench className="w-4 h-4 text-amber-400 shrink-0" /> Työkalut
                    </button>
                    <button onClick={() => navigate('/palkkakatko')} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-2xl px-3.5 py-3 text-sm font-semibold hover:border-gray-700 transition-colors">
                      <Banknote className="w-4 h-4 text-amber-400 shrink-0" /> Palkkakatko
                    </button>
                  </div>
                  <button onClick={() => { setKysyWs({ id: null, name: '' }); setKysyTeksti('') }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 border border-gray-800 rounded-2xl text-sm font-semibold text-amber-300 hover:border-gray-700 transition-colors">
                    <MessageCircleQuestion className="w-4 h-4" /> Kysy työnjohtajalta
                  </button>
                </section>
              </div>
            </div>

            {/* Työmaalista (porautumisen perusreitti) */}
            <section className="space-y-2">
              <p className={sectionTitle}><Building2 className="w-4 h-4" /> Kaikki työmaat ({activeSites.length} käynnissä)</p>
              {activeSites.map((w) => (
                <button key={w.id} onClick={() => navigate(`/tyomaa/${w.id}`)}
                  className="w-full flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 hover:border-gray-700 transition-colors text-left">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{w.name}</span>
                    {w.client_company && <span className="block text-xs text-gray-500 truncate">{w.client_company}</span>}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {(siteCost.get(w.id) ?? 0) > 0 && (
                      <span className="text-xs font-bold tabular-nums text-gray-300">{eur(siteCost.get(w.id) ?? 0)}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </span>
                </button>
              ))}
            </section>

            <p className="text-[11px] text-gray-600 text-center">
              Hei {profile?.full_name?.split(' ')[0]} — {week.kirjauksia} kirjausta tällä viikolla, jokainen kuitattuna kannassa.
            </p>
          </>
        )}
      </main>

      {/* ===== KYSY TYÖNJOHTAJALTA -SHEET ===== */}
      {kysyWs && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setKysyWs(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircleQuestion className="w-4 h-4 text-amber-400" /> Kysy työnjohtajalta{kysyWs.name ? `: ${kysyWs.name}` : ''}
              </h3>
              <button onClick={() => setKysyWs(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <input type="text" value={kysyTeksti} onChange={(e) => setKysyTeksti(e.target.value)} autoFocus
              placeholder="Esim. Miksi kustannus kasvaa nopeammin kuin valmius?" className={inputCls} />
            <button onClick={lahetaKysymys} disabled={!kysyTeksti.trim() || kysySaving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {kysySaving ? 'Lähetetään…' : 'Lähetä tehtävälistalle'}
            </button>
            <p className="text-[11px] text-gray-600">Kysymys ilmestyy työnjohtajan Oma viikko -tehtäviin tälle päivälle nimelläsi.</p>
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
