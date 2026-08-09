import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, RefreshCw, Warehouse, Check, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, timeAgo } from '../lib/requests'
import type { MaterialRequest } from '../lib/requests'

export default function VarastoHome() {
  const { profile, signOut } = useAuth()
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase.from('material_requests')
      .select('*, worksites(name, address, client_company), requester:profiles!material_requests_requested_by_fkey(full_name)')
      .eq('forwarded_to', 'varasto')
      .order('kiire', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) setError('Tietojen haku epäonnistui. Tarkista verkkoyhteys.')
    else setRequests((data ?? []) as unknown as MaterialRequest[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const iv = setInterval(fetchAll, 15000)
    return () => clearInterval(iv)
  }, [fetchAll])

  async function mark(r: MaterialRequest, status: 'tilattu' | 'toimitettu') {
    const patch = status === 'tilattu'
      ? { status, ordered_at: new Date().toISOString() }
      : { status, delivered_at: new Date().toISOString() }
    const { error } = await supabase.from('material_requests').update(patch).eq('id', r.id)
    if (error) setToast('Päivitys epäonnistui')
    else { setToast(status === 'tilattu' ? 'Merkitty kerätyksi/tilatuksi' : 'Merkitty toimitetuksi'); fetchAll() }
  }

  const queue = useMemo(() => requests.filter((r) => r.status === 'hyvaksytty' || r.status === 'tilattu'), [requests])
  const doneCount = useMemo(() => requests.filter((r) => r.status === 'toimitettu').length, [requests])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">ProFloor</h1>
          <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wide -mt-0.5">Varasto</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{profile?.full_name}</span>
          <button onClick={signOut} aria-label="Kirjaudu ulos" className="p-2.5 -m-1 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-4">
        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wide flex items-center gap-2">
              <Warehouse className="w-4 h-4" /> Varaston jono ({queue.length})
            </p>
            {queue.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Ei avoimia toimituksia. Työnjohtajan varastolle ohjaamat tarpeet ilmestyvät tähän.</p>}
            {queue.map((r) => (
              <div key={r.id} className={`bg-gray-900 border rounded-2xl p-4 ${r.kiire ? 'border-red-800' : 'border-gray-800'}`}>
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
                  <button onClick={() => mark(r, 'tilattu')} className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-purple-500/20 text-purple-300 rounded-xl text-xs font-semibold">
                    <Check className="w-4 h-4" /> Kerätty / lähtee varastolta
                  </button>
                )}
                {r.status === 'tilattu' && (
                  <button onClick={() => mark(r, 'toimitettu')} className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-green-500/20 text-green-300 rounded-xl text-xs font-semibold">
                    <Check className="w-4 h-4" /> Toimitettu työmaalle
                  </button>
                )}
              </div>
            ))}
            {doneCount > 0 && <p className="text-xs text-gray-600 text-center">{doneCount} toimitettua</p>}
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}
