import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, FileSignature, Plus, Trash2, RefreshCw, Lock, Download, X, Check, Import,
  QrCode, Smartphone, Copy as CopyIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { today, toInput, formatDate } from '../lib/helpers'
import { downloadMittausPdf, sha256 } from '../lib/mittausPdf'
import type { MRow } from '../lib/mittausPdf'
import SignatureCanvas from '../components/SignatureCanvas'

type Poytakirja = {
  id: string
  numero: number
  worksite_id: string
  period_start: string | null
  period_end: string | null
  tyokohde: string | null
  osoite: string | null
  laskutus: string | null
  huom: string | null
  tyontekijat: string | null
  rows: MRow[]
  status: 'luonnos' | 'lukittu'
  mestari_nimi: string | null
  signature_png: string | null
  signed_at: string | null
  content_hash: string | null
  signed_on_device?: string
}

const emptyRow = (): MRow => ({
  tuote: '', tila: 'ht', huone: '', mitat: '', kpl: '',
  itselleluovutus: false, primer: false, tasoitus: false, hionta: false,
  suojaus: false, siivous: false, hammaslasta: false,
})

const CHECKS: { key: keyof MRow; label: string }[] = [
  { key: 'primer', label: 'Primer' },
  { key: 'tasoitus', label: 'Tasoitus' },
  { key: 'hionta', label: 'Hionta+imur.' },
  { key: 'suojaus', label: 'Suojaus' },
  { key: 'siivous', label: 'Siivous' },
  { key: 'hammaslasta', label: 'H-lasta' },
  { key: 'itselleluovutus', label: 'Itselleluovutus' },
]

