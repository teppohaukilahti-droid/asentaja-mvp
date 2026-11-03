import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, RefreshCw, Package, Building2, ChevronRight, Check, X, Truck, Warehouse,
  UserCheck, Copy as CopyIcon, Share2, AlertTriangle, ClipboardList, MapPin, Star, Archive, Plus, LocateFixed, Camera, CalendarDays, Banknote, Bell,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, FORWARD_LABEL, timeAgo, buildOrderMessage } from '../lib/requests'
import { toInput } from '../lib/helpers'
import type { MaterialRequest } from '../lib/requests'
import { getPosition, parseCoords } from '../lib/geo'

type WorksiteRow = {
  id: string; name: string; address: string | null; client_company: string | null
  status: string; oma_tyomaa: boolean; erityismaininnat: string | null
  creator: { full_name: string } | null
}
type Palaute = {
  id: string; numero: number | null; mestari_nimi: string | null
  tahdet: number; viesti: string | null; created_at: string
  worksites: { name: string } | null
}
type Pickup = {
  id: string; product_name: string; maara: number; unit: string
  user_name: string | null; created_at: string; worksite_id: string
  worksites: { name: string } | null
}
type Eskaloitu = {
  id: string; numero: number | null; tyokohde: string | null; tyontekijat: string | null
  eskaloija: string | null; eskaloitu_at: string | null; approval_token: string | null
  worksites: { name: string } | null
}

