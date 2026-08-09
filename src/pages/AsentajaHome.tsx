import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Building2, ChevronRight, LogOut, RefreshCw, Calculator, FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { eur, toInput } from '../lib/helpers'

type WorksiteRow = { id: string; name: string; address: string | null; client_company: string | null; status: string }
type EntryRow = { worksite_id: string; entry_type: string; hours: number | null; total_sum: number | null; entry_date: string }

export default function AsentajaHome() {
  const [worksites, setWorksites] = useState<WorksiteRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user, profile, signOut } = useAuth()
  const hourlyRate = profile?.hourly_rate ?? 0
  const navigate = useNavigate()

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const [siteRes, entryRes] = await Promise.all([
      supabase.from('worksites').select('id, name, address, client_company, status').eq('status', 'active').order('name'),
      supabase.from('entries').select('worksite_id, entry_type, hours, total_sum, entry_date').eq('user_id', user.id),
    ])
    if (siteRes.error) {
      setError('Työmaiden haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setWorksites(siteRes.data ?? [])
      setEntries((entryRes.data ?? []).map((e) => ({ ...e, hours: e.hours === null ? null : Number(e.hours), total_sum: e.total_sum === null ? null : Number(e.total_sum) })))
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const entryValue = useCallback((e: EntryRow) => e.entry_type === 'tunti' ? (e.hours ?? 0) * hourlyRate : (e.total_sum ?? 0), [hourlyRate])

  const week = useMemo(() => {
    const limit = new Date()
    limit.setDate(limit.getDate() - 7)
    const cut = toInput(limit)
    const recent = entries.filter((e) => e.entry_date >= cut)
    return {
      count: recent.length,
      days: new Set(recent.map((e) => e.entry_date)).size,
      sum: recent.reduce((s, e) => s + entryValue(e), 0),
    }
  }, [entries, entryValue])

  const total = useMemo(() => entries.reduce((s, e) => s + entryValue(e), 0), [entries, entryValue])
  const siteSums = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach((e) => m.set(e.worksite_id, (m.get(e.worksite_id) ?? 0) + entryValue(e)))
    return m
  }, [entries, entryValue])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">ProFloor</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{profile?.full_name}</span>
          <button onClick={signOut} aria-label="Kirjaudu ulos" className="p-2.5 -m-1 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 pb-16 max-w-md mx-auto">
        {/* Viikkoyhteenveto */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wide mb-3">Viimeiset 7 päivää</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xl font-bold">{week.count}</p><p className="text-xs text-gray-500">kirjausta</p></div>
            <div><p className="text-xl font-bold">{week.days}</p><p className="text-xs text-gray-500">työpäivää</p></div>
            <div><p className="text-xl font-bold text-green-400">{eur(week.sum)}</p><p className="text-xs text-gray-500">ansaittu</p></div>
          </div>
          {total > 0 && (
            <p className="flex justify-between text-sm border-t border-gray-800 pt-3 mt-3">
              <span className="text-gray-400">Kaikki yhteensä</span>
              <span className="font-bold text-amber-400">{eur(total)}</span>
            </p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={() => navigate('/laskin')}
            className="flex items-center gap-3 bg-amber-500 text-gray-950 rounded-2xl p-3.5 active:bg-amber-600 hover:bg-amber-400 transition-colors">
            <Calculator className="w-6 h-6 shrink-0" />
            <span className="text-left text-sm font-bold leading-tight">Super-<br />Laskukone</span>
          </button>
          <button onClick={() => navigate('/raportti')}
            className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-2xl p-3.5 hover:bg-gray-700 transition-colors">
            <FileText className="w-6 h-6 shrink-0 text-amber-400" />
            <span className="text-left text-sm font-bold leading-tight">Raportti &<br />tililappu</span>
          </button>
        </div>

        <h2 className="text-xl font-semibold mb-4">Työmaat</h2>

        {loading && (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="bg-gray-900 rounded-2xl h-24 animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
              <RefreshCw className="w-4 h-4" /> Yritä uudelleen
            </button>
          </div>
        )}

        {!loading && !error && worksites.length === 0 && (
          <p className="text-gray-500 text-sm">Ei aktiivisia työmaita. Uudet työmaat ilmestyvät tähän, kun työnjohto lisää ne.</p>
        )}

        {!loading && !error && worksites.length > 0 && (
          <div className="space-y-3">
            {worksites.map((site) => {
              const sum = siteSums.get(site.id) ?? 0
              return (
                <button key={site.id} onClick={() => navigate(`/tyomaa/${site.id}`)}
                  className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 active:bg-gray-800 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{site.name}</p>
                      {site.address && (
                        <p className="flex items-center gap-1.5 text-sm text-gray-400 mt-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{site.address}</span>
                        </p>
                      )}
                      {site.client_company && (
                        <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                          <Building2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{site.client_company}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sum > 0 && <span className="text-sm font-bold text-green-400">{eur(sum)}</span>}
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
