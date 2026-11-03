// Varaston etusivu: koodihaku ("onko meillä jl60 412"), liikennevalosaldot,
// saapuva tavara (Hyllyyn / Läpikulku työmaalle), tilauslista toimittajittain,
// noutopyynnöt työmailta, vikailmoitukset ja kalustonäkymä.
// Periaate: EI tarkkoja määriä — liikennevalo jonka varastomies päivittää napautuksella.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, RefreshCw, Warehouse, Check, AlertTriangle, Wrench, Archive,
  Search, X, Plus, Printer, PackageOpen, Truck, Undo2, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, timeAgo } from '../lib/requests'
import type { MaterialRequest } from '../lib/requests'
import {
  SALDO_LABEL, SALDO_STYLE, SALDO_BUTTON, matchesProduct, groupForOrdering,
} from '../lib/varasto'
import type { VarastoProduct, Noutopyynto, SaldoTila } from '../lib/varasto'
import { toolLabel, toolLocation, toolTimeAgo, TOOL_STATUS_LABEL, TOOL_STATUS_STYLE } from '../lib/tools'
import type { Tool } from '../lib/tools'

const PRODUCT_COLS = 'id, name, unit, qr_token, active, koodi, hyllypaikka, toimittaja, saldo_tila, saldo_paivitetty, tilattu_at, tarra_tulostettu'

