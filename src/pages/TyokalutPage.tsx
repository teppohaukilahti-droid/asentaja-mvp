// Työkaluseuranta: rekisteri, siirrot skannaa-ja-siirrä-periaatteella, QR-tarrat
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Wrench, Search, X, Check, Plus, Printer, RefreshCw,
  Warehouse, HardHat, Building2, AlertTriangle, History, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'
import {
  TOOL_STATUS_LABEL, TOOL_STATUS_STYLE, COMMON_TOOL_NAMES,
  toolLabel, toolLocation, toolTimeAgo,
} from '../lib/tools'
import type { Tool, ToolEvent } from '../lib/tools'
import AlaNav from '../components/AlaNav'

type WsRow = { id: string; name: string }
type FilterKey = 'kaikki' | 'varastossa' | 'tyomaalla' | 'asentajalla' | 'huollossa' | 'kadonnut'

export default function TyokalutPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const canCreate = ['varasto', 'tyonjohtaja', 'johtaja'].includes(profile?.role ?? '')
  const canFix = canCreate

  const [tools, setTools] = useState<Tool[]>([])
  const [worksites, setWorksites] = useState<WsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [filter, setFilter] = useState<FilterKey>('kaikki')
  const [search, setSearch] = useState('')
  const [onlyMine, setOnlyMine] = useState(params.get('omat') === '1')
  const siteFilter = params.get('tyomaa')

  const [selected, setSelected] = useState<Tool | null>(null)
  const [events, setEvents] = useState<ToolEvent[]>([])
  const [movePick, setMovePick] = useState(false)
  const [moving, setMoving] = useState(false)
  const [qrHandled, setQrHandled] = useState(false)

  const [vikaOpen, setVikaOpen] = useState(false)
  const [vikaText, setVikaText] = useState('')

  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHuom, setNewHuom] = useState('')
  const [creating, setCreating] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const [toolRes, wsRes] = await Promise.all([
      supabase.from('tools')
        .select('id, name, numero, status, worksite_id, holder_id, qr_token, huom, vika_kuvaus, vika_ilmoitettu, vika_ilmoittaja, updated_at, worksites(name), holder:profiles!tools_holder_id_fkey(full_name)')
        .order('name').order('numero'),
      supabase.from('worksites').select('id, name').eq('status', 'active').order('name'),
    ])
    if (toolRes.error || wsRes.error) {
      setError('Työkalujen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setTools((toolRes.data ?? []) as unknown as Tool[])
      setWorksites(wsRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // QR-syvälinkki: skannattu tarra avaa työkalun suoraan
  useEffect(() => {
    const qr = params.get('qr')
    if (!qr || qrHandled || tools.length === 0) return
    const t = tools.find((x) => x.qr_token === qr)
    if (t) { openTool(t); setQrHandled(true) }
     
  }, [tools, params, qrHandled])

  async function openTool(t: Tool) {
    setSelected(t)
    setMovePick(false)
    setVikaOpen(false); setVikaText('')
    const { data } = await supabase.from('tool_events')
      .select('id, user_name, event, to_status, worksite_name, created_at')
      .eq('tool_id', t.id).order('created_at', { ascending: false }).limit(12)
    setEvents((data ?? []) as ToolEvent[])
  }

  async function moveTool(t: Tool, patch: Partial<Tool>, eventName: string, wsName?: string) {
    if (!user || moving) return
    setMoving(true)
    const { error: upErr } = await supabase.from('tools').update({
      status: patch.status, worksite_id: patch.worksite_id ?? null, holder_id: patch.holder_id ?? null,
    }).eq('id', t.id)
    if (upErr) {
      setToast('Siirto epäonnistui')
    } else {
      await supabase.from('tool_events').insert({
        tool_id: t.id, user_id: user.id, user_name: profile?.full_name ?? '',
        event: eventName, to_status: patch.status, worksite_id: patch.worksite_id ?? null, worksite_name: wsName ?? null,
      })
      setToast(`${toolLabel(t)}: ${eventName}`)
      setSelected(null)
      fetchAll()
    }
    setMoving(false)
  }

  // Ilmoita vika: ilmoitusvelvollisuus — kone huoltoon ja varaston vikalistalle
  async function ilmoitaVika() {
    if (!user || !selected || !vikaText.trim() || moving) return
    setMoving(true)
    const kuvaus = vikaText.trim()
    const { error: upErr } = await supabase.from('tools').update({
      status: 'huollossa', vika_kuvaus: kuvaus,
      vika_ilmoitettu: new Date().toISOString(), vika_ilmoittaja: profile?.full_name ?? '',
    }).eq('id', selected.id)
    if (upErr) {
      setToast('Vikailmoitus epäonnistui')
    } else {
      await supabase.from('tool_events').insert({
        tool_id: selected.id, user_id: user.id, user_name: profile?.full_name ?? '',
        event: `Vikailmoitus: ${kuvaus}`, to_status: 'huollossa',
      })
      setToast(`${toolLabel(selected)}: vika ilmoitettu — kiitos!`)
      setVikaOpen(false); setVikaText(''); setSelected(null)
      fetchAll()
    }
    setMoving(false)
  }

  // Korjattu-kuittaus sulkee vikasilmukan: kone takaisin käyttöön, historia talteen
  async function merkitseKorjatuksi(t: Tool) {
    if (!user || moving) return
    setMoving(true)
    const { error: upErr } = await supabase.from('tools').update({
      status: 'varastossa', worksite_id: null, holder_id: null,
      vika_kuvaus: null, vika_ilmoitettu: null, vika_ilmoittaja: null,
    }).eq('id', t.id)
    if (upErr) {
      setToast('Kuittaus epäonnistui')
    } else {
      await supabase.from('tool_events').insert({
        tool_id: t.id, user_id: user.id, user_name: profile?.full_name ?? '',
        event: `Korjattu — palautettu käyttöön${t.vika_kuvaus ? ` (vika: ${t.vika_kuvaus})` : ''}`, to_status: 'varastossa',
      })
      setToast(`${toolLabel(t)}: korjattu, varastossa`)
      setSelected(null)
      fetchAll()
    }
    setMoving(false)
  }

  async function createTool() {
    if (!user || !profile || !newName.trim() || creating) return
    setCreating(true)
    const name = newName.trim()
    const maxNum = tools.filter((t) => t.name.toLowerCase() === name.toLowerCase()).reduce((m, t) => Math.max(m, t.numero), 0)
    const { data, error: insErr } = await supabase.from('tools').insert({
      organization_id: profile.organization_id, name, numero: maxNum + 1, huom: newHuom.trim() || null,
    }).select('id').single()
    if (insErr || !data) {
      setToast('Työkalun luonti epäonnistui')
    } else {
      await supabase.from('tool_events').insert({
        tool_id: data.id, user_id: user.id, user_name: profile.full_name ?? '', event: 'Lisätty rekisteriin', to_status: 'varastossa',
      })
      setToast(`${name} #${maxNum + 1} lisätty`)
      setNewName(''); setNewHuom('')
      fetchAll()
    }
    setCreating(false)
  }

  // Tulostettava QR-tarra-arkki (A4, 3 × 8 tarraa)
  async function printQrSheet() {
    if (printing || tools.length === 0) return
    setPrinting(true)
    try {
      const [{ default: jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')])
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const cols = 3, rows = 8, cw = 63, ch = 34, mx = 10.5, my = 12.5
      for (let i = 0; i < tools.length; i++) {
        const t = tools[i]
        const idx = i % (cols * rows)
        if (i > 0 && idx === 0) doc.addPage()
        const x = mx + (idx % cols) * cw
        const y = my + Math.floor(idx / cols) * ch
        const url = `${window.location.origin}/tyokalut?qr=${t.qr_token}`
        const qr = await QRCode.toDataURL(url, { width: 220, margin: 0 })
        doc.setDrawColor(200); doc.roundedRect(x + 1, y + 1, cw - 2, ch - 2, 2, 2)
        doc.addImage(qr, 'PNG', x + 4, y + 4.5, 25, 25)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
        doc.text(doc.splitTextToSize(t.name, 30) as string[], x + 32, y + 12)
        doc.setFontSize(16); doc.text(`#${t.numero}`, x + 32, y + 21)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(120)
        doc.text('HEIKKINEN · FloorData · skannaa siirtääksesi', x + 32, y + 28)
        doc.setTextColor(0)
      }
      doc.save('FloorData_tyokalutarrat.pdf')
      setToast('Tarra-arkki ladattu')
    } catch {
      setToast('Tarra-arkin luonti epäonnistui')
    }
    setPrinting(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tools.filter((t) => {
      if (onlyMine && t.holder_id !== user?.id) return false
      if (siteFilter && t.worksite_id !== siteFilter) return false
      if (filter !== 'kaikki' && t.status !== filter) return false
      if (q && !toolLabel(t).toLowerCase().includes(q) && !toolLocation(t).toLowerCase().includes(q)) return false
      return true
    })
  }, [tools, filter, search, onlyMine, siteFilter, user])

  const counts = useMemo(() => ({
    kaikki: tools.length,
    varastossa: tools.filter((t) => t.status === 'varastossa').length,
    tyomaalla: tools.filter((t) => t.status === 'tyomaalla').length,
    asentajalla: tools.filter((t) => t.status === 'asentajalla').length,
    huollossa: tools.filter((t) => t.status === 'huollossa').length,
    kadonnut: tools.filter((t) => t.status === 'kadonnut').length,
  }), [tools])

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'
  const chip = (key: FilterKey, label: string, count: number) => (
    <button key={key} onClick={() => setFilter(key)}
      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${filter === key ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'} ${key === 'kadonnut' && count > 0 && filter !== key ? 'text-red-400' : ''}`}>
      {label} {count > 0 && `(${count})`}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-500" /> Työkalut
        </h1>
        <div className="ml-auto flex items-center">
          {canCreate && (
            <>
              <button onClick={printQrSheet} disabled={printing} aria-label="Tulosta QR-tarrat" title="Tulosta QR-tarrat" className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                <Printer className="w-5 h-5" />
              </button>
              <button onClick={() => setNewOpen(true)} aria-label="Uusi työkalu" className="p-3 text-amber-400">
                <Plus className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-md mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hae työkalua tai sijaintia…"
            className={`${inputCls} pl-10`} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {chip('kaikki', 'Kaikki', counts.kaikki)}
          {chip('varastossa', 'Varastossa', counts.varastossa)}
          {chip('tyomaalla', 'Työmailla', counts.tyomaalla)}
          {chip('asentajalla', 'Asentajilla', counts.asentajalla)}
          {chip('huollossa', 'Huollossa', counts.huollossa)}
          {chip('kadonnut', 'Etsinnässä', counts.kadonnut)}
          <button onClick={() => setOnlyMine((v) => !v)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${onlyMine ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
            Minulla
          </button>
        </div>

        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
            {tools.length === 0
              ? canCreate ? 'Ei vielä työkaluja. Lisää ensimmäinen +-napista ja tulosta QR-tarrat.' : 'Ei vielä työkaluja rekisterissä.'
              : 'Ei osumia valituilla suodattimilla.'}
          </p>
        )}

        <div className="space-y-2">
          {filtered.map((t) => (
            <button key={t.id} onClick={() => openTool(t)}
              className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{toolLabel(t)}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    {t.status === 'varastossa' && <Warehouse className="w-3.5 h-3.5" />}
                    {t.status === 'tyomaalla' && <Building2 className="w-3.5 h-3.5" />}
                    {t.status === 'asentajalla' && <HardHat className="w-3.5 h-3.5" />}
                    {t.status === 'kadonnut' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                    {toolLocation(t)} · {toolTimeAgo(t.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${TOOL_STATUS_STYLE[t.status]}`}>{TOOL_STATUS_LABEL[t.status]}</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Työkalun tiedot + siirrot */}
      {selected && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{toolLabel(selected)}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className={`font-bold ${selected.status === 'kadonnut' ? 'text-red-400' : ''}`}>{TOOL_STATUS_LABEL[selected.status]}</span>
                  {' · '}{toolLocation(selected)} · {toolTimeAgo(selected.updated_at)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            {selected.huom && <p className="text-sm text-gray-400">{selected.huom}</p>}

            {selected.vika_ilmoitettu && (
              <div className="bg-purple-500/10 border border-purple-900/50 rounded-xl px-4 py-3">
                <p className="text-sm text-purple-200/90">Vika: ”{selected.vika_kuvaus}”</p>
                <p className="text-xs text-gray-500 mt-1">Ilmoitti {selected.vika_ilmoittaja ?? ''} · {toolTimeAgo(selected.vika_ilmoitettu)}</p>
                {canFix && (
                  <button onClick={() => merkitseKorjatuksi(selected)} disabled={moving}
                    className="w-full mt-2.5 py-3 bg-green-500/15 border border-green-500/40 text-green-400 text-sm font-bold rounded-xl disabled:opacity-40">
                    Korjattu — takaisin käyttöön
                  </button>
                )}
              </div>
            )}

            {vikaOpen ? (
              <div className="space-y-2">
                <button onClick={() => { setVikaOpen(false); setVikaText('') }} className="flex items-center gap-1 text-sm text-gray-400 py-1">
                  <ArrowLeft className="w-4 h-4" /> Takaisin
                </button>
                <p className="text-xs font-semibold text-gray-500">Mikä koneessa on vikana?</p>
                <input type="text" value={vikaText} onChange={(e) => setVikaText(e.target.value)} autoFocus
                  placeholder="Esim. ei käynnisty / terä loppu / johto rikki" className={inputCls} />
                <button onClick={ilmoitaVika} disabled={!vikaText.trim() || moving}
                  className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> {moving ? 'Lähetetään…' : 'Ilmoita vika — kone huoltoon'}
                </button>
                <p className="text-[11px] text-gray-600">Ilmoitus menee varaston vikalistalle. Kone näkyy Huollossa-tilassa kunnes se kuitataan korjatuksi.</p>
              </div>
            ) : !movePick ? (
              <div className="space-y-2">
                {selected.holder_id !== user?.id && selected.status !== 'kadonnut' && (
                  <button onClick={() => moveTool(selected, { status: 'asentajalla', holder_id: user?.id ?? null }, 'Otettu mukaan')}
                    disabled={moving}
                    className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                    <HardHat className="w-4 h-4" /> Otan mukaan
                  </button>
                )}
                <button onClick={() => setMovePick(true)} disabled={moving}
                  className="w-full py-3.5 bg-gray-800 border border-gray-700 font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                  <Building2 className="w-4 h-4" /> Vie / jätä työmaalle
                </button>
                {selected.status !== 'varastossa' && (
                  <button onClick={() => moveTool(selected, { status: 'varastossa' }, 'Palautettu varastoon')} disabled={moving}
                    className="w-full py-3.5 bg-gray-800 border border-gray-700 font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                    <Warehouse className="w-4 h-4" /> Palautan varastoon
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {selected.status !== 'kadonnut' && !selected.vika_ilmoitettu && (
                    <button onClick={() => setVikaOpen(true)} disabled={moving}
                      className="py-3 bg-gray-800 border border-purple-900/60 text-sm font-semibold rounded-xl disabled:opacity-40 text-purple-300">
                      Ilmoita vika
                    </button>
                  )}
                  {selected.status !== 'kadonnut' ? (
                    <button onClick={() => moveTool(selected, { status: 'kadonnut' }, 'Ilmoitettu kadonneeksi')} disabled={moving}
                      className="py-3 bg-gray-800 border border-red-900/50 text-sm font-semibold rounded-xl disabled:opacity-40 text-red-400">
                      Ilmoita kadonneeksi
                    </button>
                  ) : (
                    <button onClick={() => moveTool(selected, { status: 'varastossa' }, 'Löytyi — palautettu varastoon')} disabled={moving}
                      className="py-3 bg-green-500/15 border border-green-500/40 text-sm font-bold rounded-xl disabled:opacity-40 text-green-400 col-span-2">
                      Löytyi! Palautan varastoon
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => setMovePick(false)} className="flex items-center gap-1 text-sm text-gray-400 py-1">
                  <ArrowLeft className="w-4 h-4" /> Takaisin
                </button>
                <p className="text-xs font-semibold text-gray-500">Valitse työmaa:</p>
                {worksites.map((w) => (
                  <button key={w.id} onClick={() => moveTool(selected, { status: 'tyomaalla', worksite_id: w.id }, `Jätetty työmaalle`, w.name)}
                    disabled={moving}
                    className="w-full py-3 bg-gray-800 border border-gray-700 text-sm font-semibold rounded-xl disabled:opacity-40 text-left px-4">
                    {w.name}
                  </button>
                ))}
              </div>
            )}

            {events.length > 0 && (
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Historia</p>
                {events.map((e) => (
                  <p key={e.id} className="text-xs text-gray-400">
                    <span className="text-gray-500">{formatDate(e.created_at.slice(0, 10))}</span>{' '}
                    {e.event}{e.worksite_name ? ` (${e.worksite_name})` : ''} — {e.user_name ?? ''}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uusi työkalu */}
      {newOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setNewOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Uusi työkalu</h3>
              <button onClick={() => setNewOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TOOL_NAMES.map((n) => (
                <button key={n} onClick={() => setNewName(n)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${newName === n ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {n}
                </button>
              ))}
            </div>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Työkalun nimi" className={inputCls} />
            <input type="text" value={newHuom} onChange={(e) => setNewHuom(e.target.value)} placeholder="Huom (esim. merkki/malli, vapaaehtoinen)" className={inputCls} />
            {newName.trim() && (
              <p className="text-xs text-gray-500">
                Saa numeron: <span className="font-bold text-white">{newName.trim()} #{tools.filter((t) => t.name.toLowerCase() === newName.trim().toLowerCase()).reduce((m, t) => Math.max(m, t.numero), 0) + 1}</span>
              </p>
            )}
            <button onClick={createTool} disabled={!newName.trim() || creating}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {creating ? 'Lisätään…' : 'Lisää rekisteriin (varastossa)'}
            </button>
            <p className="text-xs text-gray-500">Muista tulostaa uudet QR-tarrat tulostinnapista, kun olet lisännyt työkalut.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <AlaNav />
    </div>
  )
}
