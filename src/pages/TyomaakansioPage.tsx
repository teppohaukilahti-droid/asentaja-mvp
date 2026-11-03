// Työmaakansio: työmaan pysyvä muisti — mitä tuotteita asennettiin (väri, malli, erä,
// toimittaja, sijainti), mitkä dokumentit ja päätökset koskevat työmaata,
// ja koko paketti ulos yhtenä PDF-luovutuskansiona.
// Takuukorjaustilanne: avaa kansio → tuote, väri ja erä löytyvät sekunneissa.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, FolderOpen, X, Check, Plus, Search, FileText, Printer,
  RefreshCw, ExternalLink, MapPin, Building2, Package, Tag, Camera,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'

type Ws = { id: string; name: string; address: string | null; client_company: string | null; status: string }
type Prod = {
  id: string; kategoria: string; tuote: string; vari: string | null; koodi: string | null
  era: string | null; toimittaja: string | null; maara: string | null; sijainti: string | null
  toimitettu: string | null; lisatiedot: string | null; user_name: string | null; created_at: string
}
type Doc = {
  id: string; tyyppi: string; otsikko: string; kuvaus: string | null; tags: string[]
  file_path: string | null; user_name: string | null; created_at: string
}

const KATEGORIAT = ['matto', 'vinyyli', 'parketti', 'laminaatti', 'jalkalista', 'liima', 'tasoite', 'saumaus', 'muu']
const DOC_TYPE_LABEL: Record<string, string> = {
  dokumentti: 'Dokumentti', kuva: 'Kuva', mittapoytakirja: 'Mittapöytäkirja',
  tilaus: 'Tilaus', toimitus: 'Toimitus', korjaus: 'Korjaus', muistiinpano: 'Muistiinpano',
  tarjouspyynto: 'Tarjouspyyntö', aloituspalaveri: 'Aloituspalaveri', paatos: 'Päätös', sopimus: 'Sopimus',
}

