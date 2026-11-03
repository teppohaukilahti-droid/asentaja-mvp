// Arkisto: yksi haku joka löytää KAIKEN — pöytäkirjat, tilaukset, haut, kirjaukset,
// huonemerkinnät, työkalut, palautteet ja arkistoidut dokumentit/kuvat tageineen.
// Käyttötapaus: "vuoden vanha työmaa, minkä väristä jalkalistaa sinne meni?"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Archive, Search, X, Check, Plus, FileText, Camera, Ruler,
  ShoppingCart, PackageOpen, Package, Hammer, StickyNote, Wrench, Star,
  RefreshCw, ExternalLink, Tag,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'

type WsRow = { id: string; name: string; status: string }

type Item = {
  key: string
  source: 'dokumentti' | 'tuote' | 'poytakirja' | 'tilaus' | 'haku' | 'materiaali' | 'kirjaus' | 'huone' | 'tyokalu' | 'palaute'
  date: string
  title: string
  sub: string
  wsId: string | null
  tags: string[]
  haystack: string
  filePath?: string | null
  photoUrl?: string | null
}

const SOURCE_META: Record<Item['source'], { label: string; icon: typeof FileText; color: string }> = {
  dokumentti: { label: 'Dokumentti', icon: FileText, color: 'text-amber-400' },
  tuote: { label: 'Tuote', icon: Package, color: 'text-lime-400' },
  poytakirja: { label: 'Pöytäkirja', icon: Ruler, color: 'text-green-400' },
  tilaus: { label: 'Tilaus', icon: ShoppingCart, color: 'text-blue-400' },
  haku: { label: 'Varastohaku', icon: PackageOpen, color: 'text-orange-400' },
  materiaali: { label: 'Materiaali', icon: Package, color: 'text-teal-400' },
  kirjaus: { label: 'Kirjaus', icon: Hammer, color: 'text-purple-400' },
  huone: { label: 'Huonemerkintä', icon: StickyNote, color: 'text-yellow-400' },
  tyokalu: { label: 'Työkalu', icon: Wrench, color: 'text-gray-400' },
  palaute: { label: 'Palaute', icon: Star, color: 'text-pink-400' },
}

const TYPE_FILTERS: { key: Item['source'] | 'kaikki'; label: string }[] = [
  { key: 'kaikki', label: 'Kaikki' },
  { key: 'tuote', label: 'Tuotteet' },
  { key: 'dokumentti', label: 'Dokumentit' },
  { key: 'poytakirja', label: 'Pöytäkirjat' },
  { key: 'tilaus', label: 'Tilaukset' },
  { key: 'haku', label: 'Haut' },
  { key: 'materiaali', label: 'Materiaalit' },
  { key: 'kirjaus', label: 'Kirjaukset' },
  { key: 'huone', label: 'Huoneet' },
  { key: 'tyokalu', label: 'Työkalut' },
  { key: 'palaute', label: 'Palaute' },
]


// Rivityypit yleishaun lähteille (PostgREST-vastausten muodot)
type ArkRow = { id: string; worksite_id: string | null; tyyppi: string; otsikko: string; kuvaus: string | null; tags: string[] | null; file_path: string | null; user_name: string | null; created_at: string }
type MpkRow = { id: string; worksite_id: string | null; numero: number; tyokohde: string | null; huom: string | null; tyontekijat: string | null; mestari_nimi: string | null; status: string; period_start: string | null; period_end: string | null; created_at: string }
type ReqRow = { id: string; worksite_id: string | null; item_text: string; maara: string | null; lisatiedot: string | null; status: string; created_at: string; delivered_at: string | null }
type PickRow = { id: string; worksite_id: string | null; product_name: string; maara: number; unit: string; suunta: string; user_name: string | null; created_at: string }
type MatRow = { id: string; worksite_id: string | null; name: string; balance: number | null; unit: string | null; notes: string | null; created_at: string }
type EntRow = { id: string; worksite_id: string | null; description: string | null; entry_type: string; amount: number | null; hours: number | null; entry_date: string | null; created_at: string }
type NoteRow = { id: string; text: string | null; photo_url: string | null; created_at: string; rooms: { name: string | null; floorplans: { worksite_id: string | null } | null } | null }
type ToolRow = { id: string; worksite_id: string | null; worksite_name: string | null; event: string; user_name: string | null; created_at: string; tools: { name: string } | null }
type PalRow = { id: string; worksite_id: string | null; numero: number | null; mestari_nimi: string | null; tahdet: number | null; viesti: string | null; created_at: string }
type WprodRow = { id: string; worksite_id: string | null; kategoria: string; tuote: string; vari: string | null; koodi: string | null; era: string | null; toimittaja: string | null; maara: string | null; sijainti: string | null; lisatiedot: string | null; created_at: string }