export default function MittausPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const worksiteId = params.get('tyomaa')

  const [list, setList] = useState<Poytakirja[]>([])
  const [site, setSite] = useState<{ name: string; address: string | null; client_company: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [editing, setEditing] = useState<Poytakirja | null>(null)
  const [viewing, setViewing] = useState<Poytakirja | null>(null)
  const [saving, setSaving] = useState(false)

  // hyväksyntä
  const [signMode, setSignMode] = useState<null | 'valinta' | 'qr' | 'laite'>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLink, setQrLink] = useState<string | null>(null)
  const [mestariNimi, setMestariNimi] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const fetchAll = useCallback(async () => {
    if (!worksiteId) return
    setLoading(true)
    setError(null)
    const [siteRes, listRes] = await Promise.all([
      supabase.from('worksites').select('name, address, client_company').eq('id', worksiteId).single(),
      supabase.from('mittapoytakirjat').select('*').eq('worksite_id', worksiteId).order('created_at', { ascending: false }),
    ])
    if (siteRes.error || listRes.error) {
      setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setSite(siteRes.data)
      setList((listRes.data ?? []) as Poytakirja[])
    }
    setLoading(false)
  }, [worksiteId])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function newDraft() {
    const start = new Date(); start.setDate(start.getDate() - 21)
    // Esitäytä työntekijät urakkaporukan nimillä (palkanjaon imuroinnit tältä työmaalta)
    const names: string[] = [profile?.full_name ?? '']
    if (worksiteId && user) {
      const { data: shares } = await supabase
        .from('pay_shares')
        .select('pay_share_claims(user_name)')
        .eq('worksite_id', worksiteId)
        .eq('owner_id', user.id)
      shares?.forEach((s) => {
        const claims = s.pay_share_claims as unknown as { user_name: string | null }[] | null
        claims?.forEach((c) => { if (c.user_name && !names.includes(c.user_name)) names.push(c.user_name) })
      })
    }
    setEditing({
      id: '', numero: 0, worksite_id: worksiteId ?? '',
      period_start: toInput(start), period_end: today(),
      tyokohde: site?.name ?? '', osoite: site?.address ?? '', laskutus: site?.client_company ?? '',
      huom: '', tyontekijat: names.filter(Boolean).join(', '),
      rows: [emptyRow()], status: 'luonnos',
      mestari_nimi: null, signature_png: null, signed_at: null, content_hash: null,
    })
  }

  async function importFromEntries() {
    if (!editing || !user || !worksiteId) return
    // Varmista että luonnoksella on id, jotta kirjaukset voidaan kytkeä siihen
    let draftId = editing.id
    let draftNumero = editing.numero
    if (!draftId) {
      const saved = await saveDraft(true)
      if (!saved?.id) return
      draftId = saved.id
      draftNumero = saved.numero
    }
    let q = supabase.from('entries')
      .select('id, entry_type, amount, hours, description, mittapoytakirja_id, tes_codes(code, description, unit)')
      .eq('worksite_id', worksiteId).eq('user_id', user.id)
      .or(`mittapoytakirja_id.is.null,mittapoytakirja_id.eq.${draftId}`)
    if (editing.period_start) q = q.gte('entry_date', editing.period_start)
    if (editing.period_end) q = q.lte('entry_date', editing.period_end)
    const { data } = await q
    if (!data || data.length === 0) { setToast('Ei vapaita kirjauksia valitulla aikavälillä'); return }
    const grouped = new Map<string, { tuote: string; sum: number; unit: string }>()
    data.forEach((e) => {
      const tes = e.tes_codes as unknown as { code: string; description: string; unit: string } | null
      if (e.entry_type === 'tunti') {
        const key = 'tunti:' + (e.description ?? 'Tuntityöt').split(':')[0]
        const g = grouped.get(key) ?? { tuote: (e.description ?? 'Tuntityöt').split(':')[0], sum: 0, unit: 'h' }
        g.sum += Number(e.hours ?? 0)
        grouped.set(key, g)
      } else {
        const name = tes ? tes.description : (e.description ?? 'Urakkatyö')
        const key = 'u:' + name
        const g = grouped.get(key) ?? { tuote: name, sum: 0, unit: tes?.unit ?? 'm²' }
        g.sum += Number(e.amount ?? 0)
        grouped.set(key, g)
      }
    })
    const rows: MRow[] = [...grouped.values()].map((g) => ({
      ...emptyRow(),
      tuote: g.tuote,
      mitat: `${String(Math.round(g.sum * 100) / 100).replace('.', ',')} ${g.unit}`,
    }))
    // Kytke tuodut kirjaukset tähän pöytäkirjaan (vanhat linkit ensin irti)
    await supabase.from('entries').update({ mittapoytakirja_id: null }).eq('mittapoytakirja_id', draftId)
    const entryIds = data.map((e) => e.id)
    const { error: linkError } = await supabase.from('entries').update({ mittapoytakirja_id: draftId }).in('id', entryIds)
    setEditing({ ...editing, id: draftId, numero: draftNumero, rows })
    if (linkError) {
      setToast(`${rows.length} riviä haettu — kirjausten kytkentä epäonnistui`)
    } else {
      setToast(`${rows.length} riviä haettu, ${entryIds.length} kirjausta kytketty pöytäkirjaan`)
    }
  }

  async function saveDraft(keepOpen?: boolean): Promise<Poytakirja | null> {
    if (!editing || !user || !profile) return null
    setSaving(true)
    const payload = {
      organization_id: profile.organization_id,
      worksite_id: editing.worksite_id,
      created_by: user.id,
      period_start: editing.period_start,
      period_end: editing.period_end,
      tyokohde: editing.tyokohde,
      osoite: editing.osoite,
      laskutus: editing.laskutus,
      huom: editing.huom,
      tyontekijat: editing.tyontekijat,
      rows: editing.rows as unknown as object,
    }
    let result: Poytakirja | null = null
    if (editing.id) {
      const { error } = await supabase.from('mittapoytakirjat').update(payload).eq('id', editing.id)
      if (!error) { result = editing; setToast('Luonnos tallennettu') }
      else setToast('Tallennus epäonnistui')
    } else {
      const { data, error } = await supabase.from('mittapoytakirjat').insert(payload).select('*').single()
      if (!error && data) {
        result = data as Poytakirja
        setToast(`Luonnos tallennettu (nro ${result.numero})`)
      } else setToast('Tallennus epäonnistui')
    }
    setSaving(false)
    if (result) {
      if (keepOpen) setEditing({ ...editing, id: result.id, numero: result.numero })
      else setEditing(null)
      fetchAll()
    }
    return result
  }

  async function startQrApproval() {
    if (!editing) return
    let current = editing
    if (!current.id) {
      const saved = await saveDraft(true)
      if (!saved) return
      current = { ...editing, id: saved.id, numero: saved.numero }
    } else {
      await saveDraft(true)
    }
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('mittapoytakirjat')
      .update({ approval_token: token, token_expires_at: expires })
      .eq('id', current.id)
    if (error) { setToast('QR-koodin luonti epäonnistui'); return }
    const link = `${window.location.origin}/hyvaksy?token=${token}`
    setQrLink(link)
    const { default: QRCode } = await import('qrcode') // ladataan vasta tarvittaessa
    setQrDataUrl(await QRCode.toDataURL(link, { margin: 1, width: 480 }))
    setSignMode('qr')
    // Odota mestarin hyväksyntää
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.from('mittapoytakirjat').select('status, numero').eq('id', current.id).single()
      if (data?.status === 'lukittu') {
        if (pollRef.current) clearInterval(pollRef.current)
        setSignMode(null)
        setQrDataUrl(null)
        setEditing(null)
        setToast(`Mestari hyväksyi — pöytäkirja ${data.numero} lukittu!`)
        fetchAll()
      }
    }, 4000)
  }

  async function lockAndSignOnDevice() {
    if (!editing || !editing.id || !signature || !mestariNimi.trim()) return
    setLocking(true)
    const hashInput = JSON.stringify({
      numero: editing.numero, tyokohde: editing.tyokohde,
      period: [editing.period_start, editing.period_end], rows: editing.rows,
      tyontekijat: editing.tyontekijat, mestari: mestariNimi.trim(), sig: signature,
    })
    const hash = await sha256(hashInput)
    const { error } = await supabase.from('mittapoytakirjat').update({
      period_start: editing.period_start, period_end: editing.period_end,
      tyokohde: editing.tyokohde, osoite: editing.osoite, laskutus: editing.laskutus,
      huom: editing.huom, tyontekijat: editing.tyontekijat, rows: editing.rows as unknown as object,
      status: 'lukittu', mestari_nimi: mestariNimi.trim(), signature_png: signature,
      signed_at: new Date().toISOString(), content_hash: hash, signed_on_device: 'asentaja',
    }).eq('id', editing.id)
    if (error) {
      setToast('Lukitus epäonnistui')
    } else {
      setToast(`Mittauspöytäkirja ${editing.numero} allekirjoitettu ja lukittu`)
      setSignMode(null)
      setEditing(null)
      setSignature(null)
      setMestariNimi('')
      fetchAll()
    }
    setLocking(false)
  }

  async function deleteDraft(id: string) {
    if (!confirm('Poistetaanko luonnos?')) return
    const { error } = await supabase.from('mittapoytakirjat').delete().eq('id', id)
    if (!error) { setToast('Luonnos poistettu'); fetchAll() }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  function updateRow(i: number, patch: Partial<MRow>) {
    if (!editing) return
    setEditing({ ...editing, rows: editing.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => (editing ? setEditing(null) : viewing ? setViewing(null) : navigate(worksiteId ? `/tyomaa/${worksiteId}` : '/'))} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2 min-w-0">
          <FileSignature className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">Mittauspöytäkirjat{site ? ` · ${site.name}` : ''}</span>
        </h1>
      </header>

      {loading && <div className="px-4 py-5"><div className="bg-gray-900 rounded-2xl h-32 animate-pulse" /></div>}

      {error && (
        <div className="m-4 bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
        </div>
      )}

      {/* ===== LISTA ===== */}
      {!loading && !error && !editing && !viewing && (
        <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-3">
          <button onClick={newDraft} className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl">
            <Plus className="w-5 h-5" /> Uusi mittauspöytäkirja
          </button>
          {list.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Ei mittauspöytäkirjoja tällä työmaalla.</p>}
          {list.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => (p.status === 'lukittu' ? setViewing(p) : setEditing(p))} className="min-w-0 text-left flex-1">
                  <p className="font-semibold text-sm">Nro {p.numero}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.period_start ? formatDate(p.period_start) : ''} – {p.period_end ? formatDate(p.period_end) : ''} · {p.rows.length} riviä
                  </p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {p.status === 'lukittu' ? (
                    <>
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                        <Lock className="w-3 h-3" /> Lukittu
                      </span>
                      <button onClick={() => downloadMittausPdf(p)} aria-label="Lataa PDF" className="p-3 text-gray-400 hover:text-white"><Download className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">Luonnos</span>
                      <button onClick={() => deleteDraft(p.id)} aria-label="Poista" className="p-3 text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </main>
      )}

      {/* ===== LUKITUN KATSELU ===== */}
      {viewing && (
        <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-4">
          <div className="bg-gray-900 border border-green-900 rounded-2xl p-4">
            <p className="flex items-center gap-2 font-semibold"><Lock className="w-4 h-4 text-green-400" /> Nro {viewing.numero} · Lukittu</p>
            <p className="text-xs text-gray-500 mt-1">{viewing.period_start ? formatDate(viewing.period_start) : ''} – {viewing.period_end ? formatDate(viewing.period_end) : ''}</p>
            <p className="text-sm mt-2">{viewing.tyokohde}</p>
            {viewing.osoite && <p className="text-xs text-gray-500">{viewing.osoite}</p>}
            <p className="text-xs text-gray-500 mt-2">
              {viewing.signed_on_device === 'mestari' ? '✓ Hyväksytty mestarin omalla laitteella' : 'Allekirjoitettu työntekijän laitteella'}
            </p>
          </div>
          <div className="space-y-1.5">
            {viewing.rows.map((r, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                <p className="text-sm font-medium">{r.tuote} <span className="text-gray-500">({r.tila})</span></p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.huone && `${r.huone} · `}{r.mitat}{r.kpl && ` · ${r.kpl} kpl`}
                  {CHECKS.filter((c) => r[c.key]).map((c) => ` · ${c.label}`).join('')}
                </p>
              </div>
            ))}
          </div>
          {viewing.huom && <p className="text-sm text-gray-400">Huom! {viewing.huom}</p>}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500">Työntekijät</p>
            <p className="text-sm">{viewing.tyontekijat}</p>
            <p className="text-xs text-gray-500 mt-3">Mestari · {viewing.signed_at ? formatDate(viewing.signed_at.slice(0, 10)) : ''}</p>
            <p className="text-sm">{viewing.mestari_nimi}</p>
            {viewing.signature_png && (
              <img src={viewing.signature_png} alt="Allekirjoitus" className="mt-2 bg-white rounded-lg h-20" />
            )}
            <p className="text-[10px] text-gray-600 mt-3 break-all">Eheystiiviste: {viewing.content_hash}</p>
          </div>
          <button onClick={() => downloadMittausPdf(viewing)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl">
            <Download className="w-4 h-4" /> Lataa PDF
          </button>
        </main>
      )}

      {/* ===== EDITORI ===== */}
      {editing && (
        <main className="px-4 py-5 pb-24 max-w-md mx-auto space-y-4">
          {editing.numero > 0 && <p className="text-sm text-gray-400">Luonnos · Nro {editing.numero}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alkupäivä</label>
              <input type="date" value={editing.period_start ?? ''} onChange={(e) => setEditing({ ...editing, period_start: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Loppupäivä</label>
              <input type="date" value={editing.period_end ?? ''} onChange={(e) => setEditing({ ...editing, period_end: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
            </div>
          </div>
          <input type="text" placeholder="Työkohde" value={editing.tyokohde ?? ''} onChange={(e) => setEditing({ ...editing, tyokohde: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Osoite" value={editing.osoite ?? ''} onChange={(e) => setEditing({ ...editing, osoite: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Laskutus" value={editing.laskutus ?? ''} onChange={(e) => setEditing({ ...editing, laskutus: e.target.value })} className={inputCls} />

          <button onClick={importFromEntries} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-700">
            <Import className="w-4 h-4 text-amber-400" /> Hae rivit kirjauksista ({editing.period_start ? formatDate(editing.period_start) : ''} – {editing.period_end ? formatDate(editing.period_end) : ''})
          </button>

          <div className="space-y-3">
            {editing.rows.map((r, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Tuote / työ" value={r.tuote} onChange={(e) => updateRow(i, { tuote: e.target.value })} className={inputCls} />
                  <button onClick={() => setEditing({ ...editing, rows: editing.rows.filter((_, j) => j !== i) })} aria-label="Poista rivi" className="p-3 text-gray-600 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex gap-1">
                    {(['ht', 'kt', 'lab'] as const).map((t) => (
                      <button key={t} onClick={() => updateRow(i, { tila: t })} className={`flex-1 py-2 rounded-lg text-xs font-bold ${r.tila === t ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>{t}</button>
                    ))}
                  </div>
                  <input type="text" placeholder="Huone" value={r.huone} onChange={(e) => updateRow(i, { huone: e.target.value })} className={inputCls} />
                  <input type="text" placeholder="Mitat / KPL" value={r.mitat} onChange={(e) => updateRow(i, { mitat: e.target.value })} className={inputCls} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CHECKS.map((c) => (
                    <button key={c.key} onClick={() => updateRow(i, { [c.key]: !r[c.key] } as Partial<MRow>)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${r[c.key] ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-500'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setEditing({ ...editing, rows: [...editing.rows, emptyRow()] })} className="w-full py-2.5 border-2 border-dashed border-gray-700 rounded-xl text-sm text-gray-400 hover:border-gray-500">
              + Lisää rivi
            </button>
          </div>

          <input type="text" placeholder="Huom!" value={editing.huom ?? ''} onChange={(e) => setEditing({ ...editing, huom: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Työntekijät" value={editing.tyontekijat ?? ''} onChange={(e) => setEditing({ ...editing, tyontekijat: e.target.value })} className={inputCls} />

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => saveDraft()} disabled={saving} className="py-3.5 bg-gray-800 border border-gray-700 font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Tallennetaan…' : 'Tallenna luonnos'}
            </button>
            <button onClick={() => setSignMode('valinta')} className="flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl">
              <FileSignature className="w-4 h-4" /> Hyväksyntä
            </button>
          </div>
        </main>
      )}

      {/* ===== HYVÄKSYNTÄTAVAN VALINTA ===== */}
      {signMode === 'valinta' && editing && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setSignMode(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /> Mestarin hyväksyntä</h3>
              <button onClick={() => setSignMode(null)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <button onClick={startQrApproval} className="w-full flex items-center gap-3 p-4 bg-amber-500 text-gray-950 rounded-2xl text-left">
              <QrCode className="w-8 h-8 shrink-0" />
              <span>
                <span className="block font-bold">Mestari hyväksyy omalla puhelimellaan</span>
                <span className="block text-sm opacity-80">Suositus — mestari skannaa QR-koodin, tarkistaa ja allekirjoittaa omalla laitteellaan</span>
              </span>
            </button>
            <button onClick={async () => { if (!editing.id) await saveDraft(true); setSignMode('laite') }} className="w-full flex items-center gap-3 p-4 bg-gray-800 border border-gray-700 rounded-2xl text-left">
              <Smartphone className="w-7 h-7 shrink-0 text-gray-400" />
              <span>
                <span className="block font-semibold">Allekirjoitus tällä laitteella</span>
                <span className="block text-sm text-gray-400">Varatapa — pöytäkirjaan merkitään, että allekirjoitus tehtiin työntekijän laitteella</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ===== QR-NÄKYMÄ ===== */}
      {signMode === 'qr' && qrDataUrl && (
        <div className="fixed inset-0 z-30 bg-black/90 flex items-center justify-center p-6" onClick={() => { setSignMode(null); if (pollRef.current) clearInterval(pollRef.current) }}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Anna mestarin skannata</h3>
            <img src={qrDataUrl} alt="QR-koodi" className="w-full rounded-2xl bg-white p-3" />
            <p className="text-sm text-gray-400">
              Mestari avaa pöytäkirjan omalla puhelimellaan, tarkistaa rivit ja allekirjoittaa.
              Tämä näkymä sulkeutuu automaattisesti kun hyväksyntä on tehty.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Odotetaan hyväksyntää…
            </div>
            <button onClick={() => { if (qrLink) { navigator.clipboard?.writeText(qrLink); setToast('Linkki kopioitu — voit lähettää sen mestarille viestillä') } }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 rounded-xl text-sm text-gray-300">
              <CopyIcon className="w-4 h-4" /> Kopioi linkki (esim. tekstiviestiin)
            </button>
            <button onClick={async () => {
              if (!editing?.id || !profile) return
              // Pidennä linkin voimassaolo viikoksi ja siirrä työnjohdon hoidettavaksi
              await supabase.from('mittapoytakirjat').update({
                eskaloitu: true, eskaloitu_at: new Date().toISOString(),
                eskaloija: profile.full_name ?? '',
                token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              }).eq('id', editing.id)
              if (pollRef.current) clearInterval(pollRef.current)
              setSignMode(null); setQrDataUrl(null); setEditing(null)
              setToast('Siirretty työnjohdolle — he toimittavat linkin mestarille')
              fetchAll()
            }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 border border-amber-500/40 rounded-xl text-sm font-semibold text-amber-300">
              Mestari ei ollut paikalla — siirrä työnjohdolle
            </button>
            <p className="text-[11px] text-gray-600">Linkki on kertakäyttöinen ja voimassa 24 tuntia. Siirrossa työnjohdolle voimassaolo pitenee viikkoon.</p>
          </div>
        </div>
      )}

      {/* ===== LAITE-ALLEKIRJOITUS (VARATAPA) ===== */}
      {signMode === 'laite' && editing && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setSignMode(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /> Allekirjoitus tällä laitteella</h3>
              <button onClick={() => setSignMode(null)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-900 rounded-xl p-3">
              Allekirjoituksen jälkeen pöytäkirja <strong>lukitaan pysyvästi</strong>. Pöytäkirjaan merkitään, että allekirjoitus tehtiin työntekijän laitteella.
            </p>
            <input type="text" placeholder="Nimenselvennys (mestari)" value={mestariNimi} onChange={(e) => setMestariNimi(e.target.value)} className={inputCls} />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Allekirjoitus sormella tai kynällä:</p>
              <SignatureCanvas onChange={setSignature} />
            </div>
            <button onClick={lockAndSignOnDevice} disabled={locking || !signature || !mestariNimi.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40">
              <Check className="w-4 h-4" /> {locking ? 'Lukitaan…' : 'Allekirjoita ja lukitse'}
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
