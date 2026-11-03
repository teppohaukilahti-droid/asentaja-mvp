// Työnjohdon kalenteri v3 — kolme välilehteä:
//   Resursointi: yhteinen työmaat × viikot -taulu (viikkopalaverin korvaaja)
//   Oma viikko:  lukujärjestys hälytyskaistoineen ja tehtävineen
//   Kuukausi:    pitkä tähtäin + ICS-silta puhelimen omaan kalenteriin
// Miehitys: ehdotus → hiljainen hyväksyntä 24 h → varmistettu (veto pysäyttää).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CalendarDays, RefreshCw, X, Check, AlertTriangle, Phone,
  ExternalLink, Trash2, Grid3x3, ListTodo, PackageOpen, Wrench,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDate, today, toInput, parseNum } from '../lib/helpers'
import type { Ws, Visit, Ent, Vapautus, Prof, Toimitus, Merkinta, Miehitys, Tehtava, MaterialRow, WeekCol } from '../lib/kalenteri'
import { weekColumns, effectiveEnd, overlapsWeek, daysFromToday } from '../lib/kalenteri'
import ResursointiTab from '../components/kalenteri/ResursointiTab'
import OmaViikkoTab from '../components/kalenteri/OmaViikkoTab'
import KuukausiTab from '../components/kalenteri/KuukausiTab'

type Tab = 'resursointi' | 'viikko' | 'kuukausi'