const ARCHIVE_TYPES = ['dokumentti', 'kuva', 'mittapoytakirja', 'tilaus', 'toimitus', 'korjaus', 'muistiinpano', 'tarjouspyynto', 'aloituspalaveri', 'paatos', 'sopimus'] as const

function norm(s: unknown): string { return String(s ?? '').toLowerCase() }

export default function ArkistoPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()

  const [worksites, setWorksites] = useState<WsRow[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [term, setTerm] = useState('')
  const [wsFilter, setWsFilter] = useState<string | null>(params.get('ws'))
  const [typeFilter, setTypeFilter] = useState<Item['source'] | 'kaikki'>('kaikki')

  const [addOpen, setAddOpen] = useState(false)
  const [aOtsikko, setAOtsikko] = useState('')
  const [aKuvaus, setAKuvaus] = useState('')
  const [aTags, setATags] = useState('')
  const [aTyyppi, setATyyppi] = useState<string>('dokumentti')
  const [aWs, setAWs] = useState<string | null>(params.get('ws'))
  const [aFile, setAFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const wsName = useCallback((id: string | null, map: Map<string, string>) =>
    (id ? map.get(id) ?? '' : ''), [])

  const fetchAll = useCallback(async () => {
    setError(null)
    const L = 300
    const [wsRes, arkRes, mpkRes, reqRes, pickRes, matRes, entRes, noteRes, toolRes, palRes, wprodRes] = await Promise.all([
      supabase.from('worksites').select('id, name, status').order('created_at', { ascending: false }),
      supabase.from('archive_items').select('id, worksite_id, tyyppi, otsikko, kuvaus, tags, file_path, file_type, user_name, created_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('mittapoytakirjat').select('id, worksite_id, numero, tyokohde, huom, tyontekijat, mestari_nimi, status, period_start, period_end, created_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('material_requests').select('id, worksite_id, item_text, maara, lisatiedot, status, created_at, delivered_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('material_pickups').select('id, worksite_id, product_name, maara, unit, suunta, user_name, created_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('materials').select('id, worksite_id, name, balance, unit, notes, created_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('entries').select('id, worksite_id, description, entry_type, amount, hours, entry_date, created_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('room_notes').select('id, text, photo_url, created_at, rooms!inner(name, floorplans!inner(worksite_id))').order('created_at', { ascending: false }).limit(L),
      supabase.from('tool_events').select('id, worksite_id, worksite_name, event, to_status, user_name, created_at, tools(name)').order('created_at', { ascending: false }).limit(L),
      supabase.from('mestari_palaute').select('id, worksite_id, numero, mestari_nimi, tahdet, viesti, created_at').order('created_at', { ascending: false }).limit(L),
      supabase.from('worksite_products').select('id, worksite_id, kategoria, tuote, vari, koodi, era, toimittaja, maara, sijainti, toimitettu, lisatiedot, user_name, created_at').order('created_at', { ascending: false }).limit(L),
    ])

    if (wsRes.error) { setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.'); setLoading(false); return }
    const ws = wsRes.data ?? []
    setWorksites(ws)
    const map = new Map(ws.map((w) => [w.id, w.name]))

    const out: Item[] = []

    for (const r of (wprodRes.data ?? []) as unknown as WprodRow[]) {
      out.push({
        key: `w${r.id}`, source: 'tuote', date: r.created_at, wsId: r.worksite_id,
        title: `${r.tuote}${r.vari ? ` — ${r.vari}` : ''}`,
        sub: [r.kategoria, r.era ? `erä ${r.era}` : '', r.sijainti, r.maara].filter(Boolean).join(' · '),
        tags: [], haystack: norm(`tuote ${r.kategoria} ${r.tuote} ${r.vari} ${r.koodi} ${r.era} ${r.toimittaja} ${r.sijainti} ${r.lisatiedot} ${wsName(r.worksite_id, map)}`),
      })
    }

    for (const r of (arkRes.data ?? []) as unknown as ArkRow[]) {
      out.push({
        key: `a${r.id}`, source: 'dokumentti', date: r.created_at, wsId: r.worksite_id,
        title: r.otsikko,
        sub: [SOURCE_META.dokumentti.label !== r.tyyppi ? r.tyyppi : '', r.user_name].filter(Boolean).join(' · '),
        tags: r.tags ?? [], filePath: r.file_path, photoUrl: null,
        haystack: norm(`${r.otsikko} ${r.kuvaus} ${(r.tags ?? []).join(' ')} ${r.tyyppi} ${r.user_name} ${wsName(r.worksite_id, map)}`),
      })
    }
    for (const r of (mpkRes.data ?? []) as unknown as MpkRow[]) {
      out.push({
        key: `m${r.id}`, source: 'poytakirja', date: r.created_at, wsId: r.worksite_id,
        title: `Mittauspöytäkirja #${r.numero}${r.tyokohde ? ` — ${r.tyokohde}` : ''}`,
        sub: [r.status === 'approved' ? 'hyväksytty' : r.status, r.mestari_nimi, r.period_start ? `${formatDate(r.period_start)}–${r.period_end ? formatDate(r.period_end) : ''}` : ''].filter(Boolean).join(' · '),
        tags: [], haystack: norm(`mittauspöytäkirja pöytäkirja ${r.numero} ${r.tyokohde} ${r.huom} ${r.tyontekijat} ${r.mestari_nimi} ${wsName(r.worksite_id, map)}`),
      })
    }
    for (const r of (reqRes.data ?? []) as unknown as ReqRow[]) {
      out.push({
        key: `r${r.id}`, source: 'tilaus', date: r.created_at, wsId: r.worksite_id,
        title: `${r.item_text}${r.maara ? ` (${r.maara})` : ''}`,
        sub: [r.status, r.delivered_at ? `toimitettu ${formatDate(r.delivered_at)}` : ''].filter(Boolean).join(' · '),
        tags: [], haystack: norm(`tilaus tarve ${r.item_text} ${r.maara} ${r.lisatiedot} ${r.status} ${wsName(r.worksite_id, map)}`),
      })
    }
    for (const r of (pickRes.data ?? []) as unknown as PickRow[]) {
      out.push({
        key: `p${r.id}`, source: 'haku', date: r.created_at, wsId: r.worksite_id,
        title: `${r.product_name} ${String(r.maara).replace('.', ',')} ${r.unit}${r.suunta === 'palautus' ? ' (palautus)' : ''}`,
        sub: r.user_name ?? '',
        tags: [], haystack: norm(`varastohaku haku ${r.product_name} ${r.user_name} ${r.suunta} ${wsName(r.worksite_id, map)}`),
      })
    }
    for (const r of (matRes.data ?? []) as unknown as MatRow[]) {
      out.push({
        key: `t${r.id}`, source: 'materiaali', date: r.created_at, wsId: r.worksite_id,
        title: `${r.name} — saldo ${String(r.balance ?? 0).replace('.', ',')} ${r.unit ?? ''}`,
        sub: r.notes ?? '',
        tags: [], haystack: norm(`materiaali ${r.name} ${r.notes} ${wsName(r.worksite_id, map)}`),
      })
    }
    for (const r of (entRes.data ?? []) as unknown as EntRow[]) {
      out.push({
        key: `e${r.id}`, source: 'kirjaus', date: r.created_at, wsId: r.worksite_id,
        title: r.description || (r.entry_type === 'tunti' ? `Tuntikirjaus ${String(r.hours ?? '').replace('.', ',')} h` : `Urakkakirjaus ${String(r.amount ?? '').replace('.', ',')}`),
        sub: r.entry_date ? formatDate(r.entry_date) : '',
        tags: [], haystack: norm(`kirjaus ${r.description} ${r.entry_type} ${wsName(r.worksite_id, map)}`),
      })
    }
    for (const r of (noteRes.data ?? []) as unknown as NoteRow[]) {
      const nWs = r.rooms?.floorplans?.worksite_id ?? null
      out.push({
        key: `n${r.id}`, source: 'huone', date: r.created_at, wsId: nWs,
        title: r.text || 'Kuva',
        sub: r.rooms?.name ?? '',
        tags: [], photoUrl: r.photo_url,
        haystack: norm(`huone merkintä ${r.text} ${r.rooms?.name} ${wsName(nWs, map)}`),
      })
    }
    for (const r of (toolRes.data ?? []) as unknown as ToolRow[]) {
      out.push({
        key: `k${r.id}`, source: 'tyokalu', date: r.created_at, wsId: r.worksite_id,
        title: `${r.tools?.name ?? 'Työkalu'} — ${r.event === 'otto' ? 'otettu' : r.event === 'palautus' ? 'palautettu' : r.event}`,
        sub: [r.user_name, r.worksite_name].filter(Boolean).join(' · '),
        tags: [], haystack: norm(`työkalu ${r.tools?.name} ${r.event} ${r.user_name} ${r.worksite_name}`),
      })
    }
    for (const r of (palRes.data ?? []) as unknown as PalRow[]) {
      out.push({
        key: `f${r.id}`, source: 'palaute', date: r.created_at, wsId: r.worksite_id,
        title: `${'★'.repeat(r.tahdet ?? 0)} ${r.mestari_nimi ?? 'Mestari'}${r.numero ? ` (PTK #${r.numero})` : ''}`,
        sub: r.viesti ?? '',
        tags: [], haystack: norm(`palaute ${r.mestari_nimi} ${r.viesti} ${wsName(r.worksite_id, map)}`),
      })
    }

    out.sort((a, b) => (a.date < b.date ? 1 : -1))
    setItems(out)
    setLoading(false)
  }, [wsName])

  useEffect(() => { fetchAll() }, [fetchAll])

  const wsMap = useMemo(() => new Map(worksites.map((w) => [w.id, w])), [worksites])

  const filtered = useMemo(() => {
    const words = norm(term).split(/\s+/).filter(Boolean)
    return items.filter((it) => {
      if (wsFilter && it.wsId !== wsFilter) return false
      if (typeFilter !== 'kaikki' && it.source !== typeFilter) return false
      if (words.length > 0 && !words.every((w) => it.haystack.includes(w))) return false
      return true
    })
  }, [items, term, wsFilter, typeFilter])

  async function openFile(path: string) {
    const { data, error: sErr } = await supabase.storage.from('arkisto').createSignedUrl(path, 3600)
    if (sErr || !data?.signedUrl) setToast('Tiedoston avaus epäonnistui')
    else window.open(data.signedUrl, '_blank')
  }

  async function saveArchiveItem() {
    if (!user || !profile || !aOtsikko.trim() || saving) return
    setSaving(true)
    let filePath: string | null = null
    let fileType: string | null = null
    if (aFile) {
      const clean = aFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      filePath = `${profile.organization_id}/${aWs ?? 'yleinen'}/${Date.now()}_${clean}`
      const { error: upErr } = await supabase.storage.from('arkisto').upload(filePath, aFile)
      if (upErr) { setToast('Tiedoston lähetys epäonnistui'); setSaving(false); return }
      fileType = aFile.type
    }
    const tags = aTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    const { error: insErr } = await supabase.from('archive_items').insert({
      organization_id: profile.organization_id, worksite_id: aWs,
      tyyppi: aFile?.type.startsWith('image/') && aTyyppi === 'dokumentti' ? 'kuva' : aTyyppi,
      otsikko: aOtsikko.trim(), kuvaus: aKuvaus.trim() || null, tags,
      file_path: filePath, file_type: fileType,
      user_id: user.id, user_name: profile.full_name ?? '',
    })
    if (insErr) setToast('Arkistointi epäonnistui')
    else {
      setToast('Arkistoitu')
      setAddOpen(false); setAOtsikko(''); setAKuvaus(''); setATags(''); setAFile(null); setATyyppi('dokumentti')
      fetchAll()
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Archive className="w-4 h-4 text-amber-500" /> Arkisto
        </h1>
        <button onClick={() => setAddOpen(true)} aria-label="Arkistoi dokumentti" className="ml-auto p-3 text-amber-400">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 py-4 pb-24 max-w-md mx-auto space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search" value={term} onChange={(e) => setTerm(e.target.value)}
            placeholder="Hae kaikesta: jalkalista, tammi, liima, huone…"
            className="w-full pl-10 pr-9 py-3 text-base bg-gray-900 border border-gray-700 rounded-2xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {term && (
            <button onClick={() => setTerm('')} aria-label="Tyhjennä" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500"><X className="w-4 h-4" /></button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          <button onClick={() => setWsFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${!wsFilter ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
            Kaikki työmaat
          </button>
          {worksites.map((w) => (
            <button key={w.id} onClick={() => setWsFilter(wsFilter === w.id ? null : w.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${wsFilter === w.id ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
              {w.name}{w.status !== 'active' ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          {TYPE_FILTERS.map((t) => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${typeFilter === t.key ? 'bg-gray-200 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-xs text-gray-600">{filtered.length} tulosta{term ? ` haulle ”${term}”` : ''}</p>
            <div className="space-y-1.5">
              {filtered.slice(0, 120).map((it) => {
                const meta = SOURCE_META[it.source]
                const Icon = meta.icon
                const ws = it.wsId ? wsMap.get(it.wsId) : null
                return (
                  <div key={it.key} className="bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{it.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[meta.label, ws?.name, it.sub, formatDate(it.date)].filter(Boolean).join(' · ')}
                      </p>
                      {it.tags.length > 0 && (
                        <p className="text-[11px] text-amber-500/80 mt-0.5 flex items-center gap-1 flex-wrap">
                          <Tag className="w-3 h-3" /> {it.tags.join(', ')}
                        </p>
                      )}
                    </div>
                    {it.filePath && (
                      <button onClick={() => openFile(it.filePath!)} aria-label="Avaa tiedosto" className="p-3 text-amber-400 shrink-0"><ExternalLink className="w-4 h-4" /></button>
                    )}
                    {it.photoUrl && it.photoUrl.startsWith('http') && (
                      <button onClick={() => window.open(it.photoUrl!, '_blank')} aria-label="Avaa kuva" className="p-3 text-amber-400 shrink-0"><Camera className="w-4 h-4" /></button>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-10">
                  Ei tuloksia. Kokeile toista hakusanaa — haku etsii pöytäkirjoista, tilauksista, hauista, kirjauksista, huonemerkinnöistä, työkaluista ja dokumenteista.
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {/* Arkistoi dokumentti/kuva */}
      {addOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Arkistoi</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <input type="text" value={aOtsikko} onChange={(e) => setAOtsikko(e.target.value)}
              placeholder="Otsikko (esim. Jalkalista tammi 60mm, 2. krs)" className={inputCls} />

            <div className="flex flex-wrap gap-1.5">
              {ARCHIVE_TYPES.map((t) => (
                <button key={t} onClick={() => setATyyppi(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${aTyyppi === t ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-500">Työmaa</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {worksites.map((w) => (
                <button key={w.id} onClick={() => setAWs(aWs === w.id ? null : w.id)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold ${aWs === w.id ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {w.name}
                </button>
              ))}
            </div>

            <input type="text" value={aTags} onChange={(e) => setATags(e.target.value)}
              placeholder="Hakusanat pilkulla: jalkalista, tammi, takuu" className={inputCls} />
            <textarea value={aKuvaus} onChange={(e) => setAKuvaus(e.target.value)} rows={2}
              placeholder="Lisätiedot (vapaaehtoinen)" className={`${inputCls} resize-none`} />

            <label className="flex items-center gap-3 bg-gray-800 border border-gray-700 border-dashed rounded-xl px-4 py-3.5 cursor-pointer">
              <Camera className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-sm text-gray-300 truncate">{aFile ? aFile.name : 'Liitä kuva tai PDF (vapaaehtoinen)'}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => setAFile(e.target.files?.[0] ?? null)} />
            </label>

            <button onClick={saveArchiveItem} disabled={!aOtsikko.trim() || saving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Arkistoidaan…' : 'Tallenna arkistoon'}
            </button>
            <p className="text-[11px] text-gray-600">Vinkki: kirjoita hakusanoihin kaikki millä joku voisi etsiä tätä vuoden päästä — tuote, väri, kerros, huone.</p>
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
