import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users, Check, AlertTriangle, RefreshCw, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { eur } from '../lib/helpers'

type ShareInfo = {
  error?: string
  status?: string
  owner?: string
  worksite?: string
  n_members?: number
  entry_count?: number
  total?: number
  share_total?: number
  total_hours?: number
  share_hours?: number
  claims?: number
  remaining?: number
  already_claimed?: boolean
  is_owner?: boolean
}

type ClaimResult = { error?: string; ok?: boolean; moved_count?: number; moved_total?: number; moved_hours?: number; owner_name?: string }

const fmtH = (h: number) => `${String(Math.round(h * 100) / 100).replace('.', ',')} h`

const ERROR_TEXT: Record<string, string> = {
  not_found: 'Jakoa ei löytynyt. Tarkista linkki tai pyydä uusi QR-koodi.',
  expired: 'Tämä jako on vanhentunut tai peruttu. Pyydä työparilta uusi QR-koodi.',
  own_share: 'Tämä on oma jakosi — työpari skannaa koodin omalla puhelimellaan.',
  already_claimed: 'Olet jo imuroinut osuutesi tästä jaosta.',
  full: 'Kaikki osuudet on jo imuroitu.',
  auth: 'Kirjaudu ensin sisään ja avaa linkki uudelleen.',
}

export default function JaaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [info, setInfo] = useState<ShareInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [result, setResult] = useState<ClaimResult | null>(null)

  const fetchInfo = useCallback(async () => {
    if (!token) { setInfo({ error: 'not_found' }); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('get_pay_share_info', { p_token: token })
    setInfo(error ? { error: 'not_found' } : (data as ShareInfo))
    setLoading(false)
  }, [token])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  async function claim() {
    if (!token || claiming) return
    setClaiming(true)
    const { data, error } = await supabase.rpc('claim_pay_share', { p_token: token })
    if (error) {
      setResult({ error: 'not_found' })
    } else {
      setResult(data as ClaimResult)
    }
    setClaiming(false)
  }

  const sharePct = info?.n_members ? Math.round(10000 / info.n_members) / 100 : 50

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-500" /> Palkanjako
        </h1>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto space-y-4">
        {loading && (
          <p className="text-gray-400 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Haetaan jaon tietoja…</p>
        )}

        {!loading && result?.ok && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-3">
            <Check className="w-12 h-12 text-green-400 mx-auto" />
            <p className="text-xl font-bold text-green-400">
              {eur(result.moved_total ?? 0)}
              {(result.moved_hours ?? 0) > 0 && ` + ${fmtH(result.moved_hours ?? 0)}`}
            </p>
            <p className="text-sm text-gray-300">
              Osuutesi imuroitu — {result.moved_count} kirjausta siirtyi omiin kirjauksiisi
              {result.owner_name ? ` (${result.owner_name} jakoi)` : ''}.
            </p>
            {(result.moved_hours ?? 0) > 0 && (
              <p className="text-xs text-gray-500">Kuitatuista tunneista saat palkan omalla tuntipalkallasi.</p>
            )}
            <button onClick={() => navigate('/raportti')}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl">
              Katso raportti
            </button>
          </div>
        )}

        {!loading && result && !result.ok && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{ERROR_TEXT[result.error ?? ''] ?? 'Imurointi epäonnistui. Yritä uudelleen.'}</p>
          </div>
        )}

        {!loading && !result && info?.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{ERROR_TEXT[info.error] ?? 'Jaon haku epäonnistui.'}</p>
          </div>
        )}

        {!loading && !result && info && !info.error && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="text-sm text-gray-400">
                <span className="text-white font-semibold">{info.owner}</span> jakaa työmaan{' '}
                <span className="text-white font-semibold">{info.worksite}</span> urakkapalkan {info.n_members} miehen porukalle.
              </p>
              <div className="space-y-1.5 text-sm border-t border-gray-800 pt-3">
                <p className="flex justify-between"><span className="text-gray-400">Jaossa</span><span className="font-semibold">{info.entry_count} kirjausta · {eur(info.total ?? 0)}{(info.total_hours ?? 0) > 0 && ` + ${fmtH(info.total_hours ?? 0)}`}</span></p>
                <p className="flex justify-between">
                  <span className="text-gray-400">Sinun osuutesi ({sharePct} %)</span>
                  <span className="font-bold text-green-400 text-base">
                    {eur(info.share_total ?? 0)}
                    {(info.share_hours ?? 0) > 0 && ` + ${fmtH(info.share_hours ?? 0)}`}
                  </span>
                </p>
                <p className="flex justify-between"><span className="text-gray-400">Osuuksia jäljellä</span><span className="font-semibold">{info.remaining}</span></p>
              </div>
              {(info.share_hours ?? 0) > 0 && (
                <p className="text-xs text-gray-500">Kuitatut tunnit siirtyvät tunteina — palkan niistä saat omalla tuntipalkallasi, joten euromäärä voi erota jakajan summasta.</p>
              )}
            </div>

            {info.is_owner ? (
              <p className="text-sm text-gray-500 text-center">{ERROR_TEXT.own_share}</p>
            ) : info.already_claimed ? (
              <p className="text-sm text-green-400 text-center font-semibold">✓ {ERROR_TEXT.already_claimed}</p>
            ) : (info.remaining ?? 0) <= 0 ? (
              <p className="text-sm text-gray-500 text-center">{ERROR_TEXT.full}</p>
            ) : (
              <button onClick={claim} disabled={claiming}
                className="w-full py-4 bg-amber-500 text-gray-950 text-lg font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
                <Download className="w-5 h-5" />
                {claiming ? 'Imuroidaan…' : `Imuroi osuuteni ${eur(info.share_total ?? 0)}`}
              </button>
            )}
            <p className="text-xs text-gray-600 text-center">
              Imurointi siirtää osuutesi kirjauksina omalle tilillesi — ne näkyvät heti raportissasi ja tililapussasi.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
