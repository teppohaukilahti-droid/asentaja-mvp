import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Clock, Trash2, RefreshCw, Calculator,
  Star, Search, X, Check, Plus, Layers, PenLine, FileText, Copy, FileSignature, ShoppingCart, AlertTriangle, Delete, Users, Archive, FolderOpen, Handshake, Camera, Home,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import TekijaValinta from '../components/TekijaValinta'
import { OMA_KAYTTO } from '../lib/tila'
import { tekijaMerkki } from '../lib/tyopari'
import type { Tekija } from '../lib/tyopari'
import { supabase } from '../lib/supabase'
import { today, eur, formatDate, parseNum, QUICK_HOURS, KUITATTAVA_TYPES, OMA_TYPES, isWeldingCode } from '../lib/helpers'
import { STATUS_LABEL, STATUS_STYLE, timeAgo } from '../lib/requests'
import { insertOrQueue } from '../lib/offline'
import type { MaterialRequest } from '../lib/requests'

type Worksite = { id: string; name: string; address: string | null; client_company: string | null; status: string }
type Material = { id: string; name: string; balance: number | null; unit: string | null }
type TesCode = { id: string; code: string; description: string; price: number; unit: string; category: number; category_name: string | null }
type Preset = { id: string; name: string; tes_code_ids: string[] }
type Erikoishinta = { id: string; kuvaus: string; price: number; unit: string }

type Entry = {
  id: string; entry_type: string; amount: number | null; hours: number | null
  unit_price: number | null; total_sum: number | null; description: string | null
  entry_date: string; tes_code_id: string | null; hour_category: string | null
  tekija?: string | null
  mittapoytakirja_id?: string | null
  mittapoytakirjat?: { status: string; numero: number } | null
}

const FAV_PRESET = 'pikavalinnat'

