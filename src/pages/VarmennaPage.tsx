// Julkinen aitousvarmennus: rakennusliike skannaa PDF:n QR-koodin ja näkee
// sinetöidyn alkuperäisen tiedot suoraan kannasta.
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, Search, HardHat } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'

type VerifyData = {
  numero: number
  tyokohde: string | null
  period_start: string | null
  period_end: string | null
  tyontekijat: string | null
  mestari_nimi: string | null
  signed_at: string | null
  signed_on_device: string
  content_hash: string | null
  rivien_maara: number
}

export default function VarmennaPage() {
  const [params] = useSearchParams()
  const [nro, setNro] = useState(params.get('nro') ?? '')
  const [data, setData] = useState<VerifyData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  const verify = useCallback(async (numero: string) => {
    if (!numero.trim()) return
    setLoading(true)
    setNotFound(false)
    setData(null)
    const { data, error } = await supabase.rpc('verify_poytakirja', { p_numero: Number(numero) })
    if (error || !data) setNotFound(true)
    else setData(data as VerifyData)
    setLoading(false)
  }, [])

  useEffect(() => {
    const n = params.get('nro')
    if (n) verify(n)
  }, [params, verify])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
          <HardHat className="w-5 h-5 text-gray-950" />
        </div>
        <div>
          <h1 className="text-base font-bold">Mittauspöytäkirjan varmennus</h1>
          <p className="text-xs text-gray-500">Heikkinen Yhtiöt Oy · FloorData</p>
        </div>
      </header>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-4">
        <div className="flex gap-2">
          <input type="text" inputMode="numeric" placeholder="Pöytäkirjan numero" value={nro} onChange={(e) => setNro(e.target.value)}
            className="flex-1 px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <button onClick={() => verify(nro)} className="px-5 bg-amber-500 text-gray-950 font-semibold rounded-xl flex items-center gap-2">
            <Search className="w-4 h-4" /> Hae
          </button>
        </div>

        {loading && <div className="bg-gray-900 rounded-2xl h-32 animate-pulse" />}

        {notFound && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-5 text-center space-y-2">
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
            <p className="font-semibold">Ei löydy</p>
            <p className="text-sm text-gray-400">Tällä numerolla ei ole lukittua mittauspöytäkirjaa. Asiakirja voi olla väärennös tai vielä hyväksymättä.</p>
          </div>
        )}

        {data && (
          <div className="bg-green-950/40 border border-green-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-10 h-10 text-green-400 shrink-0" />
              <div>
                <p className="font-bold">Aito ja lukittu</p>
                <p className="text-xs text-gray-400">Mittauspöytäkirja {data.numero}</p>
              </div>
            </div>
            <div className="text-sm space-y-1.5 border-t border-green-900 pt-3">
              <p className="flex justify-between"><span className="text-gray-400">Työkohde</span><span>{data.tyokohde}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Aikaväli</span><span>{data.period_start ? formatDate(data.period_start) : ''} – {data.period_end ? formatDate(data.period_end) : ''}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Työntekijät</span><span>{data.tyontekijat}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Hyväksyjä</span><span>{data.mestari_nimi}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Allekirjoitettu</span><span>{data.signed_at ? new Date(data.signed_at).toLocaleString('fi-FI') : ''}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Laite</span><span>{data.signed_on_device === 'mestari' ? 'Mestarin oma laite' : 'Työntekijän laite'}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Rivejä</span><span>{data.rivien_maara}</span></p>
            </div>
            <div className="border-t border-green-900 pt-3">
              <p className="text-xs text-gray-400 mb-1">Eheystiiviste (SHA-256) — vertaa PDF:n alalaitaan:</p>
              <p className="text-[10px] font-mono break-all text-green-300">{data.content_hash}</p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-600">
          Tämä sivu näyttää tiedot suoraan sinetöidystä tietokannasta. Jos hallussasi olevan PDF:n tiiviste täsmää yllä olevaan, asiakirja on bitilleen sama kuin allekirjoitushetkellä.
        </p>
      </main>
    </div>
  )
}
