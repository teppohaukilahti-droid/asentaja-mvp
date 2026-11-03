// Varastohaku: pikanapit + hyllynreuna-QR:t. Kirjaus: tuote → määrä → työmaa → valmis.
// Jokainen haku menee työnjohtajan laskutettavaan pinoon.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, PackageOpen, X, Check, Plus, Printer, RefreshCw, Delete, Undo2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { parseNum } from '../lib/helpers'
import { insertOrQueue } from '../lib/offline'
import { SALDO_LABEL, SALDO_STYLE, matchesProduct } from '../lib/varasto'
import type { SaldoTila } from '../lib/varasto'

type Product = {
  id: string; name: string; unit: string; qr_token: string; active: boolean
  koodi: string | null; hyllypaikka: string | null; saldo_tila: SaldoTila
}
type WsRow = { id: string; name: string }
type Pickup = {
  id: string; product_name: string; maara: number; unit: string; suunta: string
  user_name: string | null; created_at: string; worksites: { name: string } | null
}

const QUICK_AMOUNTS = ['1', '2', '3', '4', '5', '10']

export default function VarastohakuPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const canManage = ['varasto', 'tyonjohtaja', 'johtaja'].includes(profile?.role ?? '')

  const [products, setProducts] = useState<Product[]>([])
  const [worksites, setWorksites] = useState<WsRow[]>([])
  const [recent, setRecent] = useState<Pickup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [product, setProduct] = useState<Product | null>(null)
  const [maara, setMaara] = useState('')
  const [wsId, setWsId] = useState<string | null>(null)
  const [suunta, setSuunta] = useState<'otto' | 'palautus'>('otto')
  const [saving, setSaving] = useState(false)
  const [qrHandled, setQrHandled] = useState(false)

  const [haku, setHaku] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKoodi, setNewKoodi] = useState('')
  const [newHylly, setNewHylly] = useState('')
  const [newUnit, setNewUnit] = useState('kpl')
  const [creating, setCreating] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const [prodRes, wsRes, recentRes] = await Promise.all([
      supabase.from('products').select('id, name, unit, qr_token, active, koodi, hyllypaikka, saldo_tila').eq('active', true).order('name'),
      supabase.from('worksites').select('id, name').eq('status', 'active').order('name'),
      supabase.from('material_pickups')
        .select('id, product_name, maara, unit, suunta, user_name, created_at, worksites(name)')
        .order('created_at', { ascending: false }).limit(15),
    ])
    if (prodRes.error || wsRes.error) {
      setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setProducts((prodRes.data ?? []) as Product[])
      setWorksites(wsRes.data ?? [])
      setRecent((recentRes.data ?? []) as unknown as Pickup[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Hyllynreuna-QR: skannaus esivalitsee tuotteen
  useEffect(() => {
    const qr = params.get('qr')
    if (!qr || qrHandled || products.length === 0) return
    const p = products.find((x) => x.qr_token === qr)
    if (p) { setProduct(p); setQrHandled(true) }
  }, [products, params, qrHandled])

  const maaraNum = parseNum(maara)
  const maaraValid = Number.isFinite(maaraNum) && maaraNum > 0

  async function save() {
    if (!user || !profile || !product || !maaraValid || !wsId || saving) return
    setSaving(true)
    const result = await insertOrQueue('material_pickups', {
      organization_id: profile.organization_id,
      product_id: product.id, product_name: product.name,
      maara: maaraNum, unit: product.unit,
      worksite_id: wsId, user_id: user.id, user_name: profile.full_name ?? '',
      suunta,
    })
    if (result === 'queued') {
      setToast(`${product.name} tallennettu — lähetetään kun verkko palaa`)
      setProduct(null); setMaara(''); setWsId(null); setSuunta('otto')
    } else {
      // Päivitä työmaan materiaalisaldo näkyviin työmaasivulle
      const { data: mat } = await supabase.from('materials').select('id, balance').eq('worksite_id', wsId).eq('name', product.name).maybeSingle()
      const delta = suunta === 'otto' ? maaraNum : -maaraNum
      if (mat) {
        await supabase.from('materials').update({ balance: Math.max(0, Number(mat.balance ?? 0) + delta) }).eq('id', mat.id)
      } else if (suunta === 'otto') {
        await supabase.from('materials').insert({ worksite_id: wsId, name: product.name, balance: maaraNum, unit: product.unit })
      }
      const wsName = worksites.find((w) => w.id === wsId)?.name ?? ''
      setToast(suunta === 'otto'
        ? `${product.name} ${maara} ${product.unit} → ${wsName}`
        : `${product.name} ${maara} ${product.unit} palautettu varastoon`)
      setProduct(null); setMaara(''); setWsId(null); setSuunta('otto')
      fetchAll()
    }
    setSaving(false)
  }

  async function createProduct() {
    if (!profile || !newName.trim() || creating) return
    setCreating(true)
    const { error: insErr } = await supabase.from('products').insert({
      organization_id: profile.organization_id, name: newName.trim(), unit: newUnit,
      koodi: newKoodi.trim() || null, hyllypaikka: newHylly.trim() || null,
    })
    if (insErr) setToast('Tuotteen luonti epäonnistui (nimi jo käytössä?)')
    else { setToast(`${newName.trim()} lisätty`); setNewName(''); setNewKoodi(''); setNewHylly(''); setNewOpen(false); fetchAll() }
    setCreating(false)
  }

  // Hyllynreunatarrat: isot QR:t A4:lle (2 × 4 per sivu)
  async function printQrSheet() {
    if (printing || products.length === 0) return
    setPrinting(true)
    try {
      const [{ default: jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')])
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const cols = 2, rows = 4, cw = 95, ch = 68, mx = 10, my = 12
      for (let i = 0; i < products.length; i++) {
        const p = products[i]
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
      doc.save('FloorData_hyllytarrat.pdf')
      setToast('Hyllytarrat ladattu')
    } catch {
      setToast('Tarra-arkin luonti epäonnistui')
    }
    setPrinting(false)
  }

  function press(k: string) {
    if (k === 'back') { setMaara((v) => v.slice(0, -1)); return }
    if (k === ',') { setMaara((v) => (v.includes(',') || v === '' ? v : v + ',')); return }
    setMaara((v) => (v.length >= 6 ? v : v + k))
  }

  const recentByMe = useMemo(() => recent, [recent])

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <PackageOpen className="w-4 h-4 text-amber-500" /> Varastohaku
        </h1>
        <div className="ml-auto flex items-center">
          {canManage && (
            <>
              <button onClick={printQrSheet} disabled={printing} aria-label="Tulosta hyllytarrat" title="Tulosta hyllytarrat" className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                <Printer className="w-5 h-5" />
              </button>
              <button onClick={() => setNewOpen(true)} aria-label="Uusi tuote" className="p-3 text-amber-400">
                <Plus className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md mx-auto space-y-5">
        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mitä otat mukaan?</p>
              <input type="text" value={haku} onChange={(e) => setHaku(e.target.value)}
                placeholder="Onko meillä…? Hae koodilla tai nimellä" className={inputCls} />
              <div className="grid grid-cols-2 gap-2">
                {(haku.trim() ? products.filter((p) => matchesProduct(p, haku)) : products).map((p) => (
                  <button key={p.id} onClick={() => setProduct(p)}
                    className="min-h-16 p-3 rounded-2xl bg-gray-900 border border-gray-800 text-left hover:border-gray-700 active:scale-95 transition-all">
                    <span className="block text-sm font-bold leading-tight">{p.name}</span>
                    <span className="block text-[11px] text-gray-500 mt-0.5">
                      {p.koodi ? `${p.koodi} · ` : ''}{p.hyllypaikka ? `hylly ${p.hyllypaikka} · ` : ''}{p.unit}
                    </span>
                    <span className={`inline-block mt-1.5 text-[10px] font-bold border rounded-full px-2 py-0.5 ${SALDO_STYLE[p.saldo_tila]}`}>
                      {SALDO_LABEL[p.saldo_tila]}
                    </span>
                  </button>
                ))}
              </div>
              {haku.trim() && products.filter((p) => matchesProduct(p, haku)).length === 0 && (
                <p className="text-gray-500 text-sm text-center py-2">Ei osumia haulle ”{haku.trim()}”.</p>
              )}
              {products.length === 0 && (
                <p className="text-gray-500 text-sm">Ei tuotteita katalogissa{canManage ? ' — lisää +-napista' : ''}.</p>
              )}
            </section>

            {recentByMe.length > 0 && (
              <section className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Viimeisimmät haut</p>
                {recentByMe.map((r) => (
                  <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        {r.suunta === 'palautus' && <Undo2 className="w-3.5 h-3.5 inline mr-1 text-blue-300" />}
                        {r.product_name} {String(r.maara).replace('.', ',')} {r.unit}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{r.worksites?.name ?? ''} · {r.user_name ?? ''}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {/* Kirjaus: määrä + työmaa */}
      {product && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => { setProduct(null); setMaara(''); setWsId(null) }}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-4 pb-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{product.name}</h3>
              <button onClick={() => { setProduct(null); setMaara(''); setWsId(null) }} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSuunta('otto')}
                className={`py-2.5 rounded-xl text-sm font-semibold ${suunta === 'otto' ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Otan varastolta
              </button>
              <button onClick={() => setSuunta('palautus')}
                className={`py-2.5 rounded-xl text-sm font-semibold ${suunta === 'palautus' ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Palautan varastoon
              </button>
            </div>

            <div className="flex items-baseline justify-between bg-gray-800 rounded-2xl px-4 py-3">
              <span className="text-3xl font-bold tabular-nums">
                {maara || '0'}<span className="text-base font-semibold text-gray-400 ml-1.5">{product.unit}</span>
              </span>
            </div>
            <div className="flex gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button key={q} onClick={() => setMaara(q)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${maara === q ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {q}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', 'back'].map((k) => (
                <button key={k} onClick={() => press(k)}
                  className="h-11 rounded-xl bg-gray-800 text-lg font-bold flex items-center justify-center active:bg-gray-700 transition-colors">
                  {k === 'back' ? <Delete className="w-5 h-5" /> : k}
                </button>
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-500">{suunta === 'otto' ? 'Mille työmaalle?' : 'Miltä työmaalta palautuu?'}</p>
            <div className="grid grid-cols-1 gap-1.5 max-h-[22vh] overflow-y-auto">
              {worksites.map((w) => (
                <button key={w.id} onClick={() => setWsId(w.id)}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold text-left ${wsId === w.id ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {w.name}
                </button>
              ))}
            </div>

            <button onClick={save} disabled={!maaraValid || !wsId || saving}
              className="w-full h-14 rounded-2xl bg-amber-500 text-gray-950 text-base font-bold disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-5 h-5" /> {saving ? 'Kirjataan…' : suunta === 'otto' ? 'Kirjaa haku' : 'Kirjaa palautus'}
            </button>
            {suunta === 'otto' && (
              <p className="text-[11px] text-gray-600 text-center">Haku kirjautuu nimelläsi ja menee työnjohtajan laskutettavaan pinoon.</p>
            )}
          </div>
        </div>
      )}

      {/* Uusi tuote */}
      {newOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setNewOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Uusi tuote katalogiin</h3>
              <button onClick={() => setNewOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tuotteen nimi (esim. Mattoliima X400)" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newKoodi} onChange={(e) => setNewKoodi(e.target.value)} placeholder="Koodi (JL60 412)" className={inputCls} />
              <input type="text" value={newHylly} onChange={(e) => setNewHylly(e.target.value)} placeholder="Hyllypaikka (A3)" className={inputCls} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['kpl', 'astia', 'säkki', 'rulla', 'nippu', 'patruuna', 'l', 'kg'].map((u) => (
                <button key={u} onClick={() => setNewUnit(u)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${newUnit === u ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {u}
                </button>
              ))}
            </div>
            <button onClick={createProduct} disabled={!newName.trim() || creating}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {creating ? 'Lisätään…' : 'Lisää tuote'}
            </button>
            <p className="text-xs text-gray-500">Muista tulostaa uusi hyllytarra-arkki tulostinnapista.</p>
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