export default function WorksitePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  // Pelisäännöt: aloituspalaverissa sovitut asiat (näkyy kaikille, työnjohto muokkaa)
  type Pelisaannot = {
    aikataulu: string | null; tyhjennystahti: string | null; lastapuhtaus: string | null
    pohjatyot: string | null; haalaus: string | null; tuntikuittaus_vali_pv: number | null
    muuta: string | null; sovittu_pvm: string | null; updated_by_name: string | null
  }
  const [pelis, setPelis] = useState<Pelisaannot | null>(null)
  const [pelisOpen, setPelisOpen] = useState(false)
  const [pelisSaving, setPelisSaving] = useState(false)
  const [pf, setPf] = useState({
    aikataulu: '', tyhjennystahti: '', lastapuhtaus: '', pohjatyot: '', haalaus: '',
    vali: 0, muuta: '', sovittu: '',
  })
  const canLead = ['tyonjohtaja', 'johtaja'].includes(profile?.role ?? '')

  // Todistekuva: yksi nappi → kuva pilveen, kohdistettuna tähän työmaahan.
  // "Mikä tämä työ muka on?" -tilanteessa kuvat imuroidaan kuvaraporttiin Työmaakansiosta.
  const [todisteFile, setTodisteFile] = useState<File | null>(null)
  const [todisteHuom, setTodisteHuom] = useState('')
  const [todisteSaving, setTodisteSaving] = useState(false)

  async function saveTodiste() {
    if (!todisteFile || !id || !profile || !user || todisteSaving) return
    setTodisteSaving(true)
    const clean = todisteFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${profile.organization_id}/${id}/todiste_${Date.now()}_${clean}`
    const { error: upErr } = await supabase.storage.from('arkisto').upload(path, todisteFile)
    if (upErr) { setToast('Kuvan lähetys epäonnistui'); setTodisteSaving(false); return }
    await supabase.from('archive_items').insert({
      organization_id: profile.organization_id, worksite_id: id, tyyppi: 'kuva',
      otsikko: todisteHuom.trim() || `Työtodiste ${formatDate(today())}`,
      tags: ['todiste'], file_path: path, file_type: todisteFile.type,
      user_id: user.id, user_name: profile.full_name ?? '',
    })
    setToast('Todistekuva tallennettu pilveen')
    setTodisteFile(null); setTodisteHuom('')
    setTodisteSaving(false)
  }

  useEffect(() => {
    if (!id) return
    supabase.from('pelisaannot').select('*').eq('worksite_id', id).maybeSingle().then(({ data }) => {
      if (data) setPelis(data as Pelisaannot)
    })
     
  }, [id])

  function openPelisEdit() {
    setPf({
      aikataulu: pelis?.aikataulu ?? '', tyhjennystahti: pelis?.tyhjennystahti ?? '',
      lastapuhtaus: pelis?.lastapuhtaus ?? '', pohjatyot: pelis?.pohjatyot ?? '',
      haalaus: pelis?.haalaus ?? '', vali: pelis?.tuntikuittaus_vali_pv ?? 0,
      muuta: pelis?.muuta ?? '', sovittu: pelis?.sovittu_pvm ?? '',
    })
    setPelisOpen(true)
  }

  async function savePelis() {
    if (!id || !profile || pelisSaving) return
    setPelisSaving(true)
    const { error: upErr } = await supabase.from('pelisaannot').upsert({
      worksite_id: id, organization_id: profile.organization_id,
      aikataulu: pf.aikataulu.trim() || null, tyhjennystahti: pf.tyhjennystahti.trim() || null,
      lastapuhtaus: pf.lastapuhtaus || null, pohjatyot: pf.pohjatyot || null,
      haalaus: pf.haalaus || null, tuntikuittaus_vali_pv: pf.vali || null,
      muuta: pf.muuta.trim() || null, sovittu_pvm: pf.sovittu || null,
      updated_by: user?.id, updated_by_name: profile.full_name ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'worksite_id' })
    if (!upErr) {
      setPelisOpen(false)
      const { data } = await supabase.from('pelisaannot').select('*').eq('worksite_id', id).maybeSingle()
      if (data) setPelis(data as Pelisaannot)
    }
    setPelisSaving(false)
  }
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
  const [tSuunta, setTSuunta] = useState<'tarve' | 'nouto'>('tarve')
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
  const [matId, setMatId] = useState<string | null>(null)
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

  // Työkalut työmaalla
  const [siteTools, setSiteTools] = useState<{ id: string; name: string; numero: number }[]>([])

  // Palkanjako
  const [jakoOpen, setJakoOpen] = useState(false)
  const [jakoN, setJakoN] = useState(2)
  const [jakoTunnit, setJakoTunnit] = useState(true)
  const [jakoQr, setJakoQr] = useState<string | null>(null)
  const [jakoLink, setJakoLink] = useState<string | null>(null)
  const [jakoId, setJakoId] = useState<string | null>(null)
  const [jakoClaims, setJakoClaims] = useState<string[]>([])
  const [jakoCreating, setJakoCreating] = useState(false)
  const jakoPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Peukalokirjaus
  const [thumbSheet, setThumbSheet] = useState<null | 'urakka' | 'tunnit'>(null)
  const [thumbSel, setThumbSel] = useState<{ pkg?: Preset; code?: TesCode; special?: Erikoishinta } | null>(null)
  const [thumbVal, setThumbVal] = useState('')
  const [thumbSaving, setThumbSaving] = useState(false)
  const [thumbHaku, setThumbHaku] = useState('')
  // Peukalotunnit: kuitattava/oma-jako, lajivalinta ja saman session rivit
  const [thumbCat, setThumbCat] = useState<'kuitattava' | 'oma'>('kuitattava')
  const [thumbHourType, setThumbHourType] = useState<string | null>(null)
  const [thumbMuu, setThumbMuu] = useState('')
  const [thumbCustom, setThumbCustom] = useState('')
  const [thumbHourRows, setThumbHourRows] = useState<{ laji: string; tunnit: number; kuitattava: boolean; tekija: Tekija }[]>([])
  // Työpari: kenen työtä kirjaus on. Ilman työparia aina 'mina' (kuten ennenkin).
  const pariNimi = profile?.tyopari_nimi?.trim() || ''
  const [tekija, setTekija] = useState<Tekija>('molemmat')
  const tekijaNyt: Tekija = pariNimi ? tekija : 'mina'
  const [editTekija, setEditTekija] = useState<Tekija>('mina')

  // Työmaakohtaiset erikoishinnat (työnjohto sopii, asentaja kirjaa)
  const [erikoishinnat, setErikoishinnat] = useState<Erikoishinta[]>([])
  const [erikOpen, setErikOpen] = useState(false)
  const [eKuvaus, setEKuvaus] = useState('')
  const [eHinta, setEHinta] = useState('')
  const [eYksikko, setEYksikko] = useState('m²')
  const [eSaving, setESaving] = useState(false)
  const isLead = profile?.role === 'tyonjohtaja' || profile?.role === 'johtaja'

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    setError(null)

    const [siteRes, materialsRes, entriesRes, tesRes, presetRes, usageRes, reqRes, toolRes, erikRes] = await Promise.all([
      supabase.from('worksites').select('id, name, address, client_company, status').eq('id', id).single(),
      supabase.from('materials').select('id, name, balance, unit').eq('worksite_id', id).order('name'),
      supabase.from('entries').select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category, tekija, mittapoytakirja_id, mittapoytakirjat(status, numero)').eq('worksite_id', id).eq('user_id', user.id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('tes_codes').select('id, code, description, price, unit, category, category_name').eq('active', true).order('category').order('code'),
      supabase.from('presets').select('id, name, tes_code_ids').eq('user_id', user.id).eq('scope', 'personal'),
      supabase.from('entries').select('tes_code_id').eq('user_id', user.id).not('tes_code_id', 'is', null).limit(1000),
      supabase.from('material_requests').select('*').eq('worksite_id', id).eq('requested_by', user.id).neq('status', 'hylatty').order('created_at', { ascending: false }).limit(20),
      supabase.from('tools').select('id, name, numero').eq('worksite_id', id).eq('status', 'tyomaalla').order('name'),
      supabase.from('erikoishinnat').select('id, kuvaus, price, unit').eq('worksite_id', id).eq('active', true).order('created_at'),
    ])

    if (siteRes.error) {
      setError('Työmaan tietojen haku epäonnistui. Tarkista verkkoyhteys.')
      setLoading(false)
      return
    }

    setWorksite(siteRes.data)
    setMaterials(materialsRes.data ?? [])
    setEntries((entriesRes.data ?? []).map((e) => ({ ...e, amount: e.amount === null ? null : Number(e.amount), hours: e.hours === null ? null : Number(e.hours), unit_price: e.unit_price === null ? null : Number(e.unit_price), total_sum: e.total_sum === null ? null : Number(e.total_sum), mittapoytakirjat: e.mittapoytakirjat as unknown as Entry['mittapoytakirjat'] })))
    setTesCodes((tesRes.data ?? []).map((t) => ({ ...t, price: Number(t.price) })))
    setMyRequests((reqRes.data ?? []) as unknown as MaterialRequest[])
    setSiteTools(toolRes.data ?? [])
    setErikoishinnat(((erikRes.data ?? []) as Erikoishinta[]).map((e) => ({ ...e, price: Number(e.price) })))
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




  const vSumma = parseNum(vMaara) * parseNum(vHinta)
  // Työmaakohtaisen erikoishinnan lisäys ja poisto (vain työnjohto — RLS varmistaa)
  async function saveErikoishinta() {
    if (!user || !profile || !id || eSaving || !eKuvaus.trim() || !(parseNum(eHinta) > 0)) return
    setESaving(true)
    const { data, error: insErr } = await supabase.from('erikoishinnat').insert({
      organization_id: profile.organization_id, worksite_id: id,
      kuvaus: eKuvaus.trim(), price: parseNum(eHinta), unit: eYksikko,
      created_by: user.id, created_by_name: profile.full_name ?? '',
    }).select('id, kuvaus, price, unit').single()
    if (insErr || !data) {
      setToast('Tallennus epäonnistui')
    } else {
      setErikoishinnat((prev) => [...prev, { ...data, price: Number(data.price) }])
      setEKuvaus(''); setEHinta('')
      setToast('Erikoishinta lisätty — näkyy asentajien urakkavalinnassa')
    }
    setESaving(false)
  }

  async function deleteErikoishinta(eid: string) {
    const { error: delErr } = await supabase.from('erikoishinnat').delete().eq('id', eid)
    if (delErr) setToast('Poisto epäonnistui')
    else setErikoishinnat((prev) => prev.filter((x) => x.id !== eid))
  }

  async function saveVapaa(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id || !vKuvaus.trim() || !Number.isFinite(vSumma) || vSumma <= 0) return
    setVSaving(true)
    const vapaaRow = {
      user_id: user.id, worksite_id: id, entry_type: 'vapaa-urakka',
      amount: parseNum(vMaara), unit_price: parseNum(vHinta),
      total_sum: Math.round(vSumma * 100) / 100,
      description: `${vKuvaus.trim()} (${vYksikko})`, entry_date: today(),
      tekija: tekijaNyt,
    }
    if (!navigator.onLine) {
      await insertOrQueue('entries', vapaaRow)
      setVKuvaus(''); setVMaara(''); setVHinta(''); setVapaaOpen(false)
      setToast('Vapaa urakka tallennettu offline — lähetetään kun verkko palaa')
      setVSaving(false)
      return
    }
    const { data, error } = await supabase.from('entries').insert(vapaaRow)
      .select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category, tekija').single()
    if (!error && data) {
      setEntries((prev) => [{ ...data, amount: Number(data.amount), unit_price: Number(data.unit_price), total_sum: Number(data.total_sum), hours: null }, ...prev])
      setVKuvaus(''); setVMaara(''); setVHinta(''); setVapaaOpen(false)
      setToast('Vapaa urakka tallennettu')
    }
    setVSaving(false)
  }


  async function saveTarve() {
    if (!user || !id || !profile || !tItem.trim()) return
    setTarveSaving(true)
    // Noutopyyntö: ylijäämä/tavaran nouto pois työmaalta → varaston noutolistalle
    if (tSuunta === 'nouto') {
      const { error } = await supabase.from('noutopyynnot').insert({
        organization_id: profile.organization_id,
        worksite_id: id,
        requested_by: user.id,
        requester_name: profile.full_name ?? '',
        item_text: tItem.trim(),
        maara: tMaara.trim() || null,
        lisatiedot: tLisatiedot.trim() || null,
      })
      if (error) {
        setToast('Noutopyynnön lähetys epäonnistui')
      } else {
        setToast('Noutopyyntö lähetetty varastolle')
        setTarveOpen(false)
        setTItem(''); setTMaara(''); setTKiire(false); setTLisatiedot(''); setTSuunta('tarve')
      }
      setTarveSaving(false)
      return
    }
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

  // ── Palkanjako ──
  const jaettavat = useMemo(
    () => entries.filter((e) => e.entry_type !== 'tunti' && e.mittapoytakirjat?.status !== 'lukittu' && (e.total_sum ?? 0) > 0),
    [entries],
  )
  const jaettavaSumma = useMemo(() => jaettavat.reduce((s, e) => s + (e.total_sum ?? 0), 0), [jaettavat])
  const jaettavatTunnit = useMemo(
    () => entries.filter((e) => e.entry_type === 'tunti' && e.hour_category === 'kuitattava' && e.mittapoytakirjat?.status !== 'lukittu' && (e.hours ?? 0) > 0),
    [entries],
  )
  const jaettavatTunnitSumma = useMemo(() => jaettavatTunnit.reduce((s, e) => s + (e.hours ?? 0), 0), [jaettavatTunnit])

  async function createJako() {
    const shareEntries = [...jaettavat, ...(jakoTunnit ? jaettavatTunnit : [])]
    if (!user || !id || !profile || shareEntries.length === 0 || jakoCreating) return
    setJakoCreating(true)
    const { data: share, error } = await supabase.from('pay_shares').insert({
      organization_id: profile.organization_id, worksite_id: id, owner_id: user.id, n_members: jakoN,
      include_hours: jakoTunnit,
    }).select('id, token').single()
    if (error || !share) { setToast('Jaon luonti epäonnistui'); setJakoCreating(false); return }
    const { error: snapError } = await supabase.from('pay_share_entries').insert(
      shareEntries.map((e) => e.entry_type === 'tunti'
        ? { share_id: share.id, entry_id: e.id, original_hours: e.hours }
        : { share_id: share.id, entry_id: e.id, original_amount: e.amount, original_total: e.total_sum }),
    )
    if (snapError) { setToast('Jaon luonti epäonnistui'); setJakoCreating(false); return }
    const link = `${window.location.origin}/jaa?token=${share.token}`
    try {
      const QRCode = (await import('qrcode')).default
      setJakoQr(await QRCode.toDataURL(link, { width: 280, margin: 1, color: { dark: '#111827', light: '#ffffff' } }))
    } catch { /* linkki riittää */ }
    setJakoLink(link)
    setJakoId(share.id)
    setJakoCreating(false)
  }

  useEffect(() => {
    if (!jakoId) return
    const poll = async () => {
      const { data } = await supabase.from('pay_share_claims').select('user_name').eq('share_id', jakoId)
      const names = (data ?? []).map((c) => c.user_name ?? 'Työpari')
      setJakoClaims((prev) => {
        if (names.length !== prev.length) fetchAll()
        return names
      })
    }
    poll()
    jakoPollRef.current = setInterval(poll, 4000)
    return () => { if (jakoPollRef.current) clearInterval(jakoPollRef.current) }
  }, [jakoId, fetchAll])

  function closeJako() {
    setJakoOpen(false); setJakoQr(null); setJakoLink(null); setJakoId(null); setJakoClaims([])
    if (jakoPollRef.current) clearInterval(jakoPollRef.current)
  }

  // ── Peukalokirjaus ──
  const thumbNum = parseNum(thumbVal)
  const thumbValid = Number.isFinite(thumbNum) && thumbNum > 0
  const thumbSum = useMemo(() => {
    if (!thumbSel || !thumbValid) return 0
    if (thumbSel.special) return thumbNum * thumbSel.special.price
    if (thumbSel.code) return thumbNum * thumbSel.code.price
    if (thumbSel.pkg) {
      return thumbSel.pkg.tes_code_ids.reduce((s, cid) => {
        const tc = tesById.get(cid)
        if (!tc) return s
        const qty = isWeldingCode(tc.code) ? thumbNum * 0.5 : thumbNum
        return s + qty * tc.price
      }, 0)
    }
    return 0
  }, [thumbSel, thumbNum, thumbValid, tesById])

  function thumbPress(k: string) {
    if (k === 'back') { setThumbVal((v) => v.slice(0, -1)); return }
    if (k === ',') { setThumbVal((v) => (v.includes(',') || v === '' ? v : v + ',')); return }
    setThumbVal((v) => (v.length >= 7 ? v : v + k))
  }

  function closeThumb() {
    setThumbSheet(null); setThumbSel(null); setThumbVal(''); setThumbHaku('')
    setThumbHourType(null); setThumbMuu(''); setThumbCustom(''); setThumbHourRows([])
  }

  // Urakan haku nimikkeellä peukalonapissa
  const thumbResults = useMemo(() => {
    const q = thumbHaku.trim().toLowerCase()
    if (!q) return []
    return tesCodes.filter((t) => `${t.code} ${t.description}`.toLowerCase().includes(q)).slice(0, 8)
  }, [thumbHaku, tesCodes])

  // Eniten käytetyt peukalonappiin: omasta historiasta, suosikit pois tuplina.
  // Uudelle käyttäjälle (ei historiaa) näytetään listan alku, ettei näkymä ole tyhjä.
  const thumbTop = useMemo(() => {
    const t = topCodes.filter((c) => !favIds.includes(c.id)).slice(0, 6)
    return t.length > 0 ? t : tesCodes.slice(0, 6)
  }, [topCodes, favIds, tesCodes])

  // Valittu tuntilaji ("Muu" = itse kirjoitettu)
  const thumbLaji = thumbHourType === '__muu' ? thumbMuu.trim() : (thumbHourType ?? '')

  function thumbAddHourRow(h: number) {
    if (!thumbLaji || !Number.isFinite(h) || h <= 0) return
    setThumbHourRows((rows) => [...rows, { laji: thumbLaji, tunnit: h, kuitattava: thumbCat === 'kuitattava', tekija: tekijaNyt }])
    setThumbHourType(null); setThumbMuu(''); setThumbCustom('')
  }

  // Valmis: koko session tunnit kerralla kirjaan — ei paluuta välissä
  async function thumbSaveHourRows() {
    if (!user || !id || thumbSaving || thumbHourRows.length === 0) return
    setThumbSaving(true)
    const rows = thumbHourRows.map((r) => ({
      user_id: user.id, worksite_id: id, entry_type: 'tunti', hours: r.tunnit,
      description: r.laji, hour_category: r.kuitattava ? 'kuitattava' : 'oma', entry_date: today(),
      tekija: r.tekija,
    }))
    if (!navigator.onLine) {
      for (const row of rows) await insertOrQueue('entries', row)
      setToast(`${rows.length} tuntikirjausta tallennettu offline — lähetetään kun verkko palaa`)
      closeThumb()
      setThumbSaving(false)
      return
    }
    const { data, error } = await supabase.from('entries').insert(rows)
      .select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category, tekija')
    if (!error && data) {
      setEntries((prev) => [...data.map((e) => ({ ...e, hours: e.hours === null ? null : Number(e.hours), amount: null, unit_price: null, total_sum: null })), ...prev])
      setToast(`${data.length} tuntikirjausta tallennettu`)
      closeThumb()
    } else {
      setToast('Kirjaus epäonnistui — yritä uudelleen')
    }
    setThumbSaving(false)
  }

  async function thumbSaveUrakka() {
    if (!user || !id || !thumbSel || !thumbValid || thumbSaving) return
    setThumbSaving(true)
    let rows: Record<string, unknown>[] = []
    if (thumbSel.pkg) {
      rows = thumbSel.pkg.tes_code_ids.map((cid) => tesById.get(cid)).filter(Boolean).map((t) => {
        const tc = t as TesCode
        const qty = isWeldingCode(tc.code) ? thumbNum * 0.5 : thumbNum
        return {
          user_id: user.id, worksite_id: id, entry_type: 'urakka', tes_code_id: tc.id,
          amount: Math.round(qty * 100) / 100, unit_price: tc.price,
          total_sum: Math.round(qty * tc.price * 100) / 100,
          description: `${tc.code} ${tc.description}`, entry_date: today(),
          material_id: matId,
        }
      })
    } else if (thumbSel.special) {
      const sp = thumbSel.special
      rows = [{
        user_id: user.id, worksite_id: id, entry_type: 'vapaa-urakka',
        amount: thumbNum, unit_price: sp.price,
        total_sum: Math.round(thumbNum * sp.price * 100) / 100,
        description: `${sp.kuvaus} (${sp.unit})`, entry_date: today(),
        material_id: matId,
      }]
    } else if (thumbSel.code) {
      const tc = thumbSel.code
      rows = [{
        user_id: user.id, worksite_id: id, entry_type: 'urakka', tes_code_id: tc.id,
        amount: thumbNum, unit_price: tc.price,
        total_sum: Math.round(thumbNum * tc.price * 100) / 100,
        description: `${tc.code} ${tc.description}`, entry_date: today(),
        material_id: matId,
      }]
    }
    rows = rows.map((r) => ({ ...r, tekija: tekijaNyt }))
    if (!navigator.onLine) {
      for (const row of rows) await insertOrQueue('entries', row)
      setToast(`${rows.length} kirjaus${rows.length > 1 ? 'ta' : ''} tallennettu offline — lähetetään kun verkko palaa`)
      closeThumb()
      setThumbSaving(false)
      return
    }
    const { data, error } = await supabase.from('entries').insert(rows)
      .select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, tes_code_id, hour_category, tekija')
    if (!error && data) {
      setEntries((prev) => [...data.map((e) => ({ ...e, amount: e.amount === null ? null : Number(e.amount), hours: e.hours === null ? null : Number(e.hours), unit_price: e.unit_price === null ? null : Number(e.unit_price), total_sum: e.total_sum === null ? null : Number(e.total_sum) })), ...prev])
      await deductMaterial(thumbNum)
      setToast(`${data.length} kirjaus${data.length > 1 ? 'ta' : ''} tallennettu`)
      closeThumb()
    } else {
      setToast('Tallennus epäonnistui — yritä uudelleen')
    }
    setThumbSaving(false)
  }


  function openEntryEdit(entry: Entry) {
    if (entry.mittapoytakirjat?.status === 'lukittu') {
      setToast(`Hyväksytty pöytäkirjassa ${entry.mittapoytakirjat.numero} — kirjaus on lukittu`)
      return
    }
    setEditEntry(entry)
    setEditValue(String(entry.entry_type === 'tunti' ? (entry.hours ?? '') : (entry.amount ?? '')).replace('.', ','))
    setEditDate(entry.entry_date)
    setEditTekija((entry.tekija ?? 'mina') as Tekija)
  }

  async function saveEntryEdit() {
    if (!editEntry) return
    const v = parseNum(editValue)
    if (!Number.isFinite(v) || v <= 0) { setToast('Tarkista määrä'); return }
    setEditSaving(true)
    const patch: Record<string, unknown> = { entry_date: editDate, tekija: editTekija }
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
      setEntries((prev) => prev.map((e) => e.id === editEntry.id ? { ...e, entry_date: editDate, tekija: editTekija, hours: editEntry.entry_type === 'tunti' ? v : e.hours, amount: editEntry.entry_type !== 'tunti' ? v : e.amount, total_sum: editEntry.entry_type !== 'tunti' && editEntry.unit_price !== null ? Math.round(v * editEntry.unit_price * 100) / 100 : e.total_sum } : e))
      setToast('Kirjaus päivitetty')
      setEditEntry(null)
    }
    setEditSaving(false)
  }

  async function deleteEntry(entryId: string) {
    const entry = entries.find((e) => e.id === entryId)
    if (entry?.mittapoytakirjat?.status === 'lukittu') {
      setToast(`Hyväksytty pöytäkirjassa ${entry.mittapoytakirjat.numero} — kirjausta ei voi poistaa`)
      return
    }
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== entryId))
    else setToast('Poisto epäonnistui — kirjaus voi olla hyväksytyssä pöytäkirjassa')
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold truncate">{worksite?.name ?? 'Työmaa'}</h1>
          <div className="flex items-center gap-3">
            {worksite?.address && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(worksite.address)}`} target="_blank" rel="noreferrer" className="min-w-0 text-xs text-gray-400 underline decoration-gray-700 underline-offset-2">
                <span className="truncate block">{worksite.address}</span>
              </a>
            )}
            {siteTotal > 0 && <span className="text-xs font-semibold text-gray-200 tabular-nums shrink-0">{eur(siteTotal)}</span>}
          </div>
        </div>
        {!OMA_KAYTTO && (
        <label aria-label="Ota todistekuva" title="Ota todistekuva" className="ml-auto p-3 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0">
          <Camera className="w-5 h-5" />
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setTodisteFile(f); e.target.value = '' }} />
        </label>
        )}
      </header>

      {loading && (
        <div className="px-4 py-5 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="bg-gray-900 rounded-xl h-24 animate-pulse" />)}
        </div>
      )}

      {error && (
        <div className="m-4 bg-red-950/60 border border-red-900 rounded-xl p-4 space-y-3">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Yritä uudelleen
          </button>
        </div>
      )}

      {!loading && !error && worksite && (
        <main className="px-4 py-5 pb-32 space-y-7 max-w-md mx-auto">

          {/* ===== URAKKAKIRJAUS ===== */}
          {/* ===== TOIMINNOT: kirjaukset hoituvat alapalkin peukalonapeista, ===== */}
          {/* ===== tässä loput työmaan toimet isoina tekstinappeina ===== */}
          <section>
            <h2 className="text-base font-semibold mb-3">Toiminnot</h2>
            <div className="grid grid-cols-2 gap-2">
              {!OMA_KAYTTO && (
              <button onClick={() => { setTItem(''); setTarveOpen(true) }}
                className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                <ShoppingCart className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold leading-tight">Tilaa tavaraa</span>
              </button>
              )}
              {!OMA_KAYTTO && (
              <button onClick={() => navigate(`/mittaus?tyomaa=${id}`)}
                className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                <FileSignature className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold leading-tight">Mittaus-<br />pöytäkirja</span>
              </button>
              )}
              <button onClick={() => navigate(`/raportti?tyomaa=${id}`)}
                className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold leading-tight">Palkkalappu</span>
              </button>
              {!OMA_KAYTTO && (
              <button onClick={() => navigate(`/kansio?ws=${id}`)}
                className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                <FolderOpen className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold leading-tight">Työmaa-<br />kansio</span>
              </button>
              )}
              <button onClick={() => navigate(`/laskin?tyomaa=${id}`)}
                className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                <Calculator className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold leading-tight">Laskin+</span>
              </button>
              {!OMA_KAYTTO && (
              <button onClick={() => navigate(`/arkisto?ws=${id}`)}
                className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                <Archive className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold leading-tight">Arkisto</span>
              </button>
              )}
              {isLead && !OMA_KAYTTO && (
                <button onClick={() => setErikOpen(true)}
                  className="flex items-center gap-2.5 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3.5 hover:border-gray-700 transition-colors text-left">
                  <Star className="w-5 h-5 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold leading-tight">Erikoishinnat{erikoishinnat.length > 0 ? ` (${erikoishinnat.length})` : ''}</span>
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setSearch(''); setCatFilter(null); setSearchOpen(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-900 text-gray-300 border border-gray-800 hover:border-gray-700">
                <Star className="w-3.5 h-3.5" /> Ohjelmoi pikanapit
              </button>
              <button onClick={() => setPkgSheet('list')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-900 text-gray-300 border border-gray-800 hover:border-gray-700">
                <Layers className="w-3.5 h-3.5" /> Pikavalinnat
              </button>
            </div>

          </section>

          {/* ===== OMAT KIRJAUKSET ===== */}
          {entriesByDate.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">Omat kirjaukset</h2>
                {!OMA_KAYTTO && (jaettavat.length > 0 || jaettavatTunnit.length > 0) && (
                  <button onClick={() => setJakoOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-amber-300">
                    <Users className="w-4 h-4" /> Jaa palkka
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {entriesByDate.map((g) => (
                  <div key={g.date}>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">{formatDate(g.date)}</p>
                    <div className="space-y-1.5">
                      {g.items.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                          <button type="button" onClick={() => openEntryEdit(entry)} className="min-w-0 flex-1 text-left">
                            <p className="text-sm truncate">{entry.description ?? entry.entry_type}</p>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>
                                {entry.entry_type === 'tunti'
                                  ? `${String(entry.hours).replace('.', ',')} h · ${entry.hour_category === 'kuitattava' ? 'kuitattava' : 'Heikkinen'}`
                                  : `${String(entry.amount ?? '').replace('.', ',')}${entry.unit_price !== null ? ` × ${eur(entry.unit_price)}` : ' m²'}`}
                              </span>
                              {tekijaMerkki(entry.tekija, pariNimi) && <span className="text-gray-300">{tekijaMerkki(entry.tekija, pariNimi)}</span>}
                              {entry.mittapoytakirjat?.status === 'lukittu' && (
                                <span className="text-green-400">
                                  Hyväksytty
                                </span>
                              )}
                              {entry.mittapoytakirjat?.status === 'luonnos' && (
                                <span className="text-gray-400">
                                  pöytäkirjassa
                                </span>
                              )}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-sm font-semibold tabular-nums ${entry.entry_type === 'tunti' ? 'text-gray-400' : 'text-gray-100'}`}>
                              {entry.entry_type === 'tunti' ? eur((entry.hours ?? 0) * hourlyRate) : entry.total_sum !== null ? eur(entry.total_sum) : '–'}
                            </span>
                            {entry.mittapoytakirjat?.status === 'lukittu' ? (
                              <span className="p-2 text-green-500/60"><Check className="w-4 h-4" /></span>
                            ) : (
                              <button onClick={() => deleteEntry(entry.id)} aria-label="Poista" className="p-3 text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!OMA_KAYTTO && (<>
          {/* ===== PELISÄÄNNÖT (aloituspalaverissa sovittu) ===== */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Pelisäännöt</h2>
              {canLead && (
                <button onClick={openPelisEdit} className="text-xs font-semibold text-amber-400">
                  {pelis ? 'Muokkaa' : '+ Kirjaa sovitut'}
                </button>
              )}
            </div>
            {!pelis ? (
              <p className="text-gray-500 text-sm bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                Aloituspalaverin sopimuksia ei ole vielä kirjattu{canLead ? ' — kirjaa ne niin kaikki näkevät mitä on sovittu' : ''}.
              </p>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                {pelis.aikataulu && <p><span className="text-gray-500">Aikataulu:</span> {pelis.aikataulu}</p>}
                {pelis.tyhjennystahti && <p><span className="text-gray-500">Tyhjät tilat:</span> {pelis.tyhjennystahti}</p>}
                {pelis.lastapuhtaus && <p><span className="text-gray-500">Lasta-puhtaat tilat:</span> <b>{pelis.lastapuhtaus}</b></p>}
                {pelis.pohjatyot && <p><span className="text-gray-500">Pohjatyöt ja paikkaukset:</span> <b>{pelis.pohjatyot}</b></p>}
                {pelis.haalaus && <p><span className="text-gray-500">Haalaus:</span> <b>{pelis.haalaus}</b></p>}
                {pelis.tuntikuittaus_vali_pv && <p><span className="text-gray-500">Tuntien kuittaus mestarilla:</span> {pelis.tuntikuittaus_vali_pv} pv välein <span className="text-gray-600">(äppi muistuttaa)</span></p>}
                {pelis.muuta && <p><span className="text-gray-500">Muuta:</span> {pelis.muuta}</p>}
                <p className="text-[11px] text-gray-600 pt-1">
                  {pelis.sovittu_pvm ? `Sovittu ${formatDate(pelis.sovittu_pvm)}` : ''}{pelis.updated_by_name ? ` · kirjannut ${pelis.updated_by_name}` : ''}
                </p>
              </div>
            )}
          </section>

          {/* ===== MATERIAALIT ===== */}
          <section>
            <h2 className="text-base font-semibold mb-3">Materiaalit</h2>
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
              <p className="text-xs text-gray-500 mt-3">
                Tilaaja: {worksite.client_company}
              </p>
            )}
          </section>

          {/* ===== TYÖKALUT TYÖMAALLA ===== */}
          {siteTools.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Työkalut työmaalla</h2>
              <button onClick={() => navigate(`/tyokalut?tyomaa=${id}`)}
                className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-colors">
                <p className="text-sm">{siteTools.map((t) => `${t.name} #${t.numero}`).join(', ')}</p>
                <p className="text-xs text-gray-500 mt-1">{siteTools.length} työkalua · napauta siirtääksesi tai katsoaksesi</p>
              </button>
            </section>
          )}

          {/* ===== OMAT TARVEPYYNNÖT (tilaus tehdään Toiminnot-napista) ===== */}
          <section>
            {myRequests.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-sm font-medium text-gray-500">Omat tarvepyynnöt</p>
                {myRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{r.item_text}{r.maara ? ` · ${r.maara}` : ''}{r.kiire ? ' — kiire' : ''}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{timeAgo(r.created_at)}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          </>)}
        </main>
      )}

      {/* ===== VAPAA URAKKA (harvinainen — avataan urakkavalinnan pohjalta) ===== */}
      {vapaaOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setVapaaOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><PenLine className="w-4 h-4 text-amber-400" /> Vapaa urakka</h3>
              <button onClick={() => setVapaaOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveVapaa} className="space-y-4">
              {pariNimi && <TekijaValinta value={tekija} onChange={setTekija} pariNimi={pariNimi} />}
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
                className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 transition-colors">
                {vSaving ? 'Tallennetaan…' : 'Kirjaa vapaa urakka'}
              </button>
            </form>
            {isLead && !OMA_KAYTTO && (
              <p className="text-[11px] text-gray-600">Vinkki: jos sama erikoistyö toistuu tällä työmaalla, tee siitä Erikoishinta Toiminnot-napista — se ilmestyy asentajien urakkavalintaan valmiina.</p>
            )}
          </div>
        </div>
      )}

      {/* ===== ERIKOISHINNAT (työnjohto): työmaakohtainen hinnasto ===== */}
      {erikOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setErikOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Tämän työmaan erikoishinnat</h3>
              <button onClick={() => setErikOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">Erikseen sovittu työ ja hinta, joka on käytössä vain tällä työmaalla. Näkyy asentajien urakkavalinnassa omana osionaan. Hinnan poisto ei muuta jo tehtyjä kirjauksia.</p>

            {erikoishinnat.map((sp) => (
              <div key={sp.id} className="flex items-center justify-between gap-2 bg-gray-800/60 border border-gray-700 rounded-xl px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{sp.kuvaus}</span>
                  <span className="block text-xs text-gray-500">{eur(sp.price)} / {sp.unit}</span>
                </span>
                <button onClick={() => deleteErikoishinta(sp.id)} aria-label="Poista" className="p-3 text-gray-600 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {erikoishinnat.length === 0 && <p className="text-sm text-gray-500">Ei vielä erikoishintoja tällä työmaalla.</p>}

            <div className="border-t border-gray-800 pt-3 space-y-3">
              <input type="text" value={eKuvaus} onChange={(e) => setEKuvaus(e.target.value)}
                placeholder="Työn kuvaus (esim. Portaiden erikoislistoitus)" className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" inputMode="decimal" value={eHinta} onChange={(e) => setEHinta(e.target.value)}
                  placeholder="á-hinta €" className={inputCls} />
                <select value={eYksikko} onChange={(e) => setEYksikko(e.target.value)} className={inputCls}>
                  {['m²', 'jm', 'kpl', 'h', 'pv'].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={saveErikoishinta} disabled={eSaving || !eKuvaus.trim() || !(parseNum(eHinta) > 0)}
                className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> {eSaving ? 'Tallennetaan…' : 'Lisää erikoishinta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PALKANJAKO-SHEET ===== */}
      {jakoOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={closeJako}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /> Jaa palkka porukalle</h3>
              <button onClick={closeJako} aria-label="Sulje" title="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            {!jakoLink ? (
              <>
                <p className="text-sm text-gray-400">
                  Jaetaan tämän työmaan vapaat urakkakirjaukset tasan porukalle. Jokainen työpari imuroi oman osuutensa QR-koodilla omalla puhelimellaan. Tunnit jokainen kirjaa itse.
                </p>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Montako miestä porukassa (sinä mukaan lukien)?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map((n) => (
                      <button key={n} onClick={() => setJakoN(n)}
                        className={`py-3.5 rounded-xl text-base font-bold transition-colors ${jakoN === n ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                        {n} miestä
                      </button>
                    ))}
                  </div>
                </div>
                {jaettavatTunnit.length > 0 && (
                  <button onClick={() => setJakoTunnit((v) => !v)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${jakoTunnit ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300' : 'bg-gray-800 border border-gray-700 text-gray-400'}`}>
                    {jakoTunnit ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    Jaa myös kuitatut tunnit ({String(Math.round(jaettavatTunnitSumma * 100) / 100).replace('.', ',')} h)
                  </button>
                )}
                {jakoTunnit && jaettavatTunnit.length > 0 && (
                  <p className="text-xs text-gray-500">Tunnit siirtyvät tunteina — jokainen saa niistä palkan omalla tuntipalkallaan.</p>
                )}
                <div className="bg-gray-800 rounded-xl p-4 space-y-1.5 text-sm">
                  <p className="flex justify-between"><span className="text-gray-400">Urakat</span><span className="font-semibold">{jaettavat.length} kpl · {eur(jaettavaSumma)}</span></p>
                  {jakoTunnit && jaettavatTunnit.length > 0 && (
                    <p className="flex justify-between"><span className="text-gray-400">Kuitatut tunnit</span><span className="font-semibold">{String(Math.round(jaettavatTunnitSumma * 100) / 100).replace('.', ',')} h</span></p>
                  )}
                  <p className="flex justify-between border-t border-gray-700 pt-1.5">
                    <span className="text-gray-400">Osuus / mies ({Math.round(10000 / jakoN) / 100} %)</span>
                    <span className="font-bold text-green-400">
                      {eur(jaettavaSumma / jakoN)}
                      {jakoTunnit && jaettavatTunnit.length > 0 && ` + ${String(Math.round((jaettavatTunnitSumma / jakoN) * 100) / 100).replace('.', ',')} h`}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-gray-500">Hyväksytyt (lukitut) kirjaukset eivät ole mukana jaossa. Jako vanhenee 24 tunnissa.</p>
                <button onClick={createJako} disabled={jakoCreating || (jaettavat.length === 0 && !(jakoTunnit && jaettavatTunnit.length > 0))}
                  className="w-full py-4 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40">
                  {jakoCreating ? 'Luodaan…' : 'Luo jako ja näytä QR'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400">
                  Työpari: kirjaudu FloorDataiin omalla puhelimellasi ja skannaa tämä koodi kameralla — osuus siirtyy suoraan omiin kirjauksiisi.
                </p>
                {jakoQr && (
                  <div className="bg-white rounded-xl p-4 flex justify-center">
                    <img src={jakoQr} alt="Palkanjaon QR-koodi" className="w-full max-w-[260px]" />
                  </div>
                )}
                <button onClick={() => { navigator.clipboard?.writeText(jakoLink); setToast('Linkki kopioitu') }}
                  className="w-full py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" /> Kopioi linkki
                </button>
                <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Imuroinnit ({jakoClaims.length}/{jakoN - 1})</p>
                  {jakoClaims.length === 0 ? (
                    <p className="text-sm text-gray-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Odotetaan työparia…</p>
                  ) : (
                    jakoClaims.map((n, i) => (
                      <p key={i} className="text-sm flex items-center gap-2 text-green-400"><Check className="w-4 h-4" /> {n} imuroi osuutensa</p>
                    ))
                  )}
                </div>
                {jakoClaims.length >= jakoN - 1 && (
                  <p className="text-sm font-semibold text-green-400 text-center">Jako valmis — kaikki osuudet imuroitu</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== TARVE-SHEET ===== */}
      {tarveOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setTarveOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-amber-400" /> {tSuunta === 'tarve' ? 'Tarvitsen lisää' : 'Nouto pois työmaalta'}</h3>
              <button onClick={() => setTarveOpen(false)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTSuunta('tarve')}
                className={`py-2.5 rounded-xl text-sm font-semibold ${tSuunta === 'tarve' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Tarvitsen lisää
              </button>
              <button onClick={() => setTSuunta('nouto')}
                className={`py-2.5 rounded-xl text-sm font-semibold ${tSuunta === 'nouto' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Nouto varastoon
              </button>
            </div>
            {materials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <button key={m.id} onClick={() => setTItem(m.name)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${tItem === m.name ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                    {m.name.length > 24 ? m.name.slice(0, 24) + '…' : m.name}
                  </button>
                ))}
              </div>
            )}
            <input type="text" placeholder={tSuunta === 'tarve' ? 'Tai kirjoita tuote, esim. Kiilto 2 Plus -liima' : 'Mitä noudetaan, esim. ylijäämämatto'} value={tItem} onChange={(e) => setTItem(e.target.value)} className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Määrä, esim. 60 m² / 20 l" value={tMaara} onChange={(e) => setTMaara(e.target.value)} className={inputCls} />
              {tSuunta === 'tarve' ? (
                <button onClick={() => setTKiire(!tKiire)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${tKiire ? 'bg-red-500/20 text-red-300 border border-red-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                  <AlertTriangle className="w-4 h-4" /> {tKiire ? 'KIIRE' : 'Ei kiire'}
                </button>
              ) : (
                <div className="flex items-center justify-center rounded-xl text-xs text-gray-500 bg-gray-800/50 border border-gray-800 px-2 text-center">
                  Varasto noutaa listansa mukaan
                </div>
              )}
            </div>
            <input type="text" placeholder={tSuunta === 'tarve' ? 'Lisätiedot (valinnainen)' : 'Missä tavara on? (esim. sosiaalitilan vieressä)'} value={tLisatiedot} onChange={(e) => setTLisatiedot(e.target.value)} className={inputCls} />
            <button onClick={saveTarve} disabled={tarveSaving || !tItem.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40">
              <Check className="w-4 h-4" /> {tarveSaving ? 'Lähetetään…' : tSuunta === 'tarve' ? 'Lähetä työnjohdolle' : 'Lähetä noutopyyntö varastolle'}
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
              <button onClick={() => setEditEntry(null)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
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
            {pariNimi && (
              <div>
                <p className="text-sm text-gray-400 mb-1.5">Kenen työtä</p>
                <TekijaValinta value={editTekija} onChange={setEditTekija} pariNimi={pariNimi} />
              </div>
            )}
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
                <button onClick={() => setSearchOpen(false)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="relative mb-2.5">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input autoFocus type="text" placeholder="Hae koodilla tai nimellä…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => setCatFilter(null)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${!catFilter ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>Kaikki</button>
                {categories.map((c) => (
                  <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${catFilter === c ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>{c}</button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" /> Tähdellä ohjelmoit koodin pikanapiksi
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {!search.trim() && !catFilter && topCodes.length > 0 && (
                <>
                  <p className="text-sm font-medium text-gray-400 px-1 pt-1">Eniten käytetyt</p>
                  {topCodes.map((t) => (
                    <div key={`top-${t.id}`} className="flex items-center gap-2 bg-amber-500/10 border border-amber-900 rounded-xl px-3 py-2.5">
                      <button onClick={() => { setThumbSel({ code: t }); setThumbVal(''); setThumbSheet('urakka'); setSearchOpen(false) }} className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{t.code} · {t.description}</p>
                        <p className="text-xs text-gray-500">{eur(t.price)} / {t.unit}{t.category_name ? ` · ${t.category_name}` : ''}</p>
                      </button>
                      <button onClick={() => toggleFavorite(t.id)} aria-label="Pikanappi" className="p-3 shrink-0">
                        <Star className={`w-5 h-5 ${favIds.includes(t.id) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                      </button>
                    </div>
                  ))}
                  <p className="text-sm font-medium text-gray-600 px-1 pt-2">Kaikki koodit</p>
                </>
              )}
              {filteredCodes.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5">
                  <button onClick={() => { setThumbSel({ code: t }); setThumbVal(''); setThumbSheet('urakka'); setSearchOpen(false) }} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{t.code} · {t.description}</p>
                    <p className="text-xs text-gray-500">{eur(t.price)} / {t.unit}{t.category_name ? ` · ${t.category_name}` : ''}</p>
                  </button>
                  <button onClick={() => toggleFavorite(t.id)} aria-label="Pikanappi" className="p-3 shrink-0">
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
              <button onClick={() => setPkgSheet(null)} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
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
                      <button onClick={() => openPkgEditor(p, true)} aria-label="Käytä pohjana" title="Käytä pohjana" className="p-3 text-gray-500 hover:text-amber-400"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => openPkgEditor(p)} aria-label="Muokkaa" title="Muokkaa" className="p-3 text-gray-500 hover:text-white"><PenLine className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm(`Poistetaanko pikavalinta "${p.name}"?`)) deletePackage(p.id) }} aria-label="Poista" className="p-3 text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={() => setPkgSheet('list')} className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
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

      {/* ── Peukalopalkki ── */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-gray-900/95 backdrop-blur border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-md mx-auto flex gap-2 p-2">
          <button onClick={() => navigate('/')} aria-label="Etusivu" title="Etusivu"
            className="h-14 w-14 shrink-0 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 active:scale-95 transition-transform">
            <Home className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setThumbSheet('urakka'); setThumbSel(null); setThumbVal('') }}
            className="h-14 flex-1 rounded-xl bg-amber-500 text-gray-950 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" /> Urakka
          </button>
          <button
            onClick={() => setThumbSheet('tunnit')}
            className="h-14 flex-1 rounded-xl bg-gray-800 border border-gray-700 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Clock className="w-5 h-5" /> Tunnit
          </button>
        </div>
      </div>

      {/* Peukalokirjaus: urakka */}
      {thumbSheet === 'urakka' && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={closeThumb}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
            {!thumbSel ? (
              <div className="p-4 pb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-400">Valitse työ</p>
                  <button onClick={closeThumb} aria-label="Sulje" title="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="search" value={thumbHaku} onChange={(e) => setThumbHaku(e.target.value)}
                    placeholder="Hae urakka nimikkeellä tai koodilla…"
                    className="w-full pl-9 pr-3 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                {thumbHaku.trim() ? (
                  <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
                    {thumbResults.map((t) => (
                      <button key={t.id} onClick={() => { setThumbSel({ code: t }); setThumbHaku('') }}
                        className="w-full px-3.5 py-3 rounded-xl bg-gray-800 text-left text-sm active:scale-95 transition-transform">
                        <b>{t.code}</b> {t.description} <span className="text-gray-500">· {eur(t.price)}/{t.unit}</span>
                      </button>
                    ))}
                    {thumbResults.length === 0 && <p className="text-sm text-gray-500">Ei osumia haulla "{thumbHaku}".</p>}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[52vh] overflow-y-auto">
                    {erikoishinnat.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-amber-400/90">Tämän työmaan erikoishinnat</p>
                        <div className="grid grid-cols-2 gap-2">
                          {erikoishinnat.map((sp) => (
                            <button key={sp.id} onClick={() => setThumbSel({ special: sp })}
                              className="min-h-16 p-3 rounded-xl bg-gray-800 border border-amber-500/50 text-left active:scale-95 transition-transform">
                              <span className="block text-sm font-bold text-amber-300 leading-tight line-clamp-2">{sp.kuvaus}</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5">{eur(sp.price)}/{sp.unit}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {packages.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-gray-500">Pikavalinnat</p>
                        <div className="grid grid-cols-2 gap-2">
                          {packages.map((p) => (
                            <button key={p.id} onClick={() => setThumbSel({ pkg: p })}
                              className="min-h-16 p-3 rounded-xl bg-gray-800 border border-gray-700 text-left active:scale-95 transition-transform">
                              <span className="block text-sm font-bold text-amber-300 leading-tight">{p.name}</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5">{p.tes_code_ids.length} työvaihetta</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {favorites.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-gray-500">Suosikit</p>
                        <div className="grid grid-cols-2 gap-2">
                          {favorites.map((t) => (
                            <button key={t.id} onClick={() => setThumbSel({ code: t })}
                              className="min-h-16 p-3 rounded-xl bg-gray-800 border border-gray-700 text-left active:scale-95 transition-transform">
                              <span className="block text-sm font-bold leading-tight">{t.code}</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5 line-clamp-2">{t.description}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {thumbTop.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-gray-500">Eniten käytetyt</p>
                        <div className="grid grid-cols-2 gap-2">
                          {thumbTop.map((t) => (
                            <button key={t.id} onClick={() => setThumbSel({ code: t })}
                              className="min-h-16 p-3 rounded-xl bg-gray-800 border border-gray-700 text-left active:scale-95 transition-transform">
                              <span className="block text-sm font-bold leading-tight">{t.code}</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5 line-clamp-2">{t.description}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button onClick={() => { closeThumb(); setVapaaOpen(true) }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-900 text-gray-300 border border-gray-800 hover:border-gray-700">
                  <PenLine className="w-3.5 h-3.5" /> Vapaa urakka — kertaluontoinen sovittu hinta
                </button>
              </div>
            ) : (
              <div className="p-4 pb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => { setThumbSel(null); setThumbVal('') }} className="flex items-center gap-1 text-sm text-gray-400 py-1 pr-2">
                    <ArrowLeft className="w-4 h-4" /> Vaihda
                  </button>
                  <span className="text-sm font-bold text-amber-300 truncate max-w-[60%]">
                    {thumbSel.pkg ? thumbSel.pkg.name : thumbSel.code ? thumbSel.code.code : thumbSel.special!.kuvaus}
                  </span>
                </div>
                {materials.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    <button onClick={() => setMatId(null)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${matId === null ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                      Ei vähennystä
                    </button>
                    {materials.map((m) => (
                      <button key={m.id} onClick={() => setMatId(m.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${matId === m.id ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                {pariNimi && <TekijaValinta value={tekija} onChange={setTekija} pariNimi={pariNimi} />}
                <div className="flex items-baseline justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <span className="text-3xl font-bold tabular-nums">
                    {thumbVal || '0'}
                    <span className="text-base font-semibold text-gray-400 ml-1.5">{thumbSel.code?.unit ?? thumbSel.special?.unit ?? 'm²'}</span>
                  </span>
                  {thumbValid && <span className="text-lg font-semibold tabular-nums">{eur(thumbSum)}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', 'back'].map((k) => (
                    <button key={k} onClick={() => thumbPress(k)}
                      className="h-14 rounded-xl bg-gray-800 text-2xl font-bold flex items-center justify-center active:bg-gray-700 active:scale-95 transition-all">
                      {k === 'back' ? <Delete className="w-6 h-6" /> : k}
                    </button>
                  ))}
                </div>
                <button onClick={thumbSaveUrakka} disabled={!thumbValid || thumbSaving}
                  className="w-full h-16 rounded-xl bg-amber-500 text-gray-950 text-lg font-bold disabled:opacity-40 active:scale-95 transition-all">
                  {thumbSaving ? 'Tallennetaan…' : thumbValid ? `Tallenna ${eur(thumbSum)}` : 'Tallenna'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Peukalokirjaus: tunnit — koko päivän tunnit yhdellä sessiolla, Valmis kirjaa kaikki */}
      {thumbSheet === 'tunnit' && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={closeThumb}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-400">Tuntikirjaus</p>
              <button onClick={closeThumb} aria-label="Sulje" title="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            {pariNimi && <TekijaValinta value={tekija} onChange={setTekija} pariNimi={pariNimi} />}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setThumbCat('kuitattava'); setThumbHourType(null); setThumbMuu('') }}
                className={`py-3 rounded-xl text-sm font-bold ${thumbCat === 'kuitattava' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Kuitattavat
              </button>
              <button onClick={() => { setThumbCat('oma'); setThumbHourType(null); setThumbMuu('') }}
                className={`py-3 rounded-xl text-sm font-bold ${thumbCat === 'oma' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Heikkisen tunnit
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(thumbCat === 'kuitattava' ? KUITATTAVA_TYPES : OMA_TYPES).map((t) => (
                <button key={t} onClick={() => { setThumbHourType(t); setThumbMuu('') }}
                  className={`py-3 rounded-xl text-[13px] font-semibold transition-colors ${thumbHourType === t ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-200'}`}>
                  {t}
                </button>
              ))}
              <button onClick={() => setThumbHourType('__muu')}
                className={`py-3 rounded-xl text-[13px] font-semibold transition-colors ${thumbHourType === '__muu' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-200'}`}>
                Muu…
              </button>
            </div>

            {thumbHourType === '__muu' && (
              <input type="text" value={thumbMuu} onChange={(e) => setThumbMuu(e.target.value)} autoFocus
                placeholder="Kirjoita itse (esim. Palaveri)"
                className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            )}

            {thumbLaji !== '' && (
              <>
                <p className="text-sm font-semibold text-gray-400">{thumbLaji} — montako tuntia?</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_HOURS.map((q) => (
                    <button key={q} onClick={() => thumbAddHourRow(parseNum(q))}
                      className="h-14 rounded-xl bg-gray-800 border border-gray-700 text-xl font-bold active:bg-amber-500 active:text-gray-950 active:scale-95 transition-all">
                      {q} h
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" inputMode="decimal" value={thumbCustom} onChange={(e) => setThumbCustom(e.target.value)}
                    placeholder="Tai kirjoita tunnit itse (esim. 5,5)"
                    className="flex-1 px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <button onClick={() => thumbAddHourRow(parseNum(thumbCustom))}
                    disabled={!Number.isFinite(parseNum(thumbCustom)) || parseNum(thumbCustom) <= 0}
                    className="px-5 rounded-xl bg-gray-700 text-sm font-bold disabled:opacity-40">
                    Lisää
                  </button>
                </div>
              </>
            )}

            {thumbHourRows.length > 0 && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-1.5">
                {thumbHourRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {String(r.tunnit).replace('.', ',')} h · {r.laji} <span className="text-gray-500">({r.kuitattava ? 'kuitattava' : 'Heikkinen'}{tekijaMerkki(r.tekija, pariNimi) ? `, ${tekijaMerkki(r.tekija, pariNimi)}` : ''})</span>
                    </span>
                    <button onClick={() => setThumbHourRows((rows) => rows.filter((_, j) => j !== i))}
                      aria-label="Poista rivi" className="p-1.5 text-gray-600 hover:text-red-400 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="border-t border-gray-700 pt-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Yhteensä</span>
                  <b className="tabular-nums">{String(thumbHourRows.reduce((s, r) => s + r.tunnit, 0)).replace('.', ',')} h</b>
                </div>
              </div>
            )}

            <button onClick={thumbSaveHourRows} disabled={thumbHourRows.length === 0 || thumbSaving}
              className="w-full h-14 rounded-xl bg-amber-500 text-gray-950 text-base font-bold disabled:opacity-40 active:scale-95 transition-all">
              {thumbSaving ? 'Kirjataan…' : thumbHourRows.length === 0 ? 'Valitse laji ja tunnit' : `Valmis — kirjaa ${thumbHourRows.length} rivi${thumbHourRows.length > 1 ? 'ä' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Todistekuvan tallennus */}
      {todisteFile && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setTodisteFile(null)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4 text-amber-400" /> Todistekuva</h3>
              <button onClick={() => setTodisteFile(null)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <img src={URL.createObjectURL(todisteFile)} alt="Todistekuva" className="w-full max-h-64 object-contain rounded-xl bg-gray-950" />
            <input type="text" value={todisteHuom} onChange={(e) => setTodisteHuom(e.target.value)}
              placeholder="Mitä kuvassa on? (esim. Pohjatyö 2. krs käytävä)"
              className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <button onClick={saveTodiste} disabled={todisteSaving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {todisteSaving ? 'Tallennetaan…' : 'Tallenna pilveen'}
            </button>
            <p className="text-[11px] text-gray-600">Kuva tallentuu arkistoon tälle työmaalle nimelläsi ja aikaleimalla. Kuvaraportti kootaan Työmaakansiosta.</p>
          </div>
        </div>
      )}

      {/* Pelisääntöjen muokkaus (työnjohto) */}
      {pelisOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setPelisOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Handshake className="w-4 h-4 text-amber-400" /> Aloituspalaverissa sovittu</h3>
              <button onClick={() => setPelisOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <input type="text" value={pf.aikataulu} onChange={(e) => setPf({ ...pf, aikataulu: e.target.value })}
              placeholder="Aikataulu (esim. krs 1–2 vko 34, luovutus 12.9.)"
              className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <input type="text" value={pf.tyhjennystahti} onChange={(e) => setPf({ ...pf, tyhjennystahti: e.target.value })}
              placeholder="Tyhjennetty tila / päivä (esim. 2 huonetta/pv edellä)"
              className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />

            {([['lastapuhtaus', 'Lasta-puhtaat tilat'], ['pohjatyot', 'Pohjatyöt ja paikkaukset'], ['haalaus', 'Haalaus']] as const).map(([key, label]) => (
              <div key={key}>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">{label} — kenelle kuuluu?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Asentajalle', 'Rakennusliikkeelle'].map((v) => (
                    <button key={v} onClick={() => setPf({ ...pf, [key]: pf[key] === v ? '' : v })}
                      className={`py-2.5 rounded-xl text-xs font-semibold ${pf[key] === v ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-xs font-semibold text-gray-500">Tuntitöiden kuittaus mestarilla — kuinka usein?</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 3, 7, 14].map((v) => (
                <button key={v} onClick={() => setPf({ ...pf, vali: v })}
                  className={`py-2.5 rounded-xl text-xs font-semibold ${pf.vali === v ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {v === 0 ? 'Ei sovittu' : `${v} pv`}
                </button>
              ))}
            </div>
            {pf.vali > 0 && <p className="text-[11px] text-gray-600">Äppi muistuttaa vastaavaa työnjohtajaa kuittauksesta {pf.vali} päivän välein (arkiaamuisin klo 8).</p>}

            <textarea value={pf.muuta} onChange={(e) => setPf({ ...pf, muuta: e.target.value })} rows={2}
              placeholder="Muut sovitut asiat (jätteet, varastointi, avaimet…)"
              className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Aloituspalaverin päivämäärä</p>
              <input type="date" value={pf.sovittu} onChange={(e) => setPf({ ...pf, sovittu: e.target.value })}
                className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>

            <button onClick={savePelis} disabled={pelisSaving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {pelisSaving ? 'Tallennetaan…' : 'Tallenna pelisäännöt'}
            </button>
            <p className="text-[11px] text-gray-600">Pelisäännöt näkyvät kaikille työmaan sivulla — kukaan ei enää arvaile mitä palaverissa sovittiin.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