export default function VarastoHome() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [products, setProducts] = useState<VarastoProduct[]>([])
  const [noudot, setNoudot] = useState<Noutopyynto[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<VarastoProduct | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [edName, setEdName] = useState('')
  const [edKoodi, setEdKoodi] = useState('')
  const [edHylly, setEdHylly] = useState('')
  const [edToimittaja, setEdToimittaja] = useState('')
  const [busy, setBusy] = useState(false)

  // Liukuhihnalisäys: sheet pysyy auki, kentät tyhjenevät → seuraava tuote heti perään
  const [newOpen, setNewOpen] = useState(false)
  const [nKoodi, setNKoodi] = useState('')
  const [nName, setNName] = useState('')
  const [nHylly, setNHylly] = useState('')
  const [nToimittaja, setNToimittaja] = useState('')
  const [nUnit, setNUnit] = useState('kpl')
  const [nTila, setNTila] = useState<Exclude<SaldoTila, 'tilattu'>>('vihrea')
  const [nAdded, setNAdded] = useState(0)
  const nKoodiRef = useRef<HTMLInputElement>(null)
  const [printing, setPrinting] = useState(false)
  const [kalustoAuki, setKalustoAuki] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const [reqRes, prodRes, noutoRes, toolRes] = await Promise.all([
      supabase.from('material_requests')
        .select('*, worksites(name, address, client_company), requester:profiles!material_requests_requested_by_fkey(full_name)')
        .in('status', ['hyvaksytty', 'tilattu', 'saapunut', 'toimitettu'])
        .order('kiire', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('products').select(PRODUCT_COLS).order('name'),
      supabase.from('noutopyynnot')
        .select('id, worksite_id, requested_by, requester_name, item_text, maara, lisatiedot, status, noudettu_at, created_at, worksites(name, address)')
        .eq('status', 'avoin').order('created_at', { ascending: true }),
      supabase.from('tools')
        .select('id, name, numero, status, worksite_id, holder_id, qr_token, huom, vika_kuvaus, vika_ilmoitettu, vika_ilmoittaja, updated_at, worksites(name), holder:profiles!tools_holder_id_fkey(full_name)')
        .order('name').order('numero'),
    ])
    if (reqRes.error || prodRes.error || noutoRes.error || toolRes.error) {
      setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setRequests((reqRes.data ?? []) as unknown as MaterialRequest[])
      setProducts((prodRes.data ?? []) as unknown as VarastoProduct[])
      setNoudot((noutoRes.data ?? []) as unknown as Noutopyynto[])
      setTools((toolRes.data ?? []) as unknown as Tool[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const iv = setInterval(fetchAll, 15000)
    return () => clearInterval(iv)
  }, [fetchAll])

  // ── Johdetut listat ──
  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])
  const searchHits = useMemo(
    () => (search.trim() ? activeProducts.filter((p) => matchesProduct(p, search)) : []),
    [activeProducts, search],
  )
  // Saapuva tavara: tilatut tuotteet (→ Hyllyyn) + toimittajalta tilatut tarpeet (→ läpikulku keräilyyn)
  const saapuvatTuotteet = useMemo(() => activeProducts.filter((p) => p.saldo_tila === 'tilattu'), [activeProducts])
  const saapuvatTarpeet = useMemo(
    () => requests.filter((r) => r.forwarded_to === 'toimittaja' && r.status === 'tilattu'),
    [requests],
  )
  // Keräilyjono: varaston omat tarpeet + varastolle saapunut läpikulkutavara
  const kerailyjono = useMemo(
    () => requests.filter((r) =>
      (r.forwarded_to === 'varasto' && (r.status === 'hyvaksytty' || r.status === 'tilattu')) || r.status === 'saapunut'),
    [requests],
  )
  const tilausryhmat = useMemo(() => groupForOrdering(products), [products])
  const tilausMaara = useMemo(() => tilausryhmat.reduce((s, g) => s + g.items.length, 0), [tilausryhmat])
  const viat = useMemo(() => tools.filter((t) => t.vika_ilmoitettu !== null), [tools])
  const tarraJono = useMemo(() => products.filter((p) => p.active && !p.tarra_tulostettu), [products])
  const doneCount = useMemo(
    () => requests.filter((r) => r.forwarded_to === 'varasto' && r.status === 'toimitettu').length,
    [requests],
  )

  // ── Toiminnot ──
  async function setSaldo(p: VarastoProduct, tila: SaldoTila) {
    if (busy) return
    setBusy(true)
    const patch: Record<string, unknown> = { saldo_tila: tila, saldo_paivitetty: new Date().toISOString() }
    if (tila === 'tilattu') patch.tilattu_at = new Date().toISOString()
    if (tila === 'vihrea') patch.tilattu_at = null
    const { error: e } = await supabase.from('products').update(patch).eq('id', p.id)
    if (e) setToast('Päivitys epäonnistui')
    else {
      setToast(tila === 'tilattu' ? `${p.name}: merkitty tilatuksi` : `${p.name}: ${SALDO_LABEL[tila]}`)
      setSelected(null)
      fetchAll()
    }
    setBusy(false)
  }

  async function markRequest(r: MaterialRequest, status: 'tilattu' | 'saapunut' | 'toimitettu') {
    const patch =
      status === 'tilattu' ? { status, ordered_at: new Date().toISOString() }
      : status === 'saapunut' ? { status, saapunut_at: new Date().toISOString() }
      : { status, delivered_at: new Date().toISOString() }
    const { error: e } = await supabase.from('material_requests').update(patch).eq('id', r.id)
    if (e) setToast('Päivitys epäonnistui')
    else {
      setToast(status === 'saapunut' ? 'Saapui varastolle — siirtyi keräilyyn'
        : status === 'tilattu' ? 'Merkitty kerätyksi/tilatuksi' : 'Merkitty toimitetuksi')
      fetchAll()
    }
  }

  async function merkitseNoudetuksi(n: Noutopyynto) {
    const { error: e } = await supabase.from('noutopyynnot')
      .update({ status: 'noudettu', noudettu_by: user?.id ?? null, noudettu_at: new Date().toISOString() })
      .eq('id', n.id)
    if (e) setToast('Kuittaus epäonnistui')
    else { setToast(`${n.item_text}: noudettu varastoon`); fetchAll() }
  }

  async function merkitseKorjatuksi(t: Tool) {
    if (busy) return
    setBusy(true)
    const { error: e } = await supabase.from('tools')
      .update({ status: 'varastossa', worksite_id: null, holder_id: null, vika_kuvaus: null, vika_ilmoitettu: null, vika_ilmoittaja: null })
      .eq('id', t.id)
    if (e) setToast('Kuittaus epäonnistui')
    else {
      await supabase.from('tool_events').insert({
        tool_id: t.id, user_id: user?.id, user_name: profile?.full_name ?? '',
        event: `Korjattu — palautettu käyttöön${t.vika_kuvaus ? ` (vika: ${t.vika_kuvaus})` : ''}`, to_status: 'varastossa',
      })
      setToast(`${toolLabel(t)}: korjattu, varastossa`)
      fetchAll()
    }
    setBusy(false)
  }

  async function createProduct() {
    if (!profile || !nName.trim() || busy) return
    setBusy(true)
    const { error: e } = await supabase.from('products').insert({
      organization_id: profile.organization_id,
      name: nName.trim(), unit: nUnit,
      koodi: nKoodi.trim() || null,
      hyllypaikka: nHylly.trim() || null,
      toimittaja: nToimittaja.trim() || null,
      saldo_tila: nTila,
    })
    if (e) setToast('Tuotteen lisäys epäonnistui (nimi jo käytössä?)')
    else {
      setToast(`${nName.trim()} lisätty — tarra tulostusjonoon`)
      setNAdded((c) => c + 1)
      setNKoodi(''); setNName(''); setNHylly(''); setNTila('vihrea')
      // toimittaja ja yksikkö jäävät — sama laatikko tulee usein samalta toimittajalta
      nKoodiRef.current?.focus()
      fetchAll()
    }
    setBusy(false)
  }

  async function saveEdit() {
    if (!selected || !edName.trim() || busy) return
    setBusy(true)
    const { error: e } = await supabase.from('products').update({
      name: edName.trim(),
      koodi: edKoodi.trim() || null,
      hyllypaikka: edHylly.trim() || null,
      toimittaja: edToimittaja.trim() || null,
    }).eq('id', selected.id)
    if (e) setToast('Tallennus epäonnistui')
    else { setToast('Tuotetiedot tallennettu'); setEditOpen(false); setSelected(null); fetchAll() }
    setBusy(false)
  }

  async function toggleActive() {
    if (!selected || busy) return
    setBusy(true)
    const { error: e } = await supabase.from('products').update({ active: !selected.active }).eq('id', selected.id)
    if (e) setToast('Päivitys epäonnistui')
    else { setToast(selected.active ? `${selected.name} poistettu käytöstä` : `${selected.name} palautettu käyttöön`); setEditOpen(false); setSelected(null); fetchAll() }
    setBusy(false)
  }

  // Hyllynreunatarrat vain uusille tuotteille (2 × 4 per A4) — kuittaa tulostusjonon
  async function printUudetTarrat() {
    if (printing || tarraJono.length === 0) return
    setPrinting(true)
    try {
      const [{ default: jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')])
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const cols = 2, rows = 4, cw = 95, ch = 68, mx = 10, my = 12
      for (let i = 0; i < tarraJono.length; i++) {
        const p = tarraJono[i]
        const idx = i % (cols * rows)
        if (i > 0 && idx === 0) doc.addPage()
        const x = mx + (idx % cols) * cw
        const y = my + Math.floor(idx / cols) * ch
        const url = `${window.location.origin}/varastohaku?qr=${p.qr_token}`
        const qr = await QRCode.toDataURL(url, { width: 300, margin: 0 })
        doc.setDrawColor(180); doc.roundedRect(x + 1, y + 1, cw - 2, ch - 2, 3, 3)
        doc.addImage(qr, 'PNG', x + 6, y + 8, 50, 50)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
        doc.text(doc.splitTextToSize(p.name, 32) as string[], x + 60, y + 16)
        if (p.koodi) { doc.setFontSize(13); doc.text(p.koodi, x + 60, y + 36) }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90)
        if (p.hyllypaikka) doc.text(`Hylly: ${p.hyllypaikka}`, x + 60, y + 44)
        doc.text(`yksikkö: ${p.unit}`, x + 60, y + 51)
        doc.setFontSize(7)
        doc.text('Skannaa kun otat\ntavaraa mukaan', x + 60, y + 58)
        doc.setTextColor(0)
      }
      doc.save('FloorData_hyllytarrat_uudet.pdf')
      await supabase.from('products').update({ tarra_tulostettu: true }).in('id', tarraJono.map((p) => p.id))
      setToast(`${tarraJono.length} tarraa tulostettu ja kuitattu`)
      fetchAll()
    } catch {
      setToast('Tarra-arkin luonti epäonnistui')
    }
    setPrinting(false)
  }

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'
  const sectionTitle = 'text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2'

  function ProductRow({ p }: { p: VarastoProduct }) {
    return (
      <button onClick={() => setSelected(p)}
        className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{p.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {p.koodi ? `${p.koodi} · ` : ''}{p.hyllypaikka ? `hylly ${p.hyllypaikka}` : 'ei hyllypaikkaa'}
            </p>
          </div>
          <span className={`shrink-0 text-[11px] font-bold border rounded-full px-2.5 py-1 ${SALDO_STYLE[p.saldo_tila]}`}>
            {SALDO_LABEL[p.saldo_tila]}
          </span>
        </div>
      </button>
    )
  }

  function RequestCard({ r }: { r: MaterialRequest }) {
    return (
      <div className={`bg-gray-900 border rounded-2xl p-4 ${r.kiire ? 'border-red-800' : 'border-gray-800'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm">{r.item_text}{r.maara ? ` · ${r.maara}` : ''}</p>
            <p className="text-xs text-gray-500 mt-1">{r.worksites?.name}{r.worksites?.address ? ` · ${r.worksites.address}` : ''}</p>
            <p className="text-xs text-gray-500">Pyytäjä: {r.requester?.full_name} · {timeAgo(r.created_at)}</p>
            {r.lisatiedot && <p className="text-xs text-gray-400 mt-1">{r.lisatiedot}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {r.kiire && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> KIIRE
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
          </div>
        </div>
        {r.status === 'hyvaksytty' && (
          <button onClick={() => markRequest(r, 'tilattu')} className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-purple-500/20 text-purple-300 rounded-xl text-xs font-semibold">
            <Check className="w-4 h-4" /> Kerätty / lähtee varastolta
          </button>
        )}
        {(r.status === 'tilattu' || r.status === 'saapunut') && (
          <button onClick={() => markRequest(r, 'toimitettu')} className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-green-500/20 text-green-300 rounded-xl text-xs font-semibold">
            <Check className="w-4 h-4" /> Toimitettu työmaalle
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">FloorData</h1>
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider -mt-0.5">Varasto</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/arkisto')} aria-label="Arkisto" className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-amber-300">
            <Archive className="w-4 h-4" /> Arkisto
          </button>
          <button onClick={() => navigate('/varastohaku')} aria-label="Varastohaku" className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-amber-300">
            <Warehouse className="w-4 h-4" /> Haut
          </button>
          <button onClick={() => navigate('/tyokalut')} aria-label="Työkalut" className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-amber-300">
            <Wrench className="w-4 h-4" /> Työkalut
          </button>
          <button onClick={signOut} aria-label="Kirjaudu ulos" title="Kirjaudu ulos" className="p-3 -m-1 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-6">
        {/* ===== KOODIHAKU — vastaa puhelun sijaan ===== */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Onko meillä…? Hae koodilla tai nimellä" className={`${inputCls} pl-10 pr-10`} />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Tyhjennä haku" className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-gray-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && search.trim() && (
          <section className="space-y-2">
            <p className={sectionTitle}><Search className="w-4 h-4" /> Hakutulokset ({searchHits.length})</p>
            {searchHits.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">Ei osumia haulle ”{search.trim()}”. Uusi tuote lisätään Tuotteet-osion napista.</p>
            )}
            {searchHits.map((p) => <ProductRow key={p.id} p={p} />)}
          </section>
        )}

        {!loading && !error && !search.trim() && (
          <>
            {/* ===== SAAPUVA TAVARA ===== */}
            {(saapuvatTuotteet.length > 0 || saapuvatTarpeet.length > 0) && (
              <section className="space-y-2">
                <p className={sectionTitle}><Truck className="w-4 h-4" /> Saapuva tavara ({saapuvatTuotteet.length + saapuvatTarpeet.length})</p>
                {saapuvatTuotteet.map((p) => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.koodi ? `${p.koodi} · ` : ''}tilattu {p.tilattu_at ? timeAgo(p.tilattu_at) : ''}{p.hyllypaikka ? ` · hylly ${p.hyllypaikka}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-bold border rounded-full px-2.5 py-1 ${SALDO_STYLE.tilattu}`}>Tilattu</span>
                    </div>
                    <button onClick={() => setSaldo(p, 'vihrea')} disabled={busy}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-green-500/20 text-green-300 rounded-xl text-xs font-semibold disabled:opacity-40">
                      <Check className="w-4 h-4" /> Hyllyyn — saldo kuntoon
                    </button>
                  </div>
                ))}
                {saapuvatTarpeet.map((r) => (
                  <div key={r.id} className={`bg-gray-900 border rounded-2xl p-4 ${r.kiire ? 'border-red-800' : 'border-gray-800'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{r.item_text}{r.maara ? ` · ${r.maara}` : ''}</p>
                        <p className="text-xs text-gray-500 mt-1">Läpikulku → {r.worksites?.name ?? ''}</p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </div>
                    <button onClick={() => markRequest(r, 'saapunut')}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-cyan-500/20 text-cyan-300 rounded-xl text-xs font-semibold">
                      <Check className="w-4 h-4" /> Saapui varastolle — keräilyyn
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* ===== KERÄILYJONO ===== */}
            <section className="space-y-2">
              <p className={sectionTitle}><PackageOpen className="w-4 h-4" /> Keräilyjono ({kerailyjono.length})</p>
              {kerailyjono.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Ei avoimia toimituksia. Työnjohtajan varastolle ohjaamat tarpeet ilmestyvät tähän.</p>
              )}
              {kerailyjono.map((r) => <RequestCard key={r.id} r={r} />)}
              {doneCount > 0 && <p className="text-xs text-gray-600 text-center">{doneCount} toimitettua</p>}
            </section>

            {/* ===== TILAA NÄITÄ ===== */}
            {tilausMaara > 0 && (
              <section className="space-y-2">
                <p className={sectionTitle}><AlertTriangle className="w-4 h-4 text-red-400" /> Tilaa näitä ({tilausMaara})</p>
                {tilausryhmat.map((g) => (
                  <div key={g.toimittaja ?? '-'} className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-1">{g.toimittaja ?? 'Toimittaja ei tiedossa'}</p>
                    {g.items.map((p) => (
                      <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{p.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{p.koodi ? `${p.koodi} · ` : ''}{SALDO_LABEL[p.saldo_tila].toLowerCase()} {timeAgo(p.saldo_paivitetty)}</p>
                          </div>
                          <span className={`shrink-0 text-[11px] font-bold border rounded-full px-2.5 py-1 ${SALDO_STYLE[p.saldo_tila]}`}>{SALDO_LABEL[p.saldo_tila]}</span>
                        </div>
                        <button onClick={() => setSaldo(p, 'tilattu')} disabled={busy}
                          className="w-full mt-2.5 flex items-center justify-center gap-2 py-2.5 bg-blue-500/20 text-blue-300 rounded-xl text-xs font-semibold disabled:opacity-40">
                          <Check className="w-4 h-4" /> Merkitse tilatuksi
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )}

            {/* ===== NOUDOT TYÖMAILTA ===== */}
            {noudot.length > 0 && (
              <section className="space-y-2">
                <p className={sectionTitle}><Undo2 className="w-4 h-4" /> Noudot työmailta ({noudot.length})</p>
                {noudot.map((n) => (
                  <div key={n.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <p className="font-semibold text-sm">{n.item_text}{n.maara ? ` · ${n.maara}` : ''}</p>
                    <p className="text-xs text-gray-500 mt-1">{n.worksites?.name}{n.worksites?.address ? ` · ${n.worksites.address}` : ''}</p>
                    <p className="text-xs text-gray-500">Pyytäjä: {n.requester_name ?? ''} · {timeAgo(n.created_at)}</p>
                    {n.lisatiedot && <p className="text-xs text-gray-400 mt-1">{n.lisatiedot}</p>}
                    <button onClick={() => merkitseNoudetuksi(n)}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-green-500/20 text-green-300 rounded-xl text-xs font-semibold">
                      <Check className="w-4 h-4" /> Noudettu varastoon
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* ===== VIKAILMOITUKSET ===== */}
            {viat.length > 0 && (
              <section className="space-y-2">
                <p className={sectionTitle}><Wrench className="w-4 h-4 text-purple-300" /> Vikailmoitukset ({viat.length})</p>
                {viat.map((t) => (
                  <div key={t.id} className="bg-gray-900 border border-purple-900/50 rounded-2xl p-4">
                    <p className="font-semibold text-sm">{toolLabel(t)}</p>
                    {t.vika_kuvaus && <p className="text-sm text-purple-200/90 mt-1">”{t.vika_kuvaus}”</p>}
                    <p className="text-xs text-gray-500 mt-1">
                      Ilmoitti: {t.vika_ilmoittaja ?? ''}{t.vika_ilmoitettu ? ` · ${timeAgo(t.vika_ilmoitettu)}` : ''}
                    </p>
                    <button onClick={() => merkitseKorjatuksi(t)} disabled={busy}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-green-500/20 text-green-300 rounded-xl text-xs font-semibold disabled:opacity-40">
                      <Check className="w-4 h-4" /> Korjattu — takaisin käyttöön
                    </button>
                  </div>
                ))}
              </section>
            )}

            {/* ===== TUOTTEET HYLLYSSÄ ===== */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={sectionTitle}><Warehouse className="w-4 h-4" /> Tuotteet ({activeProducts.length})</p>
                <button onClick={() => { setNAdded(0); setNewOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-gray-950 rounded-xl text-xs font-bold">
                  <Plus className="w-4 h-4" /> Uusi tuote
                </button>
              </div>
              {tarraJono.length > 0 && (
                <button onClick={printUudetTarrat} disabled={printing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 border border-amber-500/40 text-amber-300 rounded-2xl text-sm font-semibold disabled:opacity-40">
                  <Printer className="w-4 h-4" /> {printing ? 'Tulostetaan…' : `Tulosta uudet hyllytarrat (${tarraJono.length})`}
                </button>
              )}
              {activeProducts.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Ei vielä tuotteita. Lisää ensimmäinen kun hyllytät — koodi, nimi, hyllypaikka, valmis.</p>
              )}
              {activeProducts.map((p) => <ProductRow key={p.id} p={p} />)}
            </section>

            {/* ===== KALUSTO — missä ja kenellä koneet ===== */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={sectionTitle}><Wrench className="w-4 h-4" /> Kalusto ({tools.length})</p>
                <button onClick={() => navigate('/tyokalut')} className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-amber-300">
                  Avaa työkalut <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {tools.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Ei koneita rekisterissä. Lisää ne Työkalut-sivulta.</p>}
              {(kalustoAuki ? tools : tools.slice(0, 6)).map((t) => (
                <button key={t.id} onClick={() => navigate(`/tyokalut?qr=${t.qr_token}`)}
                  className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 hover:border-gray-700 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{toolLabel(t)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{toolLocation(t)} · {toolTimeAgo(t.updated_at)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold border rounded-full px-2 py-0.5 ${TOOL_STATUS_STYLE[t.status]}`}>{TOOL_STATUS_LABEL[t.status]}</span>
                  </div>
                </button>
              ))}
              {tools.length > 6 && !kalustoAuki && (
                <button onClick={() => setKalustoAuki(true)} className="w-full py-2.5 text-xs font-semibold text-gray-400 bg-gray-900 border border-gray-800 rounded-2xl">
                  Näytä kaikki ({tools.length})
                </button>
              )}
            </section>
          </>
        )}
      </main>

      {/* ===== TUOTESHEET: liikennevalo yhdellä napautuksella ===== */}
      {selected && !editOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-bold truncate">{selected.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selected.koodi ? `${selected.koodi} · ` : ''}{selected.hyllypaikka ? `hylly ${selected.hyllypaikka}` : 'ei hyllypaikkaa'}
                  {selected.toimittaja ? ` · ${selected.toimittaja}` : ''}
                </p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-xs text-gray-500">
              Nyt: <span className="font-bold text-gray-300">{SALDO_LABEL[selected.saldo_tila]}</span> · päivitetty {timeAgo(selected.saldo_paivitetty)}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(['vihrea', 'keltainen', 'punainen'] as const).map((tila) => (
                <button key={tila} onClick={() => setSaldo(selected, tila)} disabled={busy}
                  className={`py-4 rounded-xl text-sm font-bold border disabled:opacity-40 ${selected.saldo_tila === tila ? SALDO_BUTTON[tila] : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                  {SALDO_LABEL[tila]}
                </button>
              ))}
            </div>

            {(selected.saldo_tila === 'punainen' || selected.saldo_tila === 'keltainen') && (
              <button onClick={() => setSaldo(selected, 'tilattu')} disabled={busy}
                className="w-full py-3.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Merkitse tilatuksi
              </button>
            )}
            {selected.saldo_tila === 'tilattu' && (
              <button onClick={() => setSaldo(selected, 'vihrea')} disabled={busy}
                className="w-full py-3.5 bg-green-500/20 text-green-300 border border-green-500/40 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Saapui — hyllyyn
              </button>
            )}

            <button onClick={() => {
              setEdName(selected.name); setEdKoodi(selected.koodi ?? '')
              setEdHylly(selected.hyllypaikka ?? ''); setEdToimittaja(selected.toimittaja ?? '')
              setEditOpen(true)
            }} className="w-full py-3 bg-gray-800 border border-gray-700 text-sm font-semibold rounded-xl">
              Muokkaa tietoja
            </button>
          </div>
        </div>
      )}

      {/* ===== TUOTTEEN MUOKKAUS ===== */}
      {selected && editOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Muokkaa: {selected.name}</h3>
              <button onClick={() => setEditOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <input type="text" value={edName} onChange={(e) => setEdName(e.target.value)} placeholder="Tuotteen nimi" className={inputCls} />
            <input type="text" value={edKoodi} onChange={(e) => setEdKoodi(e.target.value)} placeholder="Koodi (esim. JL60 412)" className={inputCls} />
            <input type="text" value={edHylly} onChange={(e) => setEdHylly(e.target.value)} placeholder="Hyllypaikka (esim. A3)" className={inputCls} />
            <input type="text" value={edToimittaja} onChange={(e) => setEdToimittaja(e.target.value)} placeholder="Toimittaja (valinnainen — ryhmittää tilauslistan)" className={inputCls} />
            <button onClick={saveEdit} disabled={!edName.trim() || busy}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Tallenna
            </button>
            <button onClick={toggleActive} disabled={busy}
              className={`w-full py-3 bg-gray-800 border text-sm font-semibold rounded-xl disabled:opacity-40 ${selected.active ? 'border-red-900/50 text-red-400' : 'border-green-500/40 text-green-400'}`}>
              {selected.active ? 'Poista käytöstä (ei poistu historiasta)' : 'Palauta käyttöön'}
            </button>
          </div>
        </div>
      )}

      {/* ===== UUSI TUOTE — liukuhihna: sheet pysyy auki, seuraava heti perään ===== */}
      {newOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setNewOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" /> Uusi tuote hyllyyn{nAdded > 0 ? ` (${nAdded} lisätty)` : ''}
              </h3>
              <button onClick={() => setNewOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <input ref={nKoodiRef} type="text" value={nKoodi} onChange={(e) => setNKoodi(e.target.value)} placeholder="Koodi (esim. JL60 412)" className={inputCls} />
            <input type="text" value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Tuotteen nimi (esim. Tarkett iQ Granit)" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={nHylly} onChange={(e) => setNHylly(e.target.value)} placeholder="Hyllypaikka (A3)" className={inputCls} />
              <input type="text" value={nToimittaja} onChange={(e) => setNToimittaja(e.target.value)} placeholder="Toimittaja" className={inputCls} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['kpl', 'astia', 'säkki', 'rulla', 'nippu', 'patruuna', 'l', 'kg', 'm²'].map((u) => (
                <button key={u} onClick={() => setNUnit(u)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${nUnit === u ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {u}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['vihrea', 'keltainen', 'punainen'] as const).map((tila) => (
                <button key={tila} onClick={() => setNTila(tila)}
                  className={`py-3 rounded-xl text-sm font-bold border ${nTila === tila ? SALDO_BUTTON[tila] : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                  {SALDO_LABEL[tila]}
                </button>
              ))}
            </div>
            <button onClick={createProduct} disabled={!nName.trim() || busy}
              className="w-full h-14 rounded-2xl bg-amber-500 text-gray-950 text-base font-bold disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-5 h-5" /> {busy ? 'Lisätään…' : 'Lisää ja jatka seuraavaan'}
            </button>
            <p className="text-xs text-gray-500">Tarra menee tulostusjonoon — tulosta arkki kun laatikko on purettu.</p>
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