export default function TyonjohtajaHome() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'tarpeet' | 'tyomaat' | 'haut' | 'palaute'>('tarpeet')
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [eskaloidut, setEskaloidut] = useState<Eskaloitu[]>([])
  // Uusi työmaa -lomake (esitiedot: mestari, perehdytys, sijainti, pohjakuva, erityiset)
  const [newWsOpen, setNewWsOpen] = useState(false)
  const [savingWs, setSavingWs] = useState(false)
  const [wsF, setWsF] = useState({
    name: '', address: '', client: '', mestariNimi: '', mestariPuh: '',
    perehdytys: '', erityiset: '', sijainti: '', alkaa: '', valmis: '',
  })
  const [wsCoords, setWsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [wsPohjakuva, setWsPohjakuva] = useState<File | null>(null)
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [worksites, setWorksites] = useState<WorksiteRow[]>([])
  const [palautteet, setPalautteet] = useState<Palaute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [orderMsgFor, setOrderMsgFor] = useState<MaterialRequest | null>(null)
  const [orderMsg, setOrderMsg] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const [reqRes, siteRes, palauteRes, pickupRes, eskRes] = await Promise.all([
      supabase.from('material_requests')
        .select('*, worksites(name, address, client_company), requester:profiles!material_requests_requested_by_fkey(full_name)')
        .order('kiire', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('worksites')
        .select('id, name, address, client_company, status, oma_tyomaa, erityismaininnat, creator:profiles!worksites_created_by_fkey(full_name)')
        .in('status', ['active', 'pyynto']).order('name'),
      supabase.from('mestari_palaute')
        .select('id, numero, mestari_nimi, tahdet, viesti, created_at, worksites(name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('material_pickups')
        .select('id, product_name, maara, unit, user_name, created_at, worksite_id, worksites(name)')
        .eq('status', 'kirjattu').eq('suunta', 'otto')
        .order('created_at', { ascending: true }),
      supabase.from('mittapoytakirjat')
        .select('id, numero, tyokohde, tyontekijat, eskaloija, eskaloitu_at, approval_token, worksites(name)')
        .eq('eskaloitu', true).neq('status', 'lukittu')
        .order('eskaloitu_at', { ascending: true }),
    ])
    if (reqRes.error || siteRes.error) {
      setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setRequests((reqRes.data ?? []) as unknown as MaterialRequest[])
      setWorksites((siteRes.data ?? []) as unknown as WorksiteRow[])
      setPalautteet((palauteRes.data ?? []) as unknown as Palaute[])
      setPickups((pickupRes.data ?? []) as unknown as Pickup[])
      setEskaloidut((eskRes.data ?? []) as unknown as Eskaloitu[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const iv = setInterval(fetchAll, 15000)
    return () => clearInterval(iv)
  }, [fetchAll])

  async function updateRequest(r: MaterialRequest, patch: Partial<MaterialRequest>, msg: string) {
    const { error } = await supabase.from('material_requests').update(patch as never).eq('id', r.id)
    if (error) setToast('Päivitys epäonnistui')
    else { setToast(msg); fetchAll() }
  }

  function approve(r: MaterialRequest, route: 'tyonjohtaja' | 'varasto' | 'toimittaja') {
    const patch = {
      status: 'hyvaksytty', forwarded_to: route, handled_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }
    if (route === 'toimittaja') {
      setOrderMsg(buildOrderMessage(r, profile?.full_name ?? ''))
      setOrderMsgFor(r)
    }
    updateRequest(r, patch as never, route === 'tyonjohtaja' ? 'Otit tarpeen hoitaaksesi' : route === 'varasto' ? 'Ohjattu varastolle' : 'Tilausviesti valmis')
  }

  const open = useMemo(() => requests.filter((r) => r.status === 'avoin'), [requests])
  const sitePyynnot = useMemo(() => worksites.filter((w) => w.status === 'pyynto'), [worksites])
  const activeSites = useMemo(() => worksites.filter((w) => w.status === 'active'), [worksites])
  const inProgress = useMemo(() => requests.filter((r) => r.status === 'hyvaksytty' || r.status === 'tilattu' || r.status === 'saapunut'), [requests])
  const doneCount = useMemo(() => requests.filter((r) => r.status === 'toimitettu').length, [requests])

  const btn = 'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors'

  function RequestCard({ r }: { r: MaterialRequest }) {
    return (
      <div className={`bg-gray-900 border rounded-2xl p-4 ${r.kiire && r.status === 'avoin' ? 'border-red-800' : 'border-gray-800'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm">{r.item_text}{r.maara ? ` · ${r.maara}` : ''}</p>
            <p className="text-xs text-gray-500 mt-1">
              {r.worksites?.name} · {r.requester?.full_name} · {timeAgo(r.created_at)}
            </p>
            {r.lisatiedot && <p className="text-xs text-gray-400 mt-1">{r.lisatiedot}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {r.kiire && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> KIIRE
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
              {STATUS_LABEL[r.status]}{r.forwarded_to && r.status !== 'avoin' ? ` · ${FORWARD_LABEL[r.forwarded_to]}` : ''}
            </span>
          </div>
        </div>

        {r.status === 'avoin' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => approve(r, 'tyonjohtaja')} className={`${btn} bg-gray-800 text-gray-200 hover:bg-gray-700`}>
              <UserCheck className="w-4 h-4" /> Hoidan itse
            </button>
            <button onClick={() => approve(r, 'varasto')} className={`${btn} bg-gray-800 text-gray-200 hover:bg-gray-700`}>
              <Warehouse className="w-4 h-4" /> Varastoon
            </button>
            <button onClick={() => approve(r, 'toimittaja')} className={`${btn} bg-amber-500 text-gray-950 hover:bg-amber-400`}>
              <Truck className="w-4 h-4" /> Tilaa toimittajalta
            </button>
            <button onClick={() => updateRequest(r, { status: 'hylatty' } as never, 'Tarve hylätty')} className={`${btn} bg-gray-800/60 text-gray-500 hover:text-red-400`}>
              <X className="w-4 h-4" /> Hylkää
            </button>
          </div>
        )}
        {(r.status === 'hyvaksytty' || r.status === 'tilattu' || r.status === 'saapunut') && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Toimitus:</span>
            {[0, 1, 2].map((d) => {
              const pvm = toInput(new Date(Date.now() + d * 86400000))
              return (
                <button key={d} onClick={() => updateRequest(r, { toimitus_pvm: r.toimitus_pvm === pvm ? null : pvm } as never, r.toimitus_pvm === pvm ? 'Toimituspäivä poistettu' : 'Toimituspäivä kalenterissa')}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold ${r.toimitus_pvm === pvm ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {d === 0 ? 'Tänään' : d === 1 ? 'Huomenna' : 'Ylihuom.'}
                </button>
              )
            })}
            <input type="date" value={r.toimitus_pvm ?? ''} onChange={(e) => updateRequest(r, { toimitus_pvm: e.target.value || null } as never, 'Toimituspäivä kalenterissa')}
              className="px-2 py-1 text-[11px] bg-gray-800 border border-gray-700 rounded-lg [color-scheme:dark] w-[7.5rem]" />
          </div>
        )}
        {r.status === 'hyvaksytty' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {r.forwarded_to === 'toimittaja' && (
              <button onClick={() => { setOrderMsg(buildOrderMessage(r, profile?.full_name ?? '')); setOrderMsgFor(r) }} className={`${btn} bg-gray-800 text-gray-200`}>
                <ClipboardList className="w-4 h-4" /> Tilausviesti
              </button>
            )}
            <button onClick={() => updateRequest(r, { status: 'tilattu', ordered_at: new Date().toISOString() } as never, 'Merkitty tilatuksi')} className={`${btn} bg-purple-500/20 text-purple-300 hover:bg-purple-500/30`}>
              <Check className="w-4 h-4" /> Merkitse tilatuksi
            </button>
          </div>
        )}
        {(r.status === 'tilattu' || r.status === 'saapunut') && (
          <button onClick={() => updateRequest(r, { status: 'toimitettu', delivered_at: new Date().toISOString() } as never, 'Merkitty toimitetuksi')} className={`${btn} bg-green-500/20 text-green-300 hover:bg-green-500/30 w-full mt-3`}>
            <Check className="w-4 h-4" /> Merkitse toimitetuksi
          </button>
        )}
      </div>
    )
  }

  async function createWorksite() {
    if (!profile || !wsF.name.trim() || savingWs) return
    setSavingWs(true)
    const { data: ws, error: insErr } = await supabase.from('worksites').insert({
      organization_id: profile.organization_id,
      name: wsF.name.trim(), address: wsF.address.trim() || null,
      client_company: wsF.client.trim() || null, status: 'active',
      mestari_nimi: wsF.mestariNimi.trim() || null, mestari_puhelin: wsF.mestariPuh.trim() || null,
      perehdytys_url: wsF.perehdytys.trim() || null, erityismaininnat: wsF.erityiset.trim() || null,
      lat: wsCoords?.lat ?? null, lng: wsCoords?.lng ?? null,
      alkaa: wsF.alkaa || null, arvioitu_valmis: wsF.valmis || null,
      created_by: user?.id, foreman_id: user?.id,
    }).select('id').single()
    if (insErr || !ws) { setToast('Työmaan luonti epäonnistui'); setSavingWs(false); return }
    if (wsPohjakuva) {
      const clean = wsPohjakuva.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${profile.organization_id}/${ws.id}/pohjakuva_${Date.now()}_${clean}`
      const { error: upErr } = await supabase.storage.from('arkisto').upload(path, wsPohjakuva)
      if (!upErr) {
        await supabase.from('worksites').update({ pohjakuva_path: path }).eq('id', ws.id)
        await supabase.from('archive_items').insert({
          organization_id: profile.organization_id, worksite_id: ws.id, tyyppi: 'dokumentti',
          otsikko: 'Pohjakuva', tags: ['pohjakuva'], file_path: path, file_type: wsPohjakuva.type,
          user_id: user?.id, user_name: profile.full_name ?? '',
        })
      }
    }
    setToast(`${wsF.name.trim()} luotu — esitiedot näkyvät asentajille heti`)
    setNewWsOpen(false)
    setWsF({ name: '', address: '', client: '', mestariNimi: '', mestariPuh: '', perehdytys: '', erityiset: '', sijainti: '', alkaa: '', valmis: '' })
    setWsCoords(null); setWsPohjakuva(null)
    fetchAll()
    setSavingWs(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">FloorData</h1>
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider -mt-0.5">Työnjohto</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ilmoitukset')} aria-label="Ilmoitukset" className="p-3 text-gray-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/palkkakatko')} aria-label="Palkkakatko-apuri" className="p-3 text-gray-400 hover:text-white transition-colors">
            <Banknote className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/kalenteri')} aria-label="Työmaakalenteri" className="p-3 text-amber-400 hover:text-amber-300 transition-colors">
            <CalendarDays className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/kayttajat')} aria-label="Käyttäjät" className="p-3 text-gray-400 hover:text-white transition-colors">
            <UserCheck className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/arkisto')} aria-label="Arkisto" className="p-3 text-gray-400 hover:text-white transition-colors">
            <Archive className="w-5 h-5" />
          </button>
          <button onClick={signOut} aria-label="Kirjaudu ulos" title="Kirjaudu ulos" className="p-3 -m-1 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex border-b border-gray-800">
        <button onClick={() => setTab('tarpeet')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'tarpeet' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Package className="w-4 h-4" /> Tarpeet
          {(open.length + eskaloidut.length) > 0 && <span className="bg-amber-500 text-gray-950 text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px]">{open.length + eskaloidut.length}</span>}
        </button>
        <button onClick={() => setTab('tyomaat')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'tyomaat' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Building2 className="w-4 h-4" /> Työmaat
          {sitePyynnot.length > 0 && <span className="bg-amber-500 text-gray-950 text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px]">{sitePyynnot.length}</span>}
        </button>
        <button onClick={() => setTab('haut')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'haut' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Package className="w-4 h-4" /> Haut
          {pickups.length > 0 && <span className="bg-amber-500 text-gray-950 text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px]">{pickups.length}</span>}
        </button>
        <button onClick={() => setTab('palaute')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'palaute' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Star className="w-4 h-4" /> Palaute
        </button>
      </div>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-4">
        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && tab === 'tarpeet' && (
          <>
            {/* Eskaloidut pöytäkirjat: mestari ei ollut paikalla — lasku ei saa jäädä lähtemättä */}
            {eskaloidut.map((e) => (
              <div key={e.id} className="bg-gray-900 border border-amber-500/40 rounded-2xl p-4 space-y-2 mb-3">
                <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Kuittaamaton pöytäkirja — mestari ei ollut paikalla</p>
                <p className="font-semibold text-sm">
                  Pöytäkirja #{e.numero}{e.tyokohde ? ` — ${e.tyokohde}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {[e.worksites?.name, e.tyontekijat, e.eskaloija ? `siirsi: ${e.eskaloija}` : null, e.eskaloitu_at ? timeAgo(e.eskaloitu_at) : null].filter(Boolean).join(' · ')}
                </p>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    // Uusi voimassaolo viikoksi ja linkki leikepöydälle → sähköpostiin/viestiin mestarille
                    await supabase.from('mittapoytakirjat').update({
                      token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    }).eq('id', e.id)
                    const link = `${window.location.origin}/hyvaksy?token=${e.approval_token}`
                    navigator.clipboard?.writeText(link)
                    setToast('Hyväksyntälinkki kopioitu — lähetä se mestarille viestillä tai sähköpostilla')
                  }} className="flex-1 py-2.5 bg-amber-500 text-gray-950 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                    <CopyIcon className="w-4 h-4" /> Kopioi hyväksyntälinkki
                  </button>
                  <button onClick={async () => {
                    const { error: upErr } = await supabase.from('mittapoytakirjat').update({ eskaloitu: false }).eq('id', e.id)
                    if (upErr) setToast('Merkintä epäonnistui')
                    else { setToast('Merkitty hoidetuksi'); fetchAll() }
                  }} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold text-gray-400">
                    Hoidettu
                  </button>
                </div>
              </div>
            ))}

            {open.length === 0 && inProgress.length === 0 && eskaloidut.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Ei avoimia tarpeita. Uudet materiaalipyynnöt ilmestyvät tähän automaattisesti.</p>
            )}
            {open.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Odottaa päätöstä ({open.length})</p>
                {open.map((r) => <RequestCard key={r.id} r={r} />)}
              </section>
            )}
            {inProgress.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Käsittelyssä ({inProgress.length})</p>
                {inProgress.map((r) => <RequestCard key={r.id} r={r} />)}
              </section>
            )}
            {doneCount > 0 && <p className="text-xs text-gray-600 text-center">{doneCount} toimitettua tarvetta</p>}
          </>
        )}

        {!loading && !error && tab === 'haut' && (
          <div className="space-y-4">
            {pickups.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">
                Ei laskuttamattomia varastohakuja. Asentajien hyllynreuna-QR:llä tai pikanapeilla kirjaamat haut ilmestyvät tähän työmaittain.
              </p>
            )}
            {[...new Map(pickups.map((p) => [p.worksite_id, p.worksites?.name ?? 'Työmaa'])).entries()].map(([wsId, wsName]) => {
              const group = pickups.filter((p) => p.worksite_id === wsId)
              return (
                <section key={wsId} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                  <p className="font-semibold text-sm flex items-center justify-between">
                    <span className="truncate">{wsName}</span>
                    <span className="text-xs text-gray-500 shrink-0">{group.length} hakua</span>
                  </p>
                  {group.map((p) => (
                    <p key={p.id} className="text-sm text-gray-300 flex justify-between gap-3">
                      <span className="truncate">{p.product_name} {String(p.maara).replace('.', ',')} {p.unit}</span>
                      <span className="text-xs text-gray-500 shrink-0">{p.user_name ?? ''} · {timeAgo(p.created_at)}</span>
                    </p>
                  ))}
                  <button
                    onClick={async () => {
                      const { error: upErr } = await supabase.from('material_pickups')
                        .update({ status: 'laskutettu' }).in('id', group.map((p) => p.id))
                      if (upErr) setToast('Merkintä epäonnistui')
                      else { setToast(`${wsName}: ${group.length} hakua merkitty laskutetuksi`); fetchAll() }
                    }}
                    className="w-full py-2.5 mt-1 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold text-green-400 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Merkitse laskutetuksi
                  </button>
                </section>
              )
            })}
            <p className="text-[11px] text-gray-600 text-center">Laskutetuksi merkityt poistuvat pinosta mutta säilyvät kirjausjäljessä.</p>
          </div>
        )}

        {!loading && !error && tab === 'palaute' && (
          <div className="space-y-3">
            {palautteet.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">
                Ei vielä palautteita. Mestarit voivat jättää tähdet ja viestin QR-hyväksynnän jälkeen — palaute näkyy vain työnjohdolle.
              </p>
            )}
            {palautteet.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                <p className="text-sm text-gray-400">Keskiarvo ({palautteet.length} kpl)</p>
                <p className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                  {(palautteet.reduce((s, p) => s + p.tahdet, 0) / palautteet.length).toFixed(1).replace('.', ',')}
                </p>
              </div>
            )}
            {palautteet.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold truncate">{p.worksites?.name ?? 'Työmaa'}{p.numero ? ` · pöytäkirja ${p.numero}` : ''}</p>
                  <span className="flex gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= p.tahdet ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`} />
                    ))}
                  </span>
                </div>
                {p.viesti && <p className="text-sm text-gray-300">"{p.viesti}"</p>}
                <p className="text-xs text-gray-500">{p.mestari_nimi ?? 'Mestari'} · {timeAgo(p.created_at)}</p>
              </div>
            ))}
            <p className="text-[11px] text-gray-600 text-center">Palaute näkyy vain työnjohdolle ja johdolle — ei asentajille.</p>
          </div>
        )}

        {!loading && !error && tab === 'tyomaat' && (
          <div className="space-y-3">
            <button onClick={() => setNewWsOpen(true)}
              className="w-full py-3 bg-amber-500 text-gray-950 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Uusi työmaa esitietoineen
            </button>

            {sitePyynnot.map((w) => (
              <div key={w.id} className="bg-gray-900 border border-amber-500/40 rounded-2xl p-4 space-y-2">
                <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Työmaapyyntö asentajalta</p>
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs text-gray-500">
                  {[w.address, w.creator?.full_name ? `pyytäjä: ${w.creator.full_name}` : null].filter(Boolean).join(' · ')}
                </p>
                {w.erityismaininnat && <p className="text-xs text-gray-400">{w.erityismaininnat}</p>}
                <div className="flex gap-2">
                  <button onClick={async () => {
                    const { error: e1 } = await supabase.from('worksites').update({ status: 'active', foreman_id: user?.id }).eq('id', w.id)
                    if (e1) setToast('Hyväksyntä epäonnistui')
                    else { setToast(`${w.name} hyväksytty — täydennä esitiedot työmaasivulta`); fetchAll() }
                  }} className="flex-1 py-2.5 bg-green-600 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Hyväksy työmaaksi
                  </button>
                  <button onClick={async () => {
                    const { error: e2 } = await supabase.from('worksites').delete().eq('id', w.id)
                    if (e2) setToast('Hylkäys epäonnistui')
                    else { setToast('Pyyntö hylätty'); fetchAll() }
                  }} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {activeSites.map((site) => (
              <button key={site.id} onClick={() => navigate(`/tyomaa/${site.id}`)}
                className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-base truncate">{site.name}</p>
                    {site.address && (
                      <p className="flex items-center gap-1.5 text-sm text-gray-400 mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{site.address}</span>
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Tilausviesti-sheet */}
      {orderMsgFor && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setOrderMsgFor(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-amber-400" /> Tilausviesti toimittajalle</h3>
              <button onClick={() => setOrderMsgFor(null)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <textarea value={orderMsg} onChange={(e) => setOrderMsg(e.target.value)} rows={12}
              className="w-full px-3.5 py-3 text-sm bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(orderMsg); setToast('Viesti kopioitu') }} className="flex items-center justify-center gap-2 py-3 bg-gray-800 rounded-xl text-sm font-semibold">
                <CopyIcon className="w-4 h-4" /> Kopioi
              </button>
              <button onClick={() => { if (navigator.share) navigator.share({ text: orderMsg }); else { navigator.clipboard?.writeText(orderMsg); setToast('Viesti kopioitu') } }} className="flex items-center justify-center gap-2 py-3 bg-amber-500 text-gray-950 rounded-xl text-sm font-semibold">
                <Share2 className="w-4 h-4" /> Jaa (sähköposti/viesti)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uusi työmaa esitietoineen */}
      {newWsOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setNewWsOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Uusi työmaa</h3>
              <button onClick={() => setNewWsOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <input type="text" value={wsF.name} onChange={(e) => setWsF({ ...wsF, name: e.target.value })}
              placeholder="Työmaan nimi *" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <input type="text" value={wsF.address} onChange={(e) => setWsF({ ...wsF, address: e.target.value })}
              placeholder="Osoite (navigointia varten)" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <input type="text" value={wsF.client} onChange={(e) => setWsF({ ...wsF, client: e.target.value })}
              placeholder="Tilaaja (rakennusliike)" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />

            <p className="text-xs font-semibold text-gray-500 pt-1">Esitiedot asentajille</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={wsF.mestariNimi} onChange={(e) => setWsF({ ...wsF, mestariNimi: e.target.value })}
                placeholder="Mestarin nimi" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <input type="tel" value={wsF.mestariPuh} onChange={(e) => setWsF({ ...wsF, mestariPuh: e.target.value })}
                placeholder="Mestarin puhelin" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <input type="url" value={wsF.perehdytys} onChange={(e) => setWsF({ ...wsF, perehdytys: e.target.value })}
              placeholder="Perehdytyslinkki (https://…)" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <textarea value={wsF.erityiset} onChange={(e) => setWsF({ ...wsF, erityiset: e.target.value })} rows={2}
              placeholder="Erityismaininnat (esim. kulku takakautta, kypäräpakko, P-paikka…)" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />

            <p className="text-xs font-semibold text-gray-500 pt-1">Aikataulu (näkyy työmaakalenterissa)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-gray-600 mb-1">Alkaa</p>
                <input type="date" value={wsF.alkaa} onChange={(e) => setWsF({ ...wsF, alkaa: e.target.value })}
                  className="w-full px-3.5 py-3 text-sm bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-600 mb-1">Arvioitu valmis</p>
                <input type="date" value={wsF.valmis} onChange={(e) => setWsF({ ...wsF, valmis: e.target.value })}
                  className="w-full px-3.5 py-3 text-sm bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-500 pt-1">GPS-sijainti (työmaan tunnistusta varten)</p>
            <div className="flex gap-2">
              <input type="text" value={wsF.sijainti}
                onChange={(e) => { setWsF({ ...wsF, sijainti: e.target.value }); const c = parseCoords(e.target.value); if (c) setWsCoords(c) }}
                placeholder="Liitä Google Maps -linkki tai 65.012, 25.465"
                className="flex-1 px-3.5 py-3 text-sm bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={async () => { const p = await getPosition(); if (p) { setWsCoords(p); setToast('Sijainti tallennettu tästä paikasta') } }}
                aria-label="Käytä nykyistä sijaintia" className="px-3.5 bg-gray-800 border border-gray-700 rounded-xl text-amber-400">
                <LocateFixed className="w-5 h-5" />
              </button>
            </div>
            {wsCoords && <p className="text-xs text-green-400">✓ Koordinaatit: {wsCoords.lat.toFixed(4)}, {wsCoords.lng.toFixed(4)}</p>}

            <label className="flex items-center gap-3 bg-gray-800 border border-gray-700 border-dashed rounded-xl px-4 py-3.5 cursor-pointer">
              <Camera className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-sm text-gray-300 truncate">{wsPohjakuva ? wsPohjakuva.name : 'Pohjakuva (kuva tai PDF, vapaaehtoinen)'}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setWsPohjakuva(e.target.files?.[0] ?? null)} />
            </label>

            <button onClick={createWorksite} disabled={!wsF.name.trim() || savingWs}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {savingWs ? 'Luodaan…' : 'Luo työmaa'}
            </button>
            <p className="text-[11px] text-gray-600">Kun sijainti on annettu, asentajan äppi tunnistaa työmaan automaattisesti paikan päällä ja näyttää mestarin numeron, perehdytyksen ja pohjakuvan ilman valikoita.</p>
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
