import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, RefreshCw, Package, Building2, ChevronRight, Check, X, Truck, Warehouse,
  UserCheck, Copy as CopyIcon, Share2, AlertTriangle, ClipboardList, MapPin,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, FORWARD_LABEL, timeAgo, buildOrderMessage } from '../lib/requests'
import type { MaterialRequest } from '../lib/requests'

type WorksiteRow = { id: string; name: string; address: string | null; client_company: string | null }

export default function TyonjohtajaHome() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'tarpeet' | 'tyomaat'>('tarpeet')
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [worksites, setWorksites] = useState<WorksiteRow[]>([])
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
    const [reqRes, siteRes] = await Promise.all([
      supabase.from('material_requests')
        .select('*, worksites(name, address, client_company), requester:profiles!material_requests_requested_by_fkey(full_name)')
        .order('kiire', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('worksites').select('id, name, address, client_company').eq('status', 'active').order('name'),
    ])
    if (reqRes.error || siteRes.error) {
      setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setRequests((reqRes.data ?? []) as unknown as MaterialRequest[])
      setWorksites(siteRes.data ?? [])
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
  const inProgress = useMemo(() => requests.filter((r) => r.status === 'hyvaksytty' || r.status === 'tilattu'), [requests])
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
        {r.status === 'tilattu' && (
          <button onClick={() => updateRequest(r, { status: 'toimitettu', delivered_at: new Date().toISOString() } as never, 'Merkitty toimitetuksi')} className={`${btn} bg-green-500/20 text-green-300 hover:bg-green-500/30 w-full mt-3`}>
            <Check className="w-4 h-4" /> Merkitse toimitetuksi
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">ProFloor</h1>
          <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wide -mt-0.5">Työnjohto</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{profile?.full_name}</span>
          <button onClick={signOut} aria-label="Kirjaudu ulos" className="p-2.5 -m-1 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex border-b border-gray-800">
        <button onClick={() => setTab('tarpeet')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'tarpeet' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Package className="w-4 h-4" /> Tarpeet
          {open.length > 0 && <span className="bg-amber-500 text-gray-950 text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px]">{open.length}</span>}
        </button>
        <button onClick={() => setTab('tyomaat')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab === 'tyomaat' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500'}`}>
          <Building2 className="w-4 h-4" /> Työmaat
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
            {open.length === 0 && inProgress.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Ei avoimia tarpeita. Uudet materiaalipyynnöt ilmestyvät tähän automaattisesti.</p>
            )}
            {open.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">Odottaa päätöstä ({open.length})</p>
                {open.map((r) => <RequestCard key={r.id} r={r} />)}
              </section>
            )}
            {inProgress.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Käsittelyssä ({inProgress.length})</p>
                {inProgress.map((r) => <RequestCard key={r.id} r={r} />)}
              </section>
            )}
            {doneCount > 0 && <p className="text-xs text-gray-600 text-center">{doneCount} toimitettua tarvetta</p>}
          </>
        )}

        {!loading && !error && tab === 'tyomaat' && (
          <div className="space-y-3">
            {worksites.map((site) => (
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
              <button onClick={() => setOrderMsgFor(null)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
