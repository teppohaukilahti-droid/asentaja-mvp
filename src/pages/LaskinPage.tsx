import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Delete, ChevronUp, Ruler, FlaskConical, Calculator as CalcIcon,
  Send, Trash2, X, Check,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Material = { id: string; name: string; unit: string | null }
type Worksite = { id: string; name: string }

type MemoryMap = Record<string, number> // key: material id or 'yleinen'

const YLEINEN = 'yleinen'

function fmt(n: number): string {
  if (!Number.isFinite(n)) return 'Virhe'
  const rounded = Math.round(n * 10000) / 10000
  return rounded.toLocaleString('fi-FI', { maximumFractionDigits: 4 })
}

function parseNum(s: string): number {
  return Number(s.replace(',', '.'))
}

export default function LaskinPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const worksiteParam = params.get('tyomaa')

  const [tab, setTab] = useState<'laskin' | 'menekki'>('laskin')

  // ---- Calculator state ----
  const [entry, setEntry] = useState('0')       // current typed value
  const [acc, setAcc] = useState<number | null>(null)
  const [pendingOp, setPendingOp] = useState<string | null>(null)
  const [entryIsResult, setEntryIsResult] = useState(false)
  const [histLine, setHistLine] = useState('')
  // operand tracking for nosto rule: applies when multiplying two directly typed dims
  const [accDirect, setAccDirect] = useState(false)

  // ---- Nosto ----
  const [nosto, setNosto] = useState<number>(0) // cm
  const [askOmaNosto, setAskOmaNosto] = useState(false)
  const [omaNosto, setOmaNosto] = useState('')

  // ---- Worksite / materials / memory ----
  const [worksite, setWorksite] = useState<Worksite | null>(null)
  const [worksites, setWorksites] = useState<Worksite[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [memory, setMemory] = useState<MemoryMap>({})
  const [memOpen, setMemOpen] = useState(false)
  const [pickerFor, setPickerFor] = useState<null | { amount: number; sign: 1 | -1 }>(null)
  const [sitePickerOpen, setSitePickerOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const memKey = worksite ? `laskin-mem-${worksite.id}` : 'laskin-mem-none'

  // load worksites + selected worksite materials
  useEffect(() => {
    supabase.from('worksites').select('id, name').eq('status', 'active').order('name')
      .then(({ data }) => {
        const list = data ?? []
        setWorksites(list)
        if (worksiteParam) {
          const found = list.find((w) => w.id === worksiteParam)
          if (found) setWorksite(found)
        } else if (list.length === 1) {
          setWorksite(list[0])
        }
      })
  }, [worksiteParam])

  useEffect(() => {
    if (!worksite) { setMaterials([]); return }
    supabase.from('materials').select('id, name, unit').eq('worksite_id', worksite.id).order('name')
      .then(({ data }) => setMaterials(data ?? []))
  }, [worksite])

  // memory persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(memKey)
      setMemory(raw ? JSON.parse(raw) : {})
    } catch { setMemory({}) }
  }, [memKey])

  useEffect(() => {
    try { localStorage.setItem(memKey, JSON.stringify(memory)) } catch { /* täynnä */ }
  }, [memory, memKey])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ---- Calculator logic ----
  const compute = useCallback((a: number, b: number, op: string, aDirect: boolean, bDirect: boolean): { result: number; note?: string } => {
    switch (op) {
      case '+': return { result: a + b }
      case '-': return { result: a - b }
      case '/': return { result: b === 0 ? NaN : a / b }
      case '*': {
        if (nosto > 0 && aDirect && bDirect) {
          const add = (2 * nosto) / 100
          const a2 = a + add
          const b2 = b + add
          return { result: a2 * b2, note: `(${fmt(a)}+${fmt(add)}) × (${fmt(b)}+${fmt(add)})` }
        }
        return { result: a * b }
      }
      default: return { result: b }
    }
  }, [nosto])

  function pressDigit(d: string) {
    setEntry((prev) => {
      if (entryIsResult) { setEntryIsResult(false); return d === ',' ? '0,' : d }
      if (d === ',') {
        if (prev.includes(',')) return prev
        return prev + ','
      }
      if (prev === '0') return d
      if (prev.replace(/[^0-9]/g, '').length >= 10) return prev
      return prev + d
    })
  }

  function pressOp(op: string) {
    const v = parseNum(entry)
    if (acc === null || pendingOp === null) {
      setAcc(v)
      setAccDirect(!entryIsResult)
      setHistLine(`${entry} ${opSymbol(op)}`)
    } else {
      const { result, note } = compute(acc, v, pendingOp, accDirect, !entryIsResult)
      setAcc(result)
      setAccDirect(false)
      setHistLine(`${note ?? fmt(result)} ${opSymbol(op)}`)
      setEntry(fmt(result).replace(/ /g, ''))
    }
    setPendingOp(op)
    setEntryIsResult(true)
  }

  function pressEquals() {
    if (acc === null || pendingOp === null) return
    const v = parseNum(entry)
    const { result, note } = compute(acc, v, pendingOp, accDirect, !entryIsResult)
    setHistLine(note ? `${note} =` : `${fmt(acc)} ${opSymbol(pendingOp)} ${fmt(v)} =`)
    setEntry(String(Math.round(result * 10000) / 10000).replace('.', ','))
    setAcc(null)
    setPendingOp(null)
    setEntryIsResult(true)
    setAccDirect(false)
  }

  function opSymbol(op: string) {
    return op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : '+'
  }

  function pressClear() {
    setEntry('0'); setAcc(null); setPendingOp(null); setHistLine(''); setEntryIsResult(false); setAccDirect(false)
  }

  function pressBackspace() {
    if (entryIsResult) return
    setEntry((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)))
  }

  // ---- Memory ----
  function currentValue(): number {
    return parseNum(entry)
  }

  function pressMemAdd(sign: 1 | -1) {
    const v = currentValue()
    if (!Number.isFinite(v) || v === 0) return
    if (materials.length > 0) {
      setPickerFor({ amount: v, sign })
    } else {
      applyMem(YLEINEN, v, sign)
    }
  }

  function applyMem(key: string, amount: number, sign: 1 | -1) {
    setMemory((prev) => {
      const next = { ...prev, [key]: Math.round(((prev[key] ?? 0) + sign * amount) * 10000) / 10000 }
      if (next[key] === 0) delete next[key]
      return next
    })
    const label = key === YLEINEN ? 'Yleinen muisti' : materials.find((m) => m.id === key)?.name ?? '?'
    setToast(`${sign > 0 ? '+' : '−'}${fmt(amount)} m² → ${label}`)
    setPickerFor(null)
    setEntryIsResult(true)
  }

  const memTotal = useMemo(() => Object.values(memory).reduce((s, v) => s + v, 0), [memory])
  const memRows = useMemo(() =>
    Object.entries(memory).map(([key, val]) => ({
      key,
      label: key === YLEINEN ? 'Yleinen' : materials.find((m) => m.id === key)?.name ?? 'Tuntematon materiaali',
      val,
    })), [memory, materials])

  async function exportToEntries() {
    if (!user || !worksite || memRows.length === 0) return
    setExporting(true)
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const rows = memRows.map((r) => ({
      user_id: user.id,
      worksite_id: worksite.id,
      entry_type: 'vapaa-urakka',
      amount: r.val,
      material_id: r.key === YLEINEN ? null : r.key,
      description: `Laskin: ${r.label}`,
      entry_date: dateStr,
    }))
    const { error } = await supabase.from('entries').insert(rows)
    if (error) {
      setToast('Vienti epäonnistui. Yritä uudelleen.')
    } else {
      setExportDone(`${memRows.length} kirjausta viety työmaalle ${worksite.name}`)
      setMemory({})
      setMemOpen(false)
    }
    setExporting(false)
  }

  // ---- Menekki ----
  const [menekkiM2, setMenekkiM2] = useState('')
  const [liimaGm2, setLiimaGm2] = useState(() => localStorage.getItem('menekki-liima') ?? '300')
  const [liimaPakkaus, setLiimaPakkaus] = useState(() => localStorage.getItem('menekki-liimapak') ?? '15')
  const [tasoiteKgM2mm, setTasoiteKgM2mm] = useState(() => localStorage.getItem('menekki-tasoite') ?? '1,6')
  const [tasoiteMm, setTasoiteMm] = useState(() => localStorage.getItem('menekki-mm') ?? '2')
  const [tasoiteSakki, setTasoiteSakki] = useState(() => localStorage.getItem('menekki-sakki') ?? '20')
  const [useHukka, setUseHukka] = useState(true)

  useEffect(() => { localStorage.setItem('menekki-liima', liimaGm2) }, [liimaGm2])
  useEffect(() => { localStorage.setItem('menekki-liimapak', liimaPakkaus) }, [liimaPakkaus])
  useEffect(() => { localStorage.setItem('menekki-tasoite', tasoiteKgM2mm) }, [tasoiteKgM2mm])
  useEffect(() => { localStorage.setItem('menekki-mm', tasoiteMm) }, [tasoiteMm])
  useEffect(() => { localStorage.setItem('menekki-sakki', tasoiteSakki) }, [tasoiteSakki])

  const hukkaPct = profile?.hukka_percentage ?? 0
  const menekki = useMemo(() => {
    const m2raw = parseNum(menekkiM2 || '0')
    if (!Number.isFinite(m2raw) || m2raw <= 0) return null
    const m2 = useHukka ? m2raw * (1 + hukkaPct / 100) : m2raw
    const liimaKg = (m2 * parseNum(liimaGm2 || '0')) / 1000
    const liimaPak = parseNum(liimaPakkaus || '0') > 0 ? Math.ceil(liimaKg / parseNum(liimaPakkaus)) : 0
    const tasoiteKg = m2 * parseNum(tasoiteKgM2mm.replace(',', '.') || '0') * parseNum(tasoiteMm || '0')
    const sakit = parseNum(tasoiteSakki || '0') > 0 ? Math.ceil(tasoiteKg / parseNum(tasoiteSakki)) : 0
    return { m2, liimaKg, liimaPak, tasoiteKg, sakit }
  }, [menekkiM2, liimaGm2, liimaPakkaus, tasoiteKgM2mm, tasoiteMm, tasoiteSakki, useHukka, hukkaPct])

  // ---- UI ----
  const keypadBtn = 'h-16 rounded-2xl text-xl font-semibold active:scale-95 transition-all select-none'
  const numBtn = `${keypadBtn} bg-gray-800 text-white hover:bg-gray-700`
  const opBtn = `${keypadBtn} bg-gray-700 text-amber-400 hover:bg-gray-600`
  const memBtn = 'h-12 rounded-xl text-sm font-semibold bg-gray-800/80 text-gray-300 hover:bg-gray-700 active:scale-95 transition-all'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate(worksite ? `/tyomaa/${worksite.id}` : '/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <CalcIcon className="w-4 h-4 text-amber-500" /> SuperLaskukone
        </h1>
        <button
          onClick={() => setSitePickerOpen(true)}
          className="ml-auto mr-2 px-3 py-2 bg-gray-800 rounded-xl text-xs text-gray-300 max-w-[45%] truncate"
        >
          {worksite ? worksite.name : 'Valitse työmaa'}
        </button>
      </header>

      <div className="flex border-b border-gray-800">
        <button onClick={() => setTab('laskin')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'laskin' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Ruler className="w-4 h-4" /> Laskin
        </button>
        <button onClick={() => setTab('menekki')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'menekki' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <FlaskConical className="w-4 h-4" /> Menekki
        </button>
      </div>

      {tab === 'laskin' && (
        <main className="flex-1 flex flex-col px-3 pb-4 max-w-md w-full mx-auto">
          {/* Display */}
          <div className="pt-4 pb-2 px-2 text-right">
            <p className="text-sm text-gray-500 h-5 truncate">{histLine}</p>
            <p className="text-5xl font-light tracking-tight truncate py-1">{entry}</p>
            <div className="h-6 flex items-center justify-end gap-2">
              {nosto > 0 && (
                <span className="text-xs font-bold bg-amber-500 text-gray-950 px-2 py-0.5 rounded-full">
                  NOSTO {String(nosto).replace('.', ',')} cm (+{String(2 * nosto).replace('.', ',')} cm/mitta)
                </span>
              )}
              {memTotal > 0 && (
                <button onClick={() => setMemOpen(true)} className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  M: {fmt(memTotal)} m²
                </button>
              )}
            </div>
          </div>

          {/* Nosto chips */}
          <div className="flex gap-2 mb-3">
            {[0, 10, 15].map((n) => (
              <button
                key={n}
                onClick={() => { setNosto(n); setAskOmaNosto(false) }}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors ${nosto === n && !askOmaNosto ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}
              >
                {n === 0 ? 'Ei nostoa' : `${n} cm`}
              </button>
            ))}
            <button
              onClick={() => { setAskOmaNosto(true); setOmaNosto('') }}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors ${askOmaNosto || ![0, 10, 15].includes(nosto) ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}
            >
              {![0, 10, 15].includes(nosto) && !askOmaNosto ? `${String(nosto).replace('.', ',')} cm` : 'Oma'}
            </button>
          </div>

          {askOmaNosto && (
            <div className="flex gap-2 mb-3">
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                placeholder="Noston mitta cm, esim. 25"
                value={omaNosto}
                onChange={(e) => setOmaNosto(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={() => {
                  const v = parseNum(omaNosto)
                  if (Number.isFinite(v) && v > 0 && v <= 100) { setNosto(v); setAskOmaNosto(false) }
                }}
                className="px-5 bg-amber-500 text-gray-950 font-semibold rounded-xl"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Memory row */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <button className={memBtn} onClick={() => { if (memRows.length > 0 && confirm('Tyhjennetäänkö muisti?')) setMemory({}) }}>MC</button>
            <button className={memBtn} onClick={() => setMemOpen(true)}>MR</button>
            <button className={memBtn} onClick={() => pressMemAdd(-1)}>M−</button>
            <button className={`${memBtn} !bg-green-600/20 !text-green-400`} onClick={() => pressMemAdd(1)}>M+</button>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2">
            <button className={`${keypadBtn} bg-gray-700 text-red-400`} onClick={pressClear}>C</button>
            <button className={opBtn} onClick={pressBackspace}><Delete className="w-6 h-6 mx-auto" /></button>
            <button className={opBtn} onClick={() => pressOp('/')}>÷</button>
            <button className={opBtn} onClick={() => pressOp('*')}>×</button>
            {['7', '8', '9'].map((d) => <button key={d} className={numBtn} onClick={() => pressDigit(d)}>{d}</button>)}
            <button className={opBtn} onClick={() => pressOp('-')}>−</button>
            {['4', '5', '6'].map((d) => <button key={d} className={numBtn} onClick={() => pressDigit(d)}>{d}</button>)}
            <button className={opBtn} onClick={() => pressOp('+')}>+</button>
            {['1', '2', '3'].map((d) => <button key={d} className={numBtn} onClick={() => pressDigit(d)}>{d}</button>)}
            <button className={`${keypadBtn} bg-amber-500 text-gray-950 row-span-2`} onClick={pressEquals}>=</button>
            <button className={`${numBtn} col-span-2`} onClick={() => pressDigit('0')}>0</button>
            <button className={numBtn} onClick={() => pressDigit(',')}>,</button>
          </div>

          <p className="text-xs text-gray-600 mt-3 text-center">
            Nosto lisätään kertolaskun molempiin mittoihin: 10 cm nosto → +20 cm/mitta
          </p>
        </main>
      )}

      {tab === 'menekki' && (
        <main className="flex-1 px-4 py-5 max-w-md w-full mx-auto space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Neliöt (m²)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="esim. 120"
              value={menekkiM2}
              onChange={(e) => setMenekkiM2(e.target.value)}
              className="w-full px-4 py-3.5 text-lg bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input type="checkbox" checked={useHukka} onChange={(e) => setUseHukka(e.target.checked)} className="w-5 h-5 accent-amber-500" />
            Lisää hukka {String(hukkaPct).replace('.', ',')} % (profiilistasi)
          </label>

          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Liima</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Menekki g/m²</label>
                <input type="text" inputMode="decimal" value={liimaGm2} onChange={(e) => setLiimaGm2(e.target.value)} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pakkaus kg</label>
                <input type="text" inputMode="decimal" value={liimaPakkaus} onChange={(e) => setLiimaPakkaus(e.target.value)} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
              </div>
            </div>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Tasoite</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">kg/m²/mm</label>
                <input type="text" inputMode="decimal" value={tasoiteKgM2mm} onChange={(e) => setTasoiteKgM2mm(e.target.value)} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kerros mm</label>
                <input type="text" inputMode="decimal" value={tasoiteMm} onChange={(e) => setTasoiteMm(e.target.value)} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Säkki kg</label>
                <input type="text" inputMode="decimal" value={tasoiteSakki} onChange={(e) => setTasoiteSakki(e.target.value)} className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {menekki && (
            <section className="bg-amber-500/10 border border-amber-800 rounded-2xl p-4 space-y-2">
              <p className="text-sm text-amber-300 font-semibold">Laskettu pinta-ala: {fmt(menekki.m2)} m²{useHukka ? ' (sis. hukka)' : ''}</p>
              <p className="text-base">Liima: <span className="font-bold">{fmt(Math.round(menekki.liimaKg * 10) / 10)} kg</span> → {menekki.liimaPak} pakkausta</p>
              <p className="text-base">Tasoite: <span className="font-bold">{fmt(Math.round(menekki.tasoiteKg * 10) / 10)} kg</span> → {menekki.sakit} säkkiä</p>
            </section>
          )}

          <p className="text-xs text-gray-600">
            Kertoimet ovat yleisarvoja — muokkaa ne käyttämiesi tuotteiden mukaan. Arvot muistetaan laitteellasi.
          </p>
        </main>
      )}

      {/* Material picker bottom sheet */}
      {pickerFor && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end" onClick={() => setPickerFor(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-sm text-gray-400 mb-4">
              {pickerFor.sign > 0 ? 'Lisätään' : 'Vähennetään'} <span className="text-white font-bold">{fmt(pickerFor.amount)} m²</span> — mihin materiaaliin?
            </p>
            <div className="space-y-2">
              {materials.map((m) => (
                <button key={m.id} onClick={() => applyMem(m.id, pickerFor.amount, pickerFor.sign)} className="w-full py-3.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium flex items-center justify-between px-4">
                  <span>{m.name}</span>
                  {memory[m.id] ? <span className="text-xs text-green-400">{fmt(memory[m.id])} m²</span> : null}
                </button>
              ))}
              <button onClick={() => applyMem(YLEINEN, pickerFor.amount, pickerFor.sign)} className="w-full py-3.5 bg-gray-800/60 hover:bg-gray-700 rounded-xl text-gray-300 font-medium">
                Yleinen muisti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory panel */}
      {memOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end" onClick={() => setMemOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Muisti {worksite ? `· ${worksite.name}` : ''}</h3>
              <button onClick={() => setMemOpen(false)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            {memRows.length === 0 ? (
              <p className="text-gray-500 text-sm">Muisti on tyhjä. Laske ja paina M+.</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {memRows.map((r) => (
                    <div key={r.key} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                      <span className="text-sm font-medium">{r.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{fmt(r.val)} m²</span>
                        <button onClick={() => setMemory((prev) => { const n = { ...prev }; delete n[r.key]; return n })} aria-label="Poista" className="text-gray-600 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2 text-sm text-gray-400">
                    <span>Yhteensä</span><span className="font-bold text-white">{fmt(memTotal)} m²</span>
                  </div>
                </div>
                <button
                  onClick={exportToEntries}
                  disabled={exporting || !worksite}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> {exporting ? 'Viedään…' : worksite ? 'Vie kirjauksiin' : 'Valitse ensin työmaa'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Worksite picker */}
      {sitePickerOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end" onClick={() => setSitePickerOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Valitse työmaa</h3>
            <div className="space-y-2">
              {worksites.map((w) => (
                <button key={w.id} onClick={() => { setWorksite(w); setSitePickerOpen(false) }} className={`w-full py-3.5 rounded-xl font-medium ${worksite?.id === w.id ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  {w.name}
                </button>
              ))}
              <button onClick={() => { setWorksite(null); setSitePickerOpen(false) }} className="w-full py-3 rounded-xl text-sm text-gray-500 hover:text-gray-300">
                Ei työmaata (vain peruslaskin)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <ChevronUp className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      {exportDone && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-6" onClick={() => setExportDone(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center max-w-sm" onClick={(e) => e.stopPropagation()}>
            <Check className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="font-semibold mb-1">Vienti onnistui</p>
            <p className="text-sm text-gray-400 mb-4">{exportDone}</p>
            <button onClick={() => setExportDone(null)} className="px-6 py-2.5 bg-amber-500 text-gray-950 font-semibold rounded-xl">OK</button>
          </div>
        </div>
      )}
    </div>
  )
}