export default function TyomaakansioPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const wsId = params.get('ws')
  const { user, profile } = useAuth()

  const [ws, setWs] = useState<Ws | null>(null)
  const [prods, setProds] = useState<Prod[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const [printing, setPrinting] = useState(false)

  // Kuvaraportti: kohdistettu imurointi pilvestä — työmaa + aikaväli → PDF sähköpostiin
  const [kuvaRange, setKuvaRange] = useState<7 | 30 | 0>(30)
  const [kuvaBusy, setKuvaBusy] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    kategoria: 'matto', tuote: '', vari: '', koodi: '', era: '',
    toimittaja: '', maara: '', sijainti: '', toimitettu: '', lisatiedot: '',
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    if (!wsId) { setError('Työmaata ei valittu.'); setLoading(false); return }
    setError(null)
    const [wsRes, prodRes, docRes] = await Promise.all([
      supabase.from('worksites').select('id, name, address, client_company, status').eq('id', wsId).maybeSingle(),
      supabase.from('worksite_products').select('*').eq('worksite_id', wsId).order('created_at', { ascending: false }),
      supabase.from('archive_items').select('id, tyyppi, otsikko, kuvaus, tags, file_path, user_name, created_at').eq('worksite_id', wsId).order('created_at', { ascending: false }),
    ])
    if (wsRes.error || !wsRes.data) setError('Työmaan haku epäonnistui.')
    else {
      setWs(wsRes.data)
      setProds((prodRes.data ?? []) as Prod[])
      setDocs((docRes.data ?? []) as Doc[])
    }
    setLoading(false)
  }, [wsId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filteredProds = useMemo(() => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return prods
    return prods.filter((p) => {
      const hay = `${p.kategoria} ${p.tuote} ${p.vari} ${p.koodi} ${p.era} ${p.toimittaja} ${p.sijainti} ${p.lisatiedot}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [prods, term])

  async function saveProd() {
    if (!user || !profile || !wsId || !f.tuote.trim() || saving) return
    setSaving(true)
    const { error: insErr } = await supabase.from('worksite_products').insert({
      organization_id: profile.organization_id, worksite_id: wsId,
      kategoria: f.kategoria, tuote: f.tuote.trim(),
      vari: f.vari.trim() || null, koodi: f.koodi.trim() || null, era: f.era.trim() || null,
      toimittaja: f.toimittaja.trim() || null, maara: f.maara.trim() || null,
      sijainti: f.sijainti.trim() || null, toimitettu: f.toimitettu || null,
      lisatiedot: f.lisatiedot.trim() || null,
      user_id: user.id, user_name: profile.full_name ?? '',
    })
    if (insErr) setToast('Tallennus epäonnistui')
    else {
      setToast(`${f.tuote.trim()} kirjattu kansioon`)
      setAddOpen(false)
      setF({ kategoria: 'matto', tuote: '', vari: '', koodi: '', era: '', toimittaja: '', maara: '', sijainti: '', toimitettu: '', lisatiedot: '' })
      fetchAll()
    }
    setSaving(false)
  }

  async function openFile(path: string) {
    const { data, error: sErr } = await supabase.storage.from('arkisto').createSignedUrl(path, 3600)
    if (sErr || !data?.signedUrl) setToast('Tiedoston avaus epäonnistui')
    else window.open(data.signedUrl, '_blank')
  }

  // Kuvaraportti: valitun aikavälin todistekuvat yhtenä PDF:nä, jaettavissa suoraan sähköpostiin
  async function makeKuvaraportti() {
    if (!ws || kuvaBusy) return
    const cutoff = kuvaRange === 0 ? null : new Date(Date.now() - kuvaRange * 86400000).toISOString()
    const photos = docs.filter((d) => d.tyyppi === 'kuva' && d.file_path && (!cutoff || d.created_at >= cutoff))
    if (photos.length === 0) { setToast('Ei kuvia valitulla aikavälillä'); return }
    setKuvaBusy(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const W = 210, M = 16
      doc.setFillColor(24, 24, 27); doc.rect(0, 0, W, 34, 'F')
      doc.setTextColor(245, 158, 11); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
      doc.text('KUVARAPORTTI / TYÖTODISTEET', M, 12)
      doc.setTextColor(255, 255, 255); doc.setFontSize(16)
      doc.text(ws.name, M, 21)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200)
      doc.text(`${photos.length} kuvaa · ${kuvaRange === 0 ? 'koko historia' : `viimeiset ${kuvaRange} pv`} · tulostettu ${new Date().toLocaleDateString('fi-FI')}`, M, 28)
      doc.setTextColor(0, 0, 0)
      let y = 42

      for (const p of photos) {
        const { data: s } = await supabase.storage.from('arkisto').createSignedUrl(p.file_path!, 600)
        if (!s?.signedUrl) continue
        try {
          const blob = await (await fetch(s.signedUrl)).blob()
          const bmp = await createImageBitmap(blob)
          const maxW = 1000
          const scale = Math.min(1, maxW / bmp.width)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(bmp.width * scale)
          canvas.height = Math.round(bmp.height * scale)
          canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
          const imgWmm = W - 2 * M
          const imgHmm = Math.min(120, (canvas.height / canvas.width) * imgWmm)
          if (y + imgHmm + 14 > 285) { doc.addPage(); y = 16 }
          doc.addImage(dataUrl, 'JPEG', M, y, imgWmm, imgHmm)
          y += imgHmm + 5
          doc.setFontSize(9.5); doc.setFont('helvetica', 'bold')
          doc.text(p.otsikko, M, y)
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110)
          doc.text(`${formatDate(p.created_at)} · ${p.user_name ?? ''}`, W - M, y, { align: 'right' })
          doc.setTextColor(0, 0, 0)
          y += 9
        } catch { /* yksittäinen kuva ohitetaan, raportti jatkuu */ }
      }

      const fileName = `Kuvaraportti_${ws.name.replace(/[^a-zA-Z0-9äöåÄÖÅ]/g, '_')}.pdf`
      const blobOut = doc.output('blob')
      const pdfFile = new File([blobOut], fileName, { type: 'application/pdf' })
      // Jaa suoraan sähköpostiin/viestiin jos laite tukee, muuten lataa
      if (navigator.canShare?.({ files: [pdfFile] })) {
        try { await navigator.share({ files: [pdfFile], title: fileName }) } catch { doc.save(fileName) }
      } else {
        doc.save(fileName)
      }
      setToast('Kuvaraportti valmis')
    } catch {
      setToast('Kuvaraportin luonti epäonnistui')
    }
    setKuvaBusy(false)
  }

  // PDF-luovutuskansio: koko työmaan muisti yhtenä dokumenttina
  async function printKansio() {
    if (!ws || printing) return
    setPrinting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const W = 210, M = 16
      let y = 0

      const newPageIfNeeded = (need: number) => {
        if (y + need > 282) { doc.addPage(); y = 18 }
      }

      // Kansilehti-tyylinen otsake
      doc.setFillColor(24, 24, 27); doc.rect(0, 0, W, 42, 'F')
      doc.setTextColor(245, 158, 11); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
      doc.text('TYÖMAAKANSIO / LUOVUTUSAINEISTO', M, 14)
      doc.setTextColor(255, 255, 255); doc.setFontSize(20)
      doc.text(ws.name, M, 24)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(200, 200, 200)
      const infoBits = [ws.address, ws.client_company, ws.status === 'active' ? 'Käynnissä' : 'Valmistunut'].filter(Boolean).join('  ·  ')
      doc.text(infoBits, M, 32)
      doc.setFontSize(8)
      doc.text(`Tulostettu ${new Date().toLocaleDateString('fi-FI')} · FloorData`, M, 38)
      doc.setTextColor(0, 0, 0)
      y = 54

      // Osa 1: Tuotteet ja materiaalit
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
      doc.text('1. Asennetut tuotteet ja materiaalit', M, y); y += 3
      doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 7
      if (prods.length === 0) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10)
        doc.text('Ei kirjattuja tuotteita.', M, y); y += 8
      }
      for (const p of prods) {
        newPageIfNeeded(30)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
        doc.text(`${p.tuote}`, M, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
        doc.text(p.kategoria.toUpperCase(), W - M, y, { align: 'right' })
        doc.setTextColor(0, 0, 0); y += 5.5
        doc.setFontSize(9.5)
        const rows: string[] = []
        if (p.vari) rows.push(`Väri: ${p.vari}`)
        if (p.koodi) rows.push(`Malli/koodi: ${p.koodi}`)
        if (p.era) rows.push(`Erä: ${p.era}`)
        if (p.toimittaja) rows.push(`Toimittaja: ${p.toimittaja}`)
        if (p.maara) rows.push(`Määrä: ${p.maara}`)
        if (p.sijainti) rows.push(`Sijainti: ${p.sijainti}`)
        if (p.toimitettu) rows.push(`Toimitettu: ${formatDate(p.toimitettu)}`)
        const line = rows.join('   ·   ')
        const wrapped = doc.splitTextToSize(line, W - 2 * M) as string[]
        doc.text(wrapped, M, y); y += wrapped.length * 4.6
        if (p.lisatiedot) {
          const extra = doc.splitTextToSize(p.lisatiedot, W - 2 * M) as string[]
          doc.setTextColor(90, 90, 90)
          doc.text(extra, M, y); y += extra.length * 4.4
          doc.setTextColor(0, 0, 0)
        }
        doc.setFontSize(7.5); doc.setTextColor(150, 150, 150)
        doc.text(`Kirjannut ${p.user_name ?? ''} ${formatDate(p.created_at)}`, M, y); y += 3
        doc.setTextColor(0, 0, 0)
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 6
      }

      // Osa 2: Dokumentit ja päätökset
      y += 4; newPageIfNeeded(24)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
      doc.text('2. Dokumentit ja päätökset', M, y); y += 3
      doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 7
      if (docs.length === 0) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10)
        doc.text('Ei arkistoituja dokumentteja.', M, y); y += 8
      }
      for (const d of docs) {
        newPageIfNeeded(14)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
        doc.text(d.otsikko, M, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120)
        doc.text(`${DOC_TYPE_LABEL[d.tyyppi] ?? d.tyyppi} · ${formatDate(d.created_at)} · ${d.user_name ?? ''}${d.file_path ? ' · liite arkistossa' : ''}`, M, y + 4.5)
        doc.setTextColor(0, 0, 0); y += 8
        if (d.kuvaus) {
          const kv = doc.splitTextToSize(d.kuvaus, W - 2 * M) as string[]
          doc.setFontSize(9); doc.setTextColor(70, 70, 70)
          doc.text(kv, M, y); y += kv.length * 4.2
          doc.setTextColor(0, 0, 0)
        }
        y += 2.5
      }

      // Sivunumerot
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(8); doc.setTextColor(150, 150, 150)
        doc.text(`${ws.name} — työmaakansio · sivu ${i}/${pages}`, W / 2, 292, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }
      doc.save(`Tyomaakansio_${ws.name.replace(/[^a-zA-Z0-9äöåÄÖÅ]/g, '_')}.pdf`)
      setToast('Työmaakansio-PDF ladattu')
    } catch {
      setToast('PDF:n luonti epäonnistui')
    }
    setPrinting(false)
  }

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate(-1)} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-semibold flex items-center gap-2 truncate">
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> Työmaakansio
          </h1>
          {ws && <p className="text-xs text-gray-500 truncate">{ws.name}</p>}
        </div>
        <button onClick={printKansio} disabled={printing || !ws} aria-label="Tulosta työmaakansio PDF" title="Tulosta työmaakansio PDF" className="ml-auto p-3 text-amber-400 disabled:opacity-40">
          <Printer className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 py-4 pb-24 max-w-md mx-auto space-y-5">
        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && ws && (
          <>
            {(ws.address || ws.client_company) && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 space-y-1">
                {ws.address && <p className="text-xs text-gray-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {ws.address}</p>}
                {ws.client_company && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {ws.client_company}</p>}
              </div>
            )}

            {/* Tuotteet */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" /> Asennetut tuotteet ({prods.length})
                </h2>
                <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-gray-950 rounded-full text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Kirjaa tuote
                </button>
              </div>

              {prods.length > 3 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="search" value={term} onChange={(e) => setTerm(e.target.value)}
                    placeholder="Hae: väri, erä, toimittaja, sijainti…"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-900 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              )}

              {filteredProds.length === 0 && (
                <p className="text-gray-500 text-sm py-4 text-center">
                  {prods.length === 0
                    ? 'Ei vielä kirjattuja tuotteita. Kirjaa matot, listat ja liimat väreineen ja erineen — vuoden päästä joku kiittää.'
                    : 'Ei osumia haulle.'}
                </p>
              )}

              {filteredProds.map((p) => (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm leading-snug">{p.tuote}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500/90 bg-amber-500/10 rounded-full px-2 py-0.5 shrink-0">{p.kategoria}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-300">
                    {p.vari && <span><span className="text-gray-500">Väri:</span> <b>{p.vari}</b></span>}
                    {p.koodi && <span><span className="text-gray-500">Koodi:</span> {p.koodi}</span>}
                    {p.era && <span><span className="text-gray-500">Erä:</span> {p.era}</span>}
                    {p.maara && <span><span className="text-gray-500">Määrä:</span> {p.maara}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    {p.toimittaja && <span>{p.toimittaja}</span>}
                    {p.sijainti && <span className="text-amber-400/90">{p.sijainti}</span>}
                    {p.toimitettu && <span>toimitettu {formatDate(p.toimitettu)}</span>}
                  </div>
                  {p.lisatiedot && <p className="text-xs text-gray-500">{p.lisatiedot}</p>}
                  <p className="text-[10px] text-gray-600">{p.user_name} · {formatDate(p.created_at)}</p>
                </div>
              ))}
            </section>

            {/* Dokumentit */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Dokumentit ja päätökset ({docs.length})
                </h2>
                <button onClick={() => navigate(`/arkisto?ws=${wsId}`)} className="text-xs font-semibold text-amber-400">
                  Arkistoi uusi →
                </button>
              </div>
              {docs.length === 0 && (
                <p className="text-gray-500 text-sm py-2 text-center">
                  Tarjouspyynnöt, aloituspalaverit, päätökset ja sopimukset arkistoidaan Arkiston +-napista tälle työmaalle — ne näkyvät sitten tässä ja PDF-kansiossa.
                </p>
              )}
              {docs.map((d) => (
                <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{d.otsikko}</p>
                    <p className="text-xs text-gray-500">{DOC_TYPE_LABEL[d.tyyppi] ?? d.tyyppi} · {formatDate(d.created_at)} · {d.user_name}</p>
                    {d.tags.length > 0 && (
                      <p className="text-[11px] text-amber-500/80 mt-0.5 flex items-center gap-1 flex-wrap"><Tag className="w-3 h-3" /> {d.tags.join(', ')}</p>
                    )}
                  </div>
                  {d.file_path && (
                    <button onClick={() => openFile(d.file_path!)} aria-label="Avaa liite" className="p-3 text-amber-400 shrink-0"><ExternalLink className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </section>

            {/* Kuvaraportti: "mikä tämä työ muka on?" -tilanteen vastaus */}
            <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> Kuvaraportti ({docs.filter((d) => d.tyyppi === 'kuva' && d.file_path).length} kuvaa pilvessä)
              </h2>
              <div className="grid grid-cols-3 gap-1.5">
                {([[7, '7 pv'], [30, '30 pv'], [0, 'Kaikki']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setKuvaRange(v)}
                    className={`py-2.5 rounded-xl text-xs font-semibold ${kuvaRange === v ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={makeKuvaraportti} disabled={kuvaBusy}
                className="w-full py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold text-amber-300 flex items-center justify-center gap-2 disabled:opacity-40">
                <FileText className="w-4 h-4" /> {kuvaBusy ? 'Kootaan kuvia pilvestä…' : 'Luo kuvaraportti (PDF)'}
              </button>
              <p className="text-[11px] text-gray-600">
                Kokoaa valitun aikavälin todistekuvat aikaleimoineen ja kuvaajineen yhdeksi PDF:ksi — puhelimella aukeaa suoraan jakovalikko, josta se lähtee sähköpostiin.
              </p>
            </section>

            <p className="text-[11px] text-gray-600 text-center">
              Tulostinkuvake lataa koko kansion PDF-luovutusaineistona — tuotteet väreineen ja erineen + dokumenttiluettelo.
            </p>
          </>
        )}
      </main>

      {/* Kirjaa tuote */}
      {addOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Kirjaa tuote kansioon</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {KATEGORIAT.map((k) => (
                <button key={k} onClick={() => setF({ ...f, kategoria: k })}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${f.kategoria === k ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {k}
                </button>
              ))}
            </div>

            <input type="text" value={f.tuote} onChange={(e) => setF({ ...f, tuote: e.target.value })}
              placeholder="Tuote * (esim. Tarkett iQ Granit)" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={f.vari} onChange={(e) => setF({ ...f, vari: e.target.value })} placeholder="Väri (esim. Harmaa 429)" className={inputCls} />
              <input type="text" value={f.koodi} onChange={(e) => setF({ ...f, koodi: e.target.value })} placeholder="Malli/koodi" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={f.era} onChange={(e) => setF({ ...f, era: e.target.value })} placeholder="Eränumero" className={inputCls} />
              <input type="text" value={f.maara} onChange={(e) => setF({ ...f, maara: e.target.value })} placeholder="Määrä (esim. 120 m²)" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={f.toimittaja} onChange={(e) => setF({ ...f, toimittaja: e.target.value })} placeholder="Toimittaja" className={inputCls} />
              <input type="date" value={f.toimitettu} onChange={(e) => setF({ ...f, toimitettu: e.target.value })} className={inputCls} />
            </div>
            <input type="text" value={f.sijainti} onChange={(e) => setF({ ...f, sijainti: e.target.value })}
              placeholder="Sijainti (esim. 2. krs käytävät + porras A)" className={inputCls} />
            <textarea value={f.lisatiedot} onChange={(e) => setF({ ...f, lisatiedot: e.target.value })} rows={2}
              placeholder="Lisätiedot (asennussuunta, kuviokohdistus…)" className={`${inputCls} resize-none`} />

            <button onClick={saveProd} disabled={!f.tuote.trim() || saving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Tallennetaan…' : 'Tallenna kansioon'}
            </button>
            <p className="text-[11px] text-gray-600">Väri ja eränumero ovat ne tiedot joita takuukorjauksessa etsitään — kirjaa ne aina kun ne on saatavilla.</p>
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