export default function KalenteriPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const canEdit = ['tyonjohtaja', 'johtaja'].includes(profile?.role ?? '')

  const [tab, setTab] = useState<Tab>('viikko')
  const [sites, setSites] = useState<Ws[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [ents, setEnts] = useState<Ent[]>([])
  const [vapautumiset, setVapautumiset] = useState<Vapautus[]>([])
  const [profs, setProfs] = useState<Prof[]>([])
  const [toimitukset, setToimitukset] = useState<Toimitus[]>([])
  const [merkinnat, setMerkinnat] = useState<Merkinta[]>([])
  const [miehitykset, setMiehitykset] = useState<Miehitys[]>([])
  const [tehtavat, setTehtavat] = useState<Tehtava[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [tyokalut, setTyokalut] = useState<{ id: string; name: string; numero: number; status: string; worksite_id: string | null; holder_id: string | null }[]>([])
  const [eskaloituja, setEskaloituja] = useState(0)
  const [icsToken, setIcsToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Sheetit
  const [kiinnitys, setKiinnitys] = useState<{ ws: Ws; week: WeekCol } | null>(null)
  const [kfUser, setKfUser] = useState<Prof | null>(null)
  const [kfAlkaa, setKfAlkaa] = useState('')
  const [kfLoppu, setKfLoppu] = useState('')
  const [kfSaving, setKfSaving] = useState(false)
  const [openM, setOpenM] = useState<Miehitys | null>(null)
  const [vastustusSyy, setVastustusSyy] = useState('')
  const [panelWs, setPanelWs] = useState<Ws | null>(null)
  const [rajaEdit, setRajaEdit] = useState<Record<string, string>>({})

  const weeks = useMemo(() => weekColumns(1, 9), [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const weekAgo = toInput(new Date(Date.now() - 7 * 86400000))
    const back60 = toInput(new Date(Date.now() - 60 * 86400000))
    const [wsRes, visRes, entRes, vapRes, profRes, reqRes, merkRes, miehRes, tehtRes, matRes, eskRes, toolRes, meRes] = await Promise.all([
      supabase.from('worksites')
        .select('id, name, client_company, status, oma_tyomaa, alkaa, arvioitu_valmis, valmius_pct, foreman_id, address, mestari_nimi, mestari_puhelin')
        .eq('status', 'active').order('name'),
      supabase.from('site_visits').select('worksite_id, user_name, pvm').gte('pvm', weekAgo),
      supabase.from('entries').select('worksite_id, user_id, entry_date').gte('entry_date', weekAgo),
      supabase.from('vapautumiset').select('id, user_id, user_name, worksite_id, pvm, varma, huom').gte('pvm', back60).order('pvm'),
      supabase.from('profiles').select('id, full_name, role').eq('approved', true),
      supabase.from('material_requests').select('id, item_text, maara, kiire, status, toimitus_pvm, worksite_id').in('status', ['avoin', 'hyvaksytty', 'tilattu', 'saapunut']),
      supabase.from('kalenterimerkinnat').select('id, pvm, otsikko, worksite_id, created_by_name').gte('pvm', back60).order('pvm'),
      supabase.from('miehitykset').select('*').neq('status', 'vastustettu').or(`loppu.is.null,loppu.gte.${back60}`),
      supabase.from('tehtavat').select('id, pvm, teksti, worksite_id, tehty, lahde, created_by_name').or(`tehty.eq.false,pvm.gte.${weekAgo}`).order('created_at'),
      supabase.from('materials').select('id, worksite_id, name, balance, unit, halytysraja'),
      supabase.from('mittapoytakirjat').select('id', { count: 'exact', head: true }).eq('eskaloitu', true).neq('status', 'lukittu'),
      supabase.from('tools').select('id, name, numero, status, worksite_id, holder_id').in('status', ['tyomaalla', 'asentajalla']),
      user ? supabase.from('profiles').select('ics_token').eq('id', user.id).single() : Promise.resolve({ data: null, error: null }),
    ])
    if (wsRes.error) setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    else {
      setSites((wsRes.data ?? []) as Ws[])
      setVisits(visRes.data ?? [])
      setEnts(entRes.data ?? [])
      setVapautumiset((vapRes.data ?? []) as Vapautus[])
      setProfs(profRes.data ?? [])
      setToimitukset((reqRes.data ?? []) as Toimitus[])
      setMerkinnat((merkRes.data ?? []) as Merkinta[])
      setMiehitykset((miehRes.data ?? []) as Miehitys[])
      setTehtavat((tehtRes.data ?? []) as Tehtava[])
      setMaterials(((matRes.data ?? []) as MaterialRow[]).map((m) => ({ ...m, balance: Number(m.balance), halytysraja: m.halytysraja === null ? null : Number(m.halytysraja) })))
      setEskaloituja(eskRes.count ?? 0)
      setTyokalut((toolRes.data ?? []) as { id: string; name: string; numero: number; status: string; worksite_id: string | null; holder_id: string | null }[])
      const tokenData = meRes.data as { ics_token: string | null } | null
      setIcsToken(tokenData?.ics_token ?? null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const nameOf = useMemo(() => new Map(profs.map((p) => [p.id, p.full_name])), [profs])
  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites])
  const asentajat = useMemo(() => profs.filter((p) => p.role === 'asentaja').sort((a, b) => a.full_name.localeCompare(b.full_name, 'fi')), [profs])
  const icsUrl = icsToken ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ics?token=${icsToken}` : null

  // ── Miehitystoiminnot ──

  function openKiinnitys(ws: Ws, week: WeekCol) {
    setKiinnitys({ ws, week })
    setKfUser(null)
    setKfAlkaa(week.monday < today() ? today() : week.monday)
    setKfLoppu('')
  }

  /** Missä asentaja on tuolla viikolla nykysuunnitelman mukaan? */
  function userWeekStatus(p: Prof, week: WeekCol): string | null {
    const act = miehitykset.filter((m) => m.user_id === p.id && m.status !== 'vastustettu')
    for (const m of act) {
      if (overlapsWeek(m, effectiveEnd(m, vapautumiset, sites.find((s) => s.id === m.worksite_id)), week)) {
        return siteName.get(m.worksite_id) ?? '?'
      }
    }
    return null
  }

  async function saveKiinnitys() {
    if (!profile || !kiinnitys || !kfUser || !kfAlkaa || kfSaving) return
    setKfSaving(true)
    const { error: insErr } = await supabase.from('miehitykset').insert({
      organization_id: profile.organization_id, worksite_id: kiinnitys.ws.id,
      user_id: kfUser.id, user_name: kfUser.full_name,
      alkaa: kfAlkaa, loppu: kfLoppu || null,
      proposer_id: profile.id, proposer_name: profile.full_name ?? '',
    })
    if (insErr) setToast('Tallennus epäonnistui')
    else { setToast(`Ehdotus tallennettu — varmistuu 24 h ellei kukaan vastusta`); setKiinnitys(null); fetchAll() }
    setKfSaving(false)
  }

  async function vahvistaHeti(m: Miehitys) {
    const { error: upErr } = await supabase.from('miehitykset').update({ status: 'varmistettu' }).eq('id', m.id)
    if (upErr) setToast('Ei onnistunut')
    else { setToast(`${m.user_name} varmistettu — näkyy nyt asentajalle`); setOpenM(null); fetchAll() }
  }

  async function vastusta(m: Miehitys) {
    if (!profile) return
    const { error: upErr } = await supabase.from('miehitykset').update({
      status: 'vastustettu', vastustaja_name: profile.full_name ?? '', vastustus_syy: vastustusSyy.trim() || null,
    }).eq('id', m.id)
    if (upErr) setToast('Ei onnistunut')
    else { setToast('Ehdotus pysäytetty — sopikaa jaosta'); setOpenM(null); setVastustusSyy(''); fetchAll() }
  }

  async function poistaMiehitys(m: Miehitys) {
    const { error: delErr } = await supabase.from('miehitykset').delete().eq('id', m.id)
    if (delErr) setToast('Poisto epäonnistui')
    else { setToast('Kiinnitys poistettu'); setOpenM(null); fetchAll() }
  }

  async function paivitaLoppu(m: Miehitys, loppu: string) {
    const { error: upErr } = await supabase.from('miehitykset').update({ loppu: loppu || null }).eq('id', m.id)
    if (upErr) setToast('Ei onnistunut')
    else { setToast('Loppupäivä päivitetty'); fetchAll() }
  }

  // ── Merkinnät ja tehtävät ──

  async function addMerkinta(pvm: string, otsikko: string) {
    if (!profile) return
    const { error: insErr } = await supabase.from('kalenterimerkinnat').insert({
      organization_id: profile.organization_id, pvm, otsikko,
      created_by: profile.id, created_by_name: profile.full_name ?? '',
    })
    if (insErr) setToast('Tallennus epäonnistui'); else fetchAll()
  }

  async function deleteMerkinta(id: string) {
    const { error: delErr } = await supabase.from('kalenterimerkinnat').delete().eq('id', id)
    if (delErr) setToast('Poisto epäonnistui')
    else setMerkinnat((prev) => prev.filter((x) => x.id !== id))
  }

  async function addTehtava(pvm: string | null, teksti: string, wsId: string | null) {
    if (!profile) return
    const { error: insErr } = await supabase.from('tehtavat').insert({
      organization_id: profile.organization_id, pvm, teksti, worksite_id: wsId,
      lahde: wsId ? 'halytys' : 'oma', created_by: profile.id, created_by_name: profile.full_name ?? '',
    })
    if (insErr) setToast('Tallennus epäonnistui')
    else { setToast('Tehtävä lisätty'); fetchAll() }
  }

  async function toggleTehtava(t: Tehtava) {
    const { error: upErr } = await supabase.from('tehtavat').update({ tehty: !t.tehty }).eq('id', t.id)
    if (upErr) setToast('Ei onnistunut')
    else setTehtavat((prev) => prev.map((x) => x.id === t.id ? { ...x, tehty: !t.tehty } : x))
  }

  async function deleteTehtava(id: string) {
    const { error: delErr } = await supabase.from('tehtavat').delete().eq('id', id)
    if (delErr) setToast('Poisto epäonnistui')
    else setTehtavat((prev) => prev.filter((x) => x.id !== id))
  }

  async function saveRaja(m: MaterialRow) {
    const raw = rajaEdit[m.id]
    if (raw === undefined) return
    const val = raw.trim() === '' ? null : parseNum(raw)
    if (val !== null && (!Number.isFinite(val) || val < 0)) { setToast('Tarkista raja'); return }
    const { error: upErr } = await supabase.from('materials').update({ halytysraja: val }).eq('id', m.id)
    if (upErr) setToast('Ei onnistunut')
    else {
      setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, halytysraja: val } : x))
      setToast(val === null ? 'Hälytys pois päältä' : `Hälytysraja ${String(val).replace('.', ',')} ${m.unit}`)
    }
  }

  // ── Työmaapaneelin johdetut tiedot ──
  const panelData = useMemo(() => {
    if (!panelWs) return null
    const w = panelWs
    const mats = materials.filter((m) => m.worksite_id === w.id)
    const crew = miehitykset.filter((m) => m.worksite_id === w.id && m.status === 'varmistettu')
    const vaps = vapautumiset.filter((v) => v.worksite_id === w.id && daysFromToday(v.pvm) >= 0)
    const reqs = toimitukset.filter((t) => t.worksite_id === w.id)
    const entDays = [...new Set(ents.filter((e) => e.worksite_id === w.id).map((e) => e.entry_date))].sort().reverse()
    // Kalusto: työmaalle viedyt + työmaan porukan mukana kulkevat (kuitattu asentajalle)
    const crewIds = new Set(crew.map((m) => m.user_id))
    const koneetTaalla = tyokalut.filter((t) => t.status === 'tyomaalla' && t.worksite_id === w.id)
    const koneetPorukalla = tyokalut.filter((t) => t.status === 'asentajalla' && t.holder_id && crewIds.has(t.holder_id))
    const hiljainen = crew.length > 0 && (entDays.length === 0 || daysFromToday(entDays[0]) <= -3)
    const late = w.arvioitu_valmis && daysFromToday(w.arvioitu_valmis) < 0 && w.valmius_pct < 100
    return { mats, crew, vaps, reqs, entDays, hiljainen, late, koneetTaalla, koneetPorukalla }
  }, [panelWs, materials, miehitykset, vapautumiset, toimitukset, ents, tyokalut])

  const tabBtn = (t: Tab, label: string, Icon: typeof Grid3x3) => (
    <button onClick={() => setTab(t)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${tab === t ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-amber-500" /> Kalenteri
        </h1>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md mx-auto space-y-3">
        <div className="flex gap-1.5">
          {tabBtn('resursointi', 'Resursointi', Grid3x3)}
          {tabBtn('viikko', 'Oma viikko', ListTodo)}
          {tabBtn('kuukausi', 'Kuukausi', CalendarDays)}
        </div>

        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && tab === 'resursointi' && (
          <ResursointiTab
            sites={sites} miehitykset={miehitykset} vapautumiset={vapautumiset}
            visits={visits} ents={ents} nameOf={nameOf} weeks={weeks} canEdit={canEdit}
            onOpenKiinnitys={openKiinnitys} onOpenMiehitys={(m) => { setOpenM(m); setVastustusSyy('') }}
            onOpenSite={(ws) => setPanelWs(ws)}
          />
        )}

        {!loading && !error && tab === 'viikko' && (
          <OmaViikkoTab
            sites={sites} vapautumiset={vapautumiset} toimitukset={toimitukset}
            merkinnat={merkinnat} tehtavat={tehtavat} materials={materials}
            eskaloituja={eskaloituja} myId={user?.id ?? null} siteName={siteName}
            onOpenSite={(ws) => setPanelWs(ws)}
            onAddTehtava={addTehtava} onToggleTehtava={toggleTehtava} onDeleteTehtava={deleteTehtava}
            onDeleteMerkinta={deleteMerkinta} onAddMerkinta={addMerkinta}
            onGoTyonjohto={() => navigate('/tyonjohto')}
          />
        )}

        {!loading && !error && tab === 'kuukausi' && (
          <KuukausiTab
            sites={sites} vapautumiset={vapautumiset} toimitukset={toimitukset}
            merkinnat={merkinnat} tehtavat={tehtavat} siteName={siteName}
            icsUrl={canEdit ? icsUrl : null} canEdit={canEdit}
            onAddMerkinta={addMerkinta} onDeleteMerkinta={deleteMerkinta}
          />
        )}
      </main>

      {/* ── Kiinnityssheet: asentaja työmaalle (ehdotuksena) ── */}
      {kiinnitys && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setKiinnitys(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">Kiinnitä asentaja · {kiinnitys.ws.name}</h3>
              <button onClick={() => setKiinnitys(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">
              Tallentuu ehdotuksena: kaikki työnjohtajat näkevät sen heti, ja se varmistuu itsestään 24 tunnissa ellei kukaan vastusta.
              Vasta varmistettu näkyy asentajalle.
            </p>

            <p className="text-xs font-semibold text-gray-500">Asentaja — suluissa missä on vko {kiinnitys.week.vko}</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-[30vh] overflow-y-auto">
              {asentajat.map((p) => {
                const status = userWeekStatus(p, kiinnitys.week)
                return (
                  <button key={p.id} onClick={() => setKfUser(p)}
                    className={`px-3 py-2.5 rounded-xl text-left ${kfUser?.id === p.id ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-200'}`}>
                    <span className="block text-sm font-semibold truncate">{p.full_name}</span>
                    <span className={`block text-[10px] truncate ${kfUser?.id === p.id ? 'text-gray-800' : status ? 'text-amber-400/80' : 'text-green-500'}`}>
                      {status ?? 'vapaana'}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Alkaa</p>
                <input type="date" value={kfAlkaa} onChange={(e) => setKfAlkaa(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Loppu (valinnainen)</p>
                <input type="date" value={kfLoppu} onChange={(e) => setKfLoppu(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
              </div>
            </div>
            <p className="text-[11px] text-gray-600">Ilman loppupäivää kesto elää asentajan vapautumisilmoituksen ja työmaan aikataulun mukaan — se on yleensä oikein.</p>

            <button onClick={saveKiinnitys} disabled={!kfUser || !kfAlkaa || kfSaving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {kfSaving ? 'Tallennetaan…' : kfUser ? `Ehdota: ${kfUser.full_name.split(' ')[0]} → ${kiinnitys.ws.name}` : 'Valitse asentaja'}
            </button>
          </div>
        </div>
      )}

      {/* ── Miehityksen käsittely ── */}
      {openM && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setOpenM(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">{openM.user_name} · {siteName.get(openM.worksite_id)}</h3>
              <button onClick={() => setOpenM(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">
              {formatDate(openM.alkaa)} → {(() => { const e = effectiveEnd(openM, vapautumiset, sites.find((s) => s.id === openM.worksite_id)); return e ? formatDate(e) : 'avoin' })()}
              {openM.status === 'ehdotus' && ` · ehdotti ${openM.proposer_name ?? '?'}`}
              {openM.status === 'varmistettu' && ' · varmistettu'}
            </p>

            {openM.status === 'ehdotus' && (
              <>
                <button onClick={() => vahvistaHeti(openM)}
                  className="w-full py-3 bg-green-600/20 text-green-300 border border-green-800 font-semibold rounded-xl">
                  Vahvista heti
                </button>
                <input type="text" value={vastustusSyy} onChange={(e) => setVastustusSyy(e.target.value)}
                  placeholder="Vastustuksen syy (esim. tarvitsen hänet Koskelaan)" className={inputCls} />
                <button onClick={() => vastusta(openM)}
                  className="w-full py-3 bg-red-600/15 text-red-300 border border-red-900 font-semibold rounded-xl">
                  Vastusta — pysäytä ehdotus
                </button>
              </>
            )}

            {openM.status === 'varmistettu' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Loppupäivä (tyhjä = elää vapautumisen/aikataulun mukaan)</p>
                <input type="date" defaultValue={openM.loppu ?? ''} onChange={(e) => paivitaLoppu(openM, e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
              </div>
            )}

            <button onClick={() => poistaMiehitys(openM)}
              className="w-full py-3 bg-gray-800 text-gray-400 font-semibold rounded-xl flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Poista kiinnitys
            </button>
          </div>
        </div>
      )}

      {/* ── Työmaapaneeli: se mitä työnjohtaja tarvitsee yhdellä avauksella ── */}
      {panelWs && panelData && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setPanelWs(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">{panelWs.name}</h3>
              <button onClick={() => setPanelWs(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            {/* 1. Liikennevalo */}
            <div className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${panelData.late ? 'bg-red-500/15 text-red-300' : 'bg-green-500/10 text-green-300'}`}>
              {panelData.late
                ? <><AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" /> Myöhässä — valmius {panelWs.valmius_pct} %, piti valmistua {formatDate(panelWs.arvioitu_valmis!)}</>
                : <>Valmius {panelWs.valmius_pct} %{panelWs.arvioitu_valmis ? ` · valmis ${formatDate(panelWs.arvioitu_valmis)} (${daysFromToday(panelWs.arvioitu_valmis)} pv)` : ' · ei aikataulua'}</>}
              {panelData.hiljainen && (
                <span className="block text-amber-300 font-normal text-xs mt-1">
                  <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" /> Hiljainen työmaa: miehitys on, mutta kirjauksia ei ole tullut 3 päivään
                </span>
              )}
            </div>

            {/* 2. Materiaalisaldot + hälytysrajat */}
            {panelData.mats.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><PackageOpen className="w-3.5 h-3.5" /> Materiaalisaldot</p>
                {panelData.mats.map((m) => {
                  const red = m.halytysraja != null && m.balance <= m.halytysraja
                  return (
                    <div key={m.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${red ? 'bg-red-500/10 border border-red-900' : 'bg-gray-800/60'}`}>
                      <span className="min-w-0 text-sm truncate">
                        {m.name} · <b className={red ? 'text-red-300' : ''}>{String(Math.round(m.balance * 10) / 10).replace('.', ',')} {m.unit}</b>
                      </span>
                      {canEdit && (
                        <span className="flex items-center gap-1 shrink-0">
                          <input type="text" inputMode="decimal" placeholder="raja"
                            defaultValue={m.halytysraja == null ? '' : String(m.halytysraja).replace('.', ',')}
                            onChange={(e) => setRajaEdit((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            onBlur={() => saveRaja(m)}
                            className="w-16 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-right" />
                          <span className="text-[10px] text-gray-600">{m.unit}</span>
                        </span>
                      )}
                    </div>
                  )
                })}
                <p className="text-[10px] text-gray-600">Raja tyhjäksi = ei hälytystä (esim. koko erä tilattu kerralla).</p>
              </div>
            )}

            {/* 3. Miehitys ja vapautumiset */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Miehitys</p>
              {panelData.crew.length === 0 && <p className="text-sm text-gray-500">Ei varmistettua miehitystä.</p>}
              {panelData.crew.map((m) => {
                const vap = panelData.vaps.find((v) => v.user_id === m.user_id)
                return (
                  <p key={m.id} className="text-sm flex justify-between gap-2">
                    <span>{m.user_name}</span>
                    <span className="text-gray-500">{vap ? `vapautuu ${formatDate(vap.pvm)}${vap.varma ? '' : '?'}` : 'ei vapautumisarviota'}</span>
                  </p>
                )
              })}
            </div>

            {/* 4. Tarpeet ja toimituslupaukset */}
            {panelData.reqs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarpeet ja toimitukset</p>
                {panelData.reqs.map((t) => (
                  <p key={t.id} className="text-sm flex justify-between gap-2">
                    <span className="min-w-0 truncate">{t.kiire ? '❗ ' : ''}{t.item_text}{t.maara ? ` (${t.maara})` : ''}</span>
                    <span className={`shrink-0 text-xs ${t.toimitus_pvm && daysFromToday(t.toimitus_pvm) < 0 ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                      {t.toimitus_pvm ? formatDate(t.toimitus_pvm) : t.status}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {/* Kalusto: mitä koneita työmaalla on ja mitä porukka kantaa mukanaan */}
            {(panelData.koneetTaalla.length > 0 || panelData.koneetPorukalla.length > 0) && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Kalusto</p>
                {panelData.koneetTaalla.map((t) => (
                  <p key={t.id} className="text-sm flex justify-between gap-2">
                    <span>{t.name} <span className="text-gray-600">#{t.numero}</span></span>
                    <span className="text-xs text-gray-500">työmaalla</span>
                  </p>
                ))}
                {panelData.koneetPorukalla.map((t) => (
                  <p key={t.id} className="text-sm flex justify-between gap-2">
                    <span>{t.name} <span className="text-gray-600">#{t.numero}</span></span>
                    <span className="text-xs text-amber-400/80">{nameOf.get(t.holder_id!) ?? 'asentajalla'}</span>
                  </p>
                ))}
                <button onClick={() => navigate('/tyokalut')} className="text-xs text-gray-500 underline underline-offset-2">Kaikki työkalut →</button>
              </div>
            )}

            {/* 5. Tuoreet kirjaukset + pikayhteydet */}
            <p className="text-xs text-gray-500">
              Kirjauspäiviä viim. 7 pv: <b className="text-gray-300">{panelData.entDays.length}</b>
              {panelData.entDays[0] ? ` · viimeisin ${formatDate(panelData.entDays[0])}` : ''}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {panelWs.mestari_puhelin && (
                <a href={`tel:${panelWs.mestari_puhelin}`} className="flex items-center justify-center gap-1.5 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold">
                  <Phone className="w-4 h-4 text-amber-400" /> {panelWs.mestari_nimi ?? 'Mestari'}
                </a>
              )}
              <button onClick={() => navigate(`/tyomaa/${panelWs.id}`)} className="flex items-center justify-center gap-1.5 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold">
                <ExternalLink className="w-4 h-4 text-amber-400" /> Avaa työmaa
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}
