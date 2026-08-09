import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Building2, Package, Clock, Trash2, RefreshCw, Calculator,
  Hammer, Star, Search, X, Check, Plus, Layers, PenLine, FileText, Copy, FileSignature, ShoppingCart, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { today, eur, formatDate, parseNum, HOUR_TYPES, QUICK_HOURS, isWeldingCode } from '../lib/helpers'
import { STATUS_LABEL, STATUS_STYLE, timeAgo } from '../lib/requests'
import type { MaterialRequest } from '../lib/requests'

type Worksite = { id: string; name: string; address: string | null; client_company: string | null; status: string }
type Material = { id: string; name: string; balance: number | null; unit: string | null }
type TesCode = { id: string; code: string; description: string; price: number; unit: string; category: number; category_name: string | null }
type Preset = { id: string; name: string; tes_code_ids: string[] }
type Entry = {
  id: string; entry_type: string; amount: number | null; hours: number | null
  unit_price: number | null; total_sum: number | null; description: string | null
  entry_date: string; tes_code_id: string | null; hour_category: string | null
}

const FAV_PRESET = 'pikavalinnat'

export default function WorksitePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const hourlyRate = profile?.hourly_rate ?? 0
  const hukkaPct = profile?.hukka_percentage ?? 0

  const [worksite, setWorksite] = useState<Worksite | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [tesCodes, setTesCodes] = useState<TesCode[]>([])
  const [favIds, setFavIds] = useState<string[]>([])
  const [favRowId, setFavRowId] = useState<string | null>(null)
  const [packages, setPackages] = useState<Preset[]>([])
  const [topCodeIds, setTopCodeIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // tarvepyynnöt
  const [myRequests, setMyRequests] = useState<MaterialRequest[]>([])
  const [tarveOpen, setTarveOpen] = useState(false)
  const [tItem, setTItem] = useState('')
  const [tMaara, setTMaara] = useState('')
  const [tKiire, setTKiire] = useState(false)
  const [tLisatiedot, setTLisatiedot] = useState('')
  const [tarveSaving, setTarveSaving] = useState(false)

  // kirjauksen muokkaus
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // urakka form
  const [selectedCode, setSelectedCode] = useState<TesCode | null>(null)
  const [selectedPkg, setSelectedPkg] = useState<Preset | null>(null)
  const [amount, setAmount] = useState('')
  const [matId, setMatId] = useState<string | null>(null)
  const [urakkaSaving, setUrakkaSaving] = useState(false)
  const [urakkaError, setUrakkaError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [pkgSheet, setPkgSheet] = useState<null | 'list' | 'edit'>(null)
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null)
  const [pkgName, setPkgName] = useState('')
  const [pkgCodes, setPkgCodes] = useState<string[]>([])

  // vapaa urakka
  const [vapaaOpen, setVapaaOpen] = useState(false)
  const [vKuvaus, setVKuvaus] = useState('')
  const [vMaara, setVMaara] = useState('')
  const [vYksikko, setVYksikko] = useState('kpl')
  const [vHinta, setVHinta] = useState('')
  const [vSaving, setVSaving] = useState(false)

  // tunti form
  const [hours, setHours] = useState('')
  const [hourType, setHourType] = useState('Asennus')
  const [hourCat, setHourCat] = useState<'kuitattava' | 'oma'>('kuitattava')
  const [description, setDescription] = useState('')
  const [entryDate, setEntryDate] = useState(today())
  const [savingEntry, setSavingEntry] = useState(false)
  const [entryError, setEntryError] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    setError(null)

    const [siteRes, materialsRes, entriesRes, tesRes, presetRes, usageRes, reqRes] = await Promise.all([
      supabase.from('worksites').select('id, name, address, client_company, status').eq('id', id).single(),
      supabase.from('materials').select('id, name, balance, unit').eq('worksite_id', id).order('name'),
      supabase.from('entries').select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category').eq('worksite_id', id).eq('user_id', user.id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('tes_codes').select('id, code, description, price, unit, category, category_name').order('category').order('code'),
      supabase.from('presets').select('id, name, tes_code_ids').eq('user_id', user.id).eq('scope', 'personal'),
      supabase.from('entries').select('tes_code_id').eq('user_id', user.id).not('tes_code_id', 'is', null).limit(1000),
      supabase.from('material_requests').select('*').eq('worksite_id', id).eq('requested_by', user.id).neq('status', 'hylatty').order('created_at', { ascending: false }).limit(20),
    ])

    if (siteRes.error) {
      setError('Työmaan tietojen haku epäonnistui. Tarkista verkkoyhteys.')
      setLoading(false)
      return
    }

    setWorksite(siteRes.data)
    setMaterials(materialsRes.data ?? [])
    setEntries((entriesRes.data ?? []).map((e) => ({ ...e, amount: e.amount === null ? null : Number(e.amount), hours: e.hours === null ? null : Number(e.hours), unit_price: e.unit_price === null ? null : Number(e.unit_price), total_sum: e.total_sum === null ? null : Number(e.total_sum) })))
    setTesCodes((tesRes.data ?? []).map((t) => ({ ...t, price: Number(t.price) })))
    setMyRequests((reqRes.data ?? []) as unknown as MaterialRequest[])
    const counts = new Map<string, number>()
    ;(usageRes.data ?? []).forEach((r) => {
      if (r.tes_code_id) counts.set(r.tes_code_id, (counts.get(r.tes_code_id) ?? 0) + 1)
    })
    setTopCodeIds([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id2]) => id2))
    const presets = presetRes.data ?? []
    const fav = presets.find((p) => p.name === FAV_PRESET)
    if (fav) { setFavRowId(fav.id); setFavIds(fav.tes_code_ids ?? []) }
    setPackages(presets.filter((p) => p.name !== FAV_PRESET))
    setLoading(false)
  }, [id, user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const tesById = useMemo(() => new Map(tesCodes.map((t) => [t.id, t])), [tesCodes])
  const favorites = useMemo(() => favIds.map((f) => tesById.get(f)).filter(Boolean) as TesCode[], [favIds, tesById])
  const categories = useMemo(() => {
    const seen = new Map<string, number>()
    tesCodes.forEach((t) => { if (t.category_name && !seen.has(t.category_name)) seen.set(t.category_name, t.category) })
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name)
  }, [tesCodes])

  const topCodes = useMemo(() => topCodeIds.map((cid) => tesById.get(cid)).filter(Boolean) as TesCode[], [topCodeIds, tesById])

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = tesCodes
    if (catFilter) list = list.filter((t) => t.category_name === catFilter)
    if (q) list = list.filter((t) => t.code.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    return list
  }, [tesCodes, search, catFilter])

  const siteTotal = useMemo(() => entries.reduce((s, e) => {
    if (e.entry_type === 'tunti') return s + (e.hours ?? 0) * hourlyRate
    return s + (e.total_sum ?? 0)
  }, 0), [entries, hourlyRate])

  async function saveFavorites(next: string[]) {
    if (!user) return
    setFavIds(next)
    if (favRowId) {
      await supabase.from('presets').update({ tes_code_ids: next }).eq('id', favRowId)
    } else {
      const { data } = await supabase.from('presets').insert({ user_id: user.id, name: FAV_PRESET, scope: 'personal', tes_code_ids: next }).select('id').single()
      if (data) setFavRowId(data.id)
    }
  }

  function toggleFavorite(codeId: string) {
    saveFavorites(favIds.includes(codeId) ? favIds.filter((f) => f !== codeId) : [...favIds, codeId])
  }

  async function savePackage() {
    if (!user || !pkgName.trim() || pkgCodes.length === 0) return
    if (editingPkgId) {
      const { error } = await supabase.from('presets').update({ name: pkgName.trim(), tes_code_ids: pkgCodes }).eq('id', editingPkgId)
      if (!error) {
        setPackages((prev) => prev.map((p) => p.id === editingPkgId ? { ...p, name: pkgName.trim(), tes_code_ids: pkgCodes } : p))
        if (selectedPkg?.id === editingPkgId) setSelectedPkg({ id: editingPkgId, name: pkgName.trim(), tes_code_ids: pkgCodes })
        setToast(`Pikavalinta "${pkgName.trim()}" päivitetty`)
      }
    } else {
      const { data } = await supabase.from('presets').insert({ user_id: user.id, name: pkgName.trim(), scope: 'personal', tes_code_ids: pkgCodes }).select('id, name, tes_code_ids').single()
      if (data) {
        setPackages((prev) => [...prev, data])
        setToast(`Pikavalinta "${data.name}" tallennettu`)
      }
    }
    setPkgSheet('list')
    setEditingPkgId(null)
    setPkgName('')
    setPkgCodes([])
  }

  function openPkgEditor(base?: Preset, asCopy?: boolean) {
    setSearch('')
    if (base) {
      setEditingPkgId(asCopy ? null : base.id)
      setPkgName(asCopy ? `${base.name} (kopio)` : base.name)
      setPkgCodes([...base.tes_code_ids])
    } else {
      setEditingPkgId(null)
      setPkgName('')
      setPkgCodes([])
    }
    setPkgSheet('edit')
  }

  async function deletePackage(pkgId: string) {
    await supabase.from('presets').delete().eq('id', pkgId)
    setPackages((prev) => prev.filter((p) => p.id !== pkgId))
    if (selectedPkg?.id === pkgId) setSelectedPkg(null)
  }

  async function deductMaterial(totalAmount: number) {
    if (!matId) return
    const mat = materials.find((m) => m.id === matId)
    if (!mat || mat.balance === null) return
    const deduction = totalAmount * (1 + hukkaPct / 100)
    const newBalance = Math.max(0, Math.round((mat.balance - deduction) * 100) / 100)
    const { error } = await supabase.from('materials').update({ balance: newBalance }).eq('id', matId)
    if (!error) setMaterials((prev) => prev.map((m) => (m.id === matId ? { ...m, balance: newBalance } : m)))
  }

  const parsedAmount = parseNum(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0

  const pkgBreakdown = useMemo(() => {
    if (!selectedPkg || !amountValid) return null
    const rows = selectedPkg.tes_code_ids.map((cid) => tesById.get(cid)).filter(Boolean).map((t) => {
      const tc = t as TesCode
      const qty = isWeldingCode(tc.code) ? parsedAmount * 0.5 : parsedAmount
      return { tc, qty, sum: qty * tc.price }
    })
    return { rows, total: rows.reduce((s, r) => s + r.sum, 0) }
  }, [selectedPkg, amountValid, parsedAmount, tesById])

  async function saveUrakka(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id) return
    if (!amountValid) { setUrakkaError('Anna määrä, esim. 25 tai 12,5'); return }
    setUrakkaSaving(true)
    setUrakkaError(null)

    let rows: Record<string, unknown>[] = []
    if (selectedPkg && pkgBreakdown) {
      rows = pkgBreakdown.rows.map((r) => ({
        user_id: user.id, worksite_id: id, entry_type: 'urakka', tes_code_id: r.tc.id,
        amount: Math.round(r.qty * 100) / 100, unit_price: r.tc.price,
        total_sum: Math.round(r.sum * 100) / 100,
        description: `${r.tc.code} ${r.tc.description}`, entry_date: entryDate,
        material_id: matId,
      }))
    } else if (selectedCode) {
      rows = [{
        user_id: user.id, worksite_id: id, entry_type: 'urakka', tes_code_id: selectedCode.id,
        amount: parsedAmount, unit_price: selectedCode.price,
        total_sum: Math.round(parsedAmount * selectedCode.price * 100) / 100,
        description: `${selectedCode.code} ${selectedCode.description}`, entry_date: entryDate,
        material_id: matId,
      }]
    }
    if (rows.length === 0) { setUrakkaSaving(false); return }

    const { data, error } = await supabase.from('entries').insert(rows)
      .select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category')

    if (error) {
      setUrakkaError('Tallennus epäonnistui. Yritä uudelleen.')
    } else if (data) {
      setEntries((prev) => [...data.map((e) => ({ ...e, amount: e.amount === null ? null : Number(e.amount), hours: e.hours === null ? null : Number(e.hours), unit_price: e.unit_price === null ? null : Number(e.unit_price), total_sum: e.total_sum === null ? null : Number(e.total_sum) })), ...prev])
      await deductMaterial(parsedAmount)
      setAmount('')
      setToast(`${data.length} kirjaus${data.length > 1 ? 'ta' : ''} tallennettu`)
    }
    setUrakkaSaving(false)
  }

  const vSumma = parseNum(vMaara) * parseNum(vHinta)
  async function saveVapaa(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id || !vKuvaus.trim() || !Number.isFinite(vSumma) || vSumma <= 0) return
    setVSaving(true)
    const { data, error } = await supabase.from('entries').insert({
      user_id: user.id, worksite_id: id, entry_type: 'vapaa-urakka',
      amount: parseNum(vMaara), unit_price: parseNum(vHinta),
      total_sum: Math.round(vSumma * 100) / 100,
      description: `${vKuvaus.trim()} (${vYksikko})`, entry_date: entryDate,
    }).select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category').single()
    if (!error && data) {
      setEntries((prev) => [{ ...data, amount: Number(data.amount), unit_price: Number(data.unit_price), total_sum: Number(data.total_sum), hours: null }, ...prev])
      setVKuvaus(''); setVMaara(''); setVHinta(''); setVapaaOpen(false)
      setToast('Vapaa urakka tallennettu')
    }
    setVSaving(false)
  }

  async function addHourEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id) return
    const parsed = parseNum(hours)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
      setEntryError('Anna tunnit väliltä 0–24, esim. 7,5')
      return
    }
    setSavingEntry(true)
    setEntryError(null)
    const desc = description.trim() ? `${hourType}: ${description.trim()}` : hourType
    const { data, error } = await supabase.from('entries').insert({
      user_id: user.id, worksite_id: id, entry_type: 'tunti', hours: parsed,
      description: desc, hour_category: hourCat, entry_date: entryDate,
    }).select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category').single()

    if (error) {
      setEntryError('Kirjauksen tallennus epäonnistui. Yritä uudelleen.')
    } else if (data) {
      setEntries((prev) => [{ ...data, hours: Number(data.hours), amount: null, unit_price: null, total_sum: null }, ...prev])
      setHours(''); setDescription('')
      setToast('Tunnit kirjattu')
    }
    setSavingEntry(false)
  }

  async function saveTarve() {
    if (!user || !id || !profile || !tItem.trim()) return
    setTarveSaving(true)
    const mat = materials.find((m) => m.name === tItem.trim())
    const { error } = await supabase.from('material_requests').insert({
      organization_id: profile.organization_id,
      worksite_id: id,
      requested_by: user.id,
      material_id: mat?.id ?? null,
      item_text: tItem.trim(),
      maara: tMaara.trim() || null,
      kiire: tKiire,
      lisatiedot: tLisatiedot.trim() || null,
    })
    if (error) {
      setToast('Tarpeen lähetys epäonnistui')
    } else {
      setToast('Tarve lähetetty työnjohdolle')
      setTarveOpen(false)
      setTItem(''); setTMaara(''); setTKiire(false); setTLisatiedot('')
      fetchAll()
    }
    setTarveSaving(false)
  }

  function openEntryEdit(entry: Entry) {
    setEditEntry(entry)
    setEditValue(String(entry.entry_type === 'tunti' ? (entry.hours ?? '') : (entry.amount ?? '')).replace('.', ','))
    setEditDate(entry.entry_date)
  }

  async function saveEntryEdit() {
    if (!editEntry) return
    const v = parseNum(editValue)
    if (!Number.isFinite(v) || v <= 0) { setToast('Tarkista määrä'); return }
    setEditSaving(true)
    const patch: Record<string, unknown> = { entry_date: editDate }
    if (editEntry.entry_type === 'tunti') {
      patch.hours = v
    } else {
      patch.amount = v
      if (editEntry.unit_price !== null) patch.total_sum = Math.round(v * editEntry.unit_price * 100) / 100
    }
    const { error } = await supabase.from('entries').update(patch).eq('id', editEntry.id)
    if (error) {
      setToast('Muokkaus epäonnistui')
    } else {
      setEntries((prev) => prev.map((e) => e.id === editEntry.id ? { ...e, entry_date: editDate, hours: editEntry.entry_type === 'tunti' ? v : e.hours, amount: editEntry.entry_type !== 'tunti' ? v : e.amount, total_sum: editEntry.entry_type !== 'tunti' && editEntry.unit_price !== null ? Math.round(v * editEntry.unit_price * 100) / 100 : e.total_sum } : e))
      setToast('Kirjaus päivitetty')
      setEditEntry(null)
    }
    setEditSaving(false)
  }

  async function deleteEntry(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  const entriesByDate = useMemo(() => {
    const groups: { date: string; items: Entry[] }[] = []
    entries.forEach((e) => {
      const g = groups.find((x) => x.date === e.entry_date)
      if (g) g.items.push(e)
      else groups.push({ date: e.entry_date, items: [e] })
    })
    return groups
  }, [entries])

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'
  const chipCls = (active: boolean) => `px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">{worksite?.name ?? 'Työmaa'}</h1>
          <div className="flex items-center gap-3">
            {worksite?.address && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(worksite.address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-amber-400">
                <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{worksite.address}</span>
              </a>
            )}
            {siteTotal > 0 && <span className="text-xs font-bold text-green-400">{eur(siteTotal)}</span>}
          </div>
        </div>
        <button onClick={() => navigate(`/mittaus?tyomaa=${id}`)} aria-label="Mittauspöytäkirjat" className="ml-auto p-3 text-gray-400 hover:text-white transition-colors">
          <FileSignature className="w-5 h-5" />
        </button>
        <button onClick={() => navigate(`/raportti?tyomaa=${id}`)} aria-label="Raportti" className="p-3 text-gray-400 hover:text-white transition-colors">
          <FileText className="w-5 h-5" />
        </button>
        <button onClick={() => navigate(`/laskin?tyomaa=${id}`)} aria-label="SuperLaskukone" className="p-3 text-amber-400 hover:text-amber-300 transition-colors">
          <Calculator className="w-5 h-5" />
        </button>
      </header>

      {loading && (
        <div className="px-4 py-5 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="bg-gray-900 rounded-2xl h-24 animate-pulse" />)}
        </div>
      )}

      {error && (
        <div className="m-4 bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Yritä uudelleen
          </button>
        </div>
      )}

      {!loading && !error && worksite && (
        <main className="px-4 py-5 pb-20 space-y-7 max-w-md mx-auto">

          {/* ===== URAKKAKIRJAUS ===== */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Hammer className="w-5 h-5 text-amber-500" /> Urakkakirjaus
            </h2>

            <div className="flex flex-wrap gap-2 mb-3">
              {packages.map((p) => (
                <button key={p.id} onClick={() => { setSelectedPkg(selectedPkg?.id === p.id ? null : p); setSelectedCode(null); setUrakkaError(null) }}
                  className={`${chipCls(selectedPkg?.id === p.id)} flex items-center gap-1.5`}>
                  <Layers className="w-3.5 h-3.5" /> {p.name}
                  <span className="text-xs opacity-70">({p.tes_code_ids.length})</span>
                </button>
              ))}
              {favorites.map((t) => (
                <button key={t.id} onClick={() => { setSelectedCode(selectedCode?.id === t.id ? null : t); setSelectedPkg(null); setUrakkaError(null) }}
                  className={chipCls(selectedCode?.id === t.id)}>
                  {t.code} <span className="font-normal opacity-80">{t.description.length > 16 ? t.description.slice(0, 16) + '…' : t.description}</span>
                </button>
              ))}
              <button onClick={() => { setSearch(''); setCatFilter(null); setSearchOpen(true) }}
                className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-800/60 text-amber-400 border border-dashed border-gray-600 hover:bg-gray-800 flex items-center gap-1.5">
                <Search className="w-4 h-4" /> {favorites.length === 0 && packages.length === 0 ? 'Hae / ohjelmoi pikanapit' : 'Hae'}
              </button>
              <button onClick={() => setPkgSheet('list')}
                className="px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-800/60 text-gray-400 border border-dashed border-gray-600 hover:bg-gray-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Pikavalinnat
              </button>
            </div>

            <form onSubmit={saveUrakka} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
              {selectedPkg ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1.5"><Layers className="w-4 h-4 text-amber-400" /> {selectedPkg.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedPkg.tes_code_ids.map((cid) => tesById.get(cid)?.code).filter(Boolean).join(' + ')}
                    </p>
                    {selectedPkg.tes_code_ids.some((cid) => { const c = tesById.get(cid); return c && isWeldingCode(c.code) }) && (
                      <p className="text-xs text-amber-400/80 mt-1">Hitsauskoodit (110) lasketaan 50 % määrästä</p>
                    )}
                  </div>
                  <button type="button" onClick={() => deletePackage(selectedPkg.id)} aria-label="Poista paketti" className="p-1.5 text-gray-600 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              ) : selectedCode ? (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{selectedCode.code} · {selectedCode.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{eur(selectedCode.price)} / {selectedCode.unit}{selectedCode.category_name ? ` · ${selectedCode.category_name}` : ''}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedCode(null)} aria-label="Poista valinta" className="p-1.5 text-gray-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Valitse työ tai pikavalinta pikanapista, tai hae.</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="amount" className="block text-sm text-gray-400 mb-1.5">
                    Määrä {selectedPkg ? '(m²)' : selectedCode ? `(${selectedCode.unit})` : ''}
                  </label>
                  <input id="amount" type="text" inputMode="decimal" placeholder="esim. 25" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="entryDate" className="block text-sm text-gray-400 mb-1.5">Päivä</label>
                  <input id="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>

              {materials.length > 0 && (selectedCode || selectedPkg) && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Vähennä materiaalisaldosta (+hukka {String(hukkaPct).replace('.', ',')} %)</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setMatId(null)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${!matId ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Ei</button>
                    {materials.map((m) => (
                      <button key={m.id} type="button" onClick={() => setMatId(m.id)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${matId === m.id ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                        {m.name.length > 20 ? m.name.slice(0, 20) + '…' : m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPkg && pkgBreakdown && (
                <div className="bg-gray-800/60 rounded-xl p-3 space-y-1">
                  {pkgBreakdown.rows.map((r) => (
                    <p key={r.tc.id} className="text-xs text-gray-400 flex justify-between">
                      <span>{r.tc.code} · {String(Math.round(r.qty * 100) / 100).replace('.', ',')} {r.tc.unit}{isWeldingCode(r.tc.code) ? ' (50 %)' : ''}</span>
                      <span>{eur(r.sum)}</span>
                    </p>
                  ))}
                  <p className="text-sm text-amber-300 font-semibold flex justify-between border-t border-gray-700 pt-1.5 mt-1.5">
                    <span>Yhteensä</span><span>{eur(pkgBreakdown.total)}</span>
                  </p>
                </div>
              )}
              {!selectedPkg && selectedCode && amountValid && (
                <p className="text-sm text-amber-300 font-semibold">{amount} {selectedCode.unit} × {eur(selectedCode.price)} = {eur(parsedAmount * selectedCode.price)}</p>
              )}
              {urakkaError && <p className="text-red-400 text-sm" role="alert">{urakkaError}</p>}

              <button type="submit" disabled={urakkaSaving || (!selectedCode && !selectedPkg)}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 transition-colors">
                <Plus className="w-5 h-5" /> {urakkaSaving ? 'Tallennetaan…' : selectedPkg ? `Kirjaa ${selectedPkg.tes_code_ids.length} työvaihetta` : 'Kirjaa urakka'}
              </button>
            </form>

            <button onClick={() => setVapaaOpen(!vapaaOpen)} className="mt-3 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <PenLine className="w-4 h-4" /> Vapaa urakka (oma kuvaus ja hinta) {vapaaOpen ? '▴' : '▾'}
            </button>
            {vapaaOpen && (
              <form onSubmit={saveVapaa} className="mt-3 bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Työn kuvaus</label>
                  <input type="text" value={vKuvaus} onChange={(e) => setVKuvaus(e.target.value)} placeholder="esim. Lattian kittaus" className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Määrä</label>
                    <input type="text" inputMode="decimal" value={vMaara} onChange={(e) => setVMaara(e.target.value)} placeholder="1" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Yksikkö</label>
                    <select value={vYksikko} onChange={(e) => setVYksikko(e.target.value)} className={inputCls}>
                      {['kpl', 'm²', 'jm', 'h', 'pv'].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">á-hinta €</label>
                    <input type="text" inputMode="decimal" value={vHinta} onChange={(e) => setVHinta(e.target.value)} placeholder="0,00" className={inputCls} />
                  </div>
                </div>
                {Number.isFinite(vSumma) && vSumma > 0 && (
                  <p className="text-sm text-amber-300 font-semibold">Yhteensä {eur(vSumma)}</p>
                )}
                <button type="submit" disabled={vSaving || !vKuvaus.trim() || !(vSumma > 0)}
                  className="w-full py-3 bg-gray-800 border border-gray-700 font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors">
                  {vSaving ? 'Tallennetaan…' : 'Kirjaa vapaa urakka'}
                </button>
              </form>
            )}
          </section>

          {/* ===== TUNTIKIRJAUS ===== */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Clock className="w-5 h-5 text-amber-500" /> Tuntikirjaus
            </h2>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setHourCat('kuitattava')} className={`py-3 rounded-xl text-sm font-semibold transition-colors ${hourCat === 'kuitattava' ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Kuitattava</button>
              <button onClick={() => setHourCat('oma')} className={`py-3 rounded-xl text-sm font-semibold transition-colors ${hourCat === 'oma' ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Oma</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {HOUR_TYPES.map((t) => (
                <button key={t} onClick={() => setHourType(t)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${hourType === t ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{t}</button>
              ))}
            </div>

            <form onSubmit={addHourEntry} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
              <div className="flex gap-2">
                {QUICK_HOURS.map((q) => (
                  <button key={q} type="button" onClick={() => setHours(q)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${hours === q ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>{q}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hours" className="block text-sm text-gray-400 mb-1.5">Tunnit · {hourType}</label>
                  <input id="hours" type="text" inputMode="decimal" placeholder="7,5" value={hours} onChange={(e) => setHours(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="hourDate" className="block text-sm text-gray-400 mb-1.5">Päivä</label>
                  <input id="hourDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm text-gray-400 mb-1.5">Tarkenne (valinnainen)</label>
                <input id="description" type="text" placeholder="esim. 2. krs käytävä" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </div>
              {parseNum(hours) > 0 && hourlyRate > 0 && (
                <p className="text-sm text-amber-300 font-semibold">{hours} h × {eur(hourlyRate)} = {eur(parseNum(hours) * hourlyRate)}</p>
              )}
              {entryError && <p className="text-red-400 text-sm" role="alert">{entryError}</p>}
              <button type="submit" disabled={savingEntry}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-800 border border-gray-700 text-white font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
                <Plus className="w-5 h-5" /> {savingEntry ? 'Tallennetaan…' : `Kirjaa tunnit (${hourType} · ${hourCat})`}
              </button>
            </form>
          </section>

          {/* ===== OMAT KIRJAUKSET ===== */}
          {entriesByDate.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Omat kirjaukset</h2>
              <div className="space-y-4">
                {entriesByDate.map((g) => (
                  <div key={g.date}>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">{formatDate(g.date)}</p>
                    <div className="space-y-1.5">
                      {g.items.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                          <button type="button" onClick={() => openEntryEdit(entry)} className="min-w-0 flex-1 text-left">
                            <p className="text-sm truncate">{entry.description ?? entry.entry_type}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {entry.entry_type === 'tunti'
                                ? `${String(entry.hours).replace('.', ',')} h · ${entry.hour_category ?? ''}`
                                : `${String(entry.amount ?? '').replace('.', ',')}${entry.unit_price !== null ? ` × ${eur(entry.unit_price)}` : ' m²'}`}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-sm font-bold ${entry.entry_type === 'tunti' ? 'text-blue-300' : 'text-green-400'}`}>
                              {entry.entry_type === 'tunti' ? eur((entry.hours ?? 0) * hourlyRate) : entry.total_sum !== null ? eur(entry.total_sum) : '–'}
                            </span>
                            <button onClick={() => deleteEntry(entry.id)} aria-label="Poista" className="p-2 text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== MATERIAALIT ===== */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Package className="w-5 h-5 text-amber-500" /> Materiaalit
            </h2>
            {materials.length === 0 ? (
              <p className="text-gray-500 text-sm">Ei materiaaleja tällä työmaalla.</p>
            ) : (
              <div className="space-y-2">
                {materials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    {m.balance !== null && (
                      <p className={`text-sm font-semibold shrink-0 ${m.balance < 50 ? 'text-amber-400' : 'text-gray-400'}`}>
                        {String(m.balance).replace('.', ',')} {m.unit ?? ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {worksite.client_company && (
              <p className="flex items-center gap-2 text-xs text-gray-600 mt-3">
                <Building2 className="w-3.5 h-3.5" /> Tilaaja: {worksite.client_company}
              </p>
            )}
          </section>

          {/* ===== TARVITSEN LISÄÄ ===== */}
          <section>
            <button onClick={() => { setTItem(''); setTarveOpen(true) }}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl hover:bg-amber-400 transition-colors">
              <ShoppingCart className="w-5 h-5" /> Tarvitsen lisää materiaalia
            </button>
            {myRequests.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase">Omat tarvepyynnöt</p>
                {myRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{r.item_text}{r.maara ? ` · ${r.maara}` : ''}{r.kiire ? ' ⚡' : ''}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{timeAgo(r.created_at)}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* ===== TARVE-SHEET ===== */}
      {tarveOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setTarveOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-amber-400" /> Tarvitsen lisää</h3>
              <button onClick={() => setTarveOpen(false)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            {materials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <button key={m.id} onClick={() => setTItem(m.name)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${tItem === m.name ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                    {m.name.length > 24 ? m.name.slice(0, 24) + '…' : m.name}
                  </button>
                ))}
              </div>
            )}
            <input type="text" placeholder="Tai kirjoita tuote, esim. Kiilto 2 Plus -liima" value={tItem} onChange={(e) => setTItem(e.target.value)} className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Määrä, esim. 60 m² / 20 l" value={tMaara} onChange={(e) => setTMaara(e.target.value)} className={inputCls} />
              <button onClick={() => setTKiire(!tKiire)}
                className={`flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${tKiire ? 'bg-red-500/20 text-red-300 border border-red-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                <AlertTriangle className="w-4 h-4" /> {tKiire ? 'KIIRE' : 'Ei kiire'}
              </button>
            </div>
            <input type="text" placeholder="Lisätiedot (valinnainen)" value={tLisatiedot} onChange={(e) => setTLisatiedot(e.target.value)} className={inputCls} />
            <button onClick={saveTarve} disabled={tarveSaving || !tItem.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40">
              <Check className="w-4 h-4" /> {tarveSaving ? 'Lähetetään…' : 'Lähetä työnjohdolle'}
            </button>
          </div>
        </div>
      )}

      {/* ===== KIRJAUKSEN MUOKKAUS ===== */}
      {editEntry && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setEditEntry(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><PenLine className="w-4 h-4 text-amber-400" /> Muokkaa kirjausta</h3>
              <button onClick={() => setEditEntry(null)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-400">{editEntry.description ?? editEntry.entry_type}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{editEntry.entry_type === 'tunti' ? 'Tunnit' : 'Määrä'}</label>
                <input type="text" inputMode="decimal" value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Päivä</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
              </div>
            </div>
            {editEntry.entry_type !== 'tunti' && editEntry.unit_price !== null && parseNum(editValue) > 0 && (
              <p className="text-sm text-amber-300 font-semibold">{editValue} × {eur(editEntry.unit_price)} = {eur(parseNum(editValue) * editEntry.unit_price)}</p>
            )}
            <button onClick={saveEntryEdit} disabled={editSaving}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40">
              <Check className="w-4 h-4" /> {editSaving ? 'Tallennetaan…' : 'Tallenna muutokset'}
            </button>
          </div>
        </div>
      )}

      {/* ===== TES SEARCH SHEET ===== */}
      {searchOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end" onClick={() => setSearchOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl flex flex-col" style={{ height: '88vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">TES-koodit</h3>
                <button onClick={() => setSearchOpen(false)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="relative mb-2.5">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input autoFocus type="text" placeholder="Hae koodilla tai nimellä…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => setCatFilter(null)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${!catFilter ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>Kaikki</button>
                {categories.map((c) => (
                  <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${catFilter === c ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>{c}</button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" /> Tähdellä ohjelmoit koodin pikanapiksi
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {!search.trim() && !catFilter && topCodes.length > 0 && (
                <>
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wide px-1 pt-1">Eniten käytetyt</p>
                  {topCodes.map((t) => (
                    <div key={`top-${t.id}`} className="flex items-center gap-2 bg-amber-500/10 border border-amber-900 rounded-xl px-3 py-2.5">
                      <button onClick={() => { setSelectedCode(t); setSelectedPkg(null); setSearchOpen(false); setUrakkaError(null) }} className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{t.code} · {t.description}</p>
                        <p className="text-xs text-gray-500">{eur(t.price)} / {t.unit}{t.category_name ? ` · ${t.category_name}` : ''}</p>
                      </button>
                      <button onClick={() => toggleFavorite(t.id)} aria-label="Pikanappi" className="p-2.5 shrink-0">
                        <Star className={`w-5 h-5 ${favIds.includes(t.id) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide px-1 pt-2">Kaikki koodit</p>
                </>
              )}
              {filteredCodes.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5">
                  <button onClick={() => { setSelectedCode(t); setSelectedPkg(null); setSearchOpen(false); setUrakkaError(null) }} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{t.code} · {t.description}</p>
                    <p className="text-xs text-gray-500">{eur(t.price)} / {t.unit}{t.category_name ? ` · ${t.category_name}` : ''}</p>
                  </button>
                  <button onClick={() => toggleFavorite(t.id)} aria-label="Pikanappi" className="p-2.5 shrink-0">
                    <Star className={`w-5 h-5 ${favIds.includes(t.id) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                  </button>
                </div>
              ))}
              {filteredCodes.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Ei osumia</p>}
            </div>
          </div>
        </div>
      )}

      {/* ===== PIKAVALINTAKIRJASTO ===== */}
      {pkgSheet === 'list' && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end" onClick={() => setPkgSheet(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl flex flex-col" style={{ maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-amber-400" /> Omat pikavalinnat</h3>
              <button onClick={() => setPkgSheet(null)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {packages.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-6">Ei vielä pikavalintoja. Luo ensimmäinen — esim. "Tekstiililaatta" jossa hionta + imurointi + laatta.</p>
              )}
              {packages.map((p) => (
                <div key={p.id} className="bg-gray-800/60 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {p.tes_code_ids.map((cid) => tesById.get(cid)?.code).filter(Boolean).join(' + ')}
                      </p>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button onClick={() => openPkgEditor(p, true)} aria-label="Käytä pohjana" title="Käytä pohjana" className="p-2.5 text-gray-500 hover:text-amber-400"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => openPkgEditor(p)} aria-label="Muokkaa" title="Muokkaa" className="p-2.5 text-gray-500 hover:text-white"><PenLine className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm(`Poistetaanko pikavalinta "${p.name}"?`)) deletePackage(p.id) }} aria-label="Poista" className="p-2.5 text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800">
              <button onClick={() => openPkgEditor()} className="w-full py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Uusi pikavalinta
              </button>
            </div>
          </div>
        </div>
      )}

      {pkgSheet === 'edit' && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-end" onClick={() => setPkgSheet('list')}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl flex flex-col" style={{ height: '88vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-amber-400" /> {editingPkgId ? 'Muokkaa pikavalintaa' : 'Uusi pikavalinta'}</h3>
                <button onClick={() => setPkgSheet('list')} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
              </div>
              <input type="text" placeholder="Nimi, esim. Tekstiililaatta" value={pkgName} onChange={(e) => setPkgName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2.5" />
              <div className="relative mb-2.5">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Hae ja lisää työvaiheita…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {pkgCodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pkgCodes.map((cid) => {
                    const t = tesById.get(cid)
                    return t ? (
                      <button key={cid} onClick={() => setPkgCodes((prev) => prev.filter((x) => x !== cid))} className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold flex items-center gap-1">
                        {t.code} <X className="w-3 h-3" />
                      </button>
                    ) : null
                  })}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredCodes.map((t) => (
                <button key={t.id} onClick={() => setPkgCodes((prev) => prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id])}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left ${pkgCodes.includes(t.id) ? 'bg-amber-500/15 border border-amber-700' : 'bg-gray-800/60'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.code} · {t.description}</p>
                    <p className="text-xs text-gray-500">{eur(t.price)} / {t.unit}</p>
                  </div>
                  {pkgCodes.includes(t.id) && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800">
              <button onClick={savePackage} disabled={!pkgName.trim() || pkgCodes.length === 0}
                className="w-full py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> {editingPkgId ? 'Tallenna muutokset' : 'Tallenna pikavalinta'} ({pkgCodes.length} työvaihetta)
              </button>
            </div>
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
