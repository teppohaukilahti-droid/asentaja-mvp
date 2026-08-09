// Mestarin julkinen hyväksyntäsivu: avautuu kertakäyttölinkillä ilman kirjautumista.
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Lock, Check, Download, ShieldCheck, HardHat } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'
import { downloadMittausPdf, sha256 } from '../lib/mittausPdf'
import type { MRow, PdfPoytakirja } from '../lib/mittausPdf'
import SignatureCanvas from '../components/SignatureCanvas'

type TokenData = {
  numero: number
  tyokohde: string | null
  osoite: string | null
  laskutus: string | null
  period_start: string | null
  period_end: string | null
  rows: MRow[]
  huom: string | null
  tyontekijat: string | null
  worksite_name: string
}

const CHECKS: { key: keyof MRow; label: string }[] = [
  { key: 'primer', label: 'Primer' }, { key: 'tasoitus', label: 'Tasoitus' },
  { key: 'hionta', label: 'Hionta+imur.' }, { key: 'suojaus', label: 'Suojaus' },
  { key: 'siivous', label: 'Siivous' }, { key: 'hammaslasta', label: 'H-lasta' },
  { key: 'itselleluovutus', label: 'Itselleluovutus' },
]

export default function HyvaksyPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [data, setData] = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mestariNimi, setMestariNimi] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)
  const [done, setDone] = useState<PdfPoytakirja | null>(null)

  const fetchData = useCallback(async () => {
    if (!token) { setError('Virheellinen linkki.'); setLoading(false); return }
    const { data, error } = await supabase.rpc('get_poytakirja_by_token', { p_token: token })
    if (error || !data) {
      setError('Hyväksyntälinkki on vanhentunut tai jo käytetty. Pyydä asentajalta uusi QR-koodi.')
    } else {
      setData(data as TokenData)
    }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  async function approve() {
    if (!token || !data || !signature || !mestariNimi.trim()) return
    setLocking(true)
    const hashInput = JSON.stringify({
      numero: data.numero, tyokohde: data.tyokohde,
      period: [data.period_start, data.period_end], rows: data.rows,
      tyontekijat: data.tyontekijat, mestari: mestariNimi.trim(), sig: signature,
    })
    const hash = await sha256(hashInput)
    const meta = { userAgent: navigator.userAgent, lang: navigator.language, ts: new Date().toISOString() }
    const { error } = await supabase.rpc('sign_poytakirja_by_token', {
      p_token: token, p_mestari: mestariNimi.trim(), p_signature: signature, p_hash: hash, p_meta: meta,
    })
    if (error) {
      setError('Hyväksyntä epäonnistui: linkki voi olla vanhentunut. Pyydä uusi QR-koodi.')
    } else {
      setDone({
        numero: data.numero, period_start: data.period_start, period_end: data.period_end,
        tyokohde: data.tyokohde, osoite: data.osoite, laskutus: data.laskutus,
        huom: data.huom, tyontekijat: data.tyontekijat, rows: data.rows,
        mestari_nimi: mestariNimi.trim(), signature_png: signature,
        signed_at: new Date().toISOString(), content_hash: hash, signed_on_device: 'mestari',
      })
    }
    setLocking(false)
  }

  const inputCls = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
          <HardHat className="w-5 h-5 text-gray-950" />
        </div>
        <div>
          <h1 className="text-base font-bold">Mittauspöytäkirjan hyväksyntä</h1>
          <p className="text-xs text-gray-500">Heikkinen Yhtiöt Oy · ProFloor</p>
        </div>
      </header>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-4">
        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}

        {error && !done && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-5 text-center">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {done && (
          <div className="space-y-4">
            <div className="bg-green-950/50 border border-green-800 rounded-2xl p-6 text-center">
              <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="font-bold text-lg">Hyväksytty ja lukittu</p>
              <p className="text-sm text-gray-400 mt-1">Mittauspöytäkirja {done.numero} on sinetöity — sitä ei voi enää muokata.</p>
            </div>
            <button onClick={() => downloadMittausPdf(done)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl">
              <Download className="w-4 h-4" /> Lataa oma kappaleesi (PDF)
            </button>
            <p className="text-xs text-gray-500 text-center">
              Tallenna tämä kappale itsellesi — kuten paperilomakkeen alimmainen osa. Aitouden voi varmentaa milloin tahansa PDF:n QR-koodilla.
            </p>
          </div>
        )}

        {data && !done && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="font-semibold">Nro {data.numero} · {data.worksite_name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {data.period_start ? formatDate(data.period_start) : ''} – {data.period_end ? formatDate(data.period_end) : ''}
              </p>
              {data.tyokohde && <p className="text-sm mt-2">{data.tyokohde}</p>}
              {data.osoite && <p className="text-xs text-gray-500">{data.osoite}</p>}
              <p className="text-xs text-gray-500 mt-2">Työntekijät: {data.tyontekijat}</p>
            </div>

            <div className="space-y-1.5">
              {data.rows.map((r, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                  <p className="text-sm font-medium">{r.tuote} <span className="text-gray-500">({r.tila})</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.huone && `${r.huone} · `}{r.mitat}{r.kpl && ` · ${r.kpl} kpl`}
                    {CHECKS.filter((c) => r[c.key]).map((c) => ` · ${c.label}`).join('')}
                  </p>
                </div>
              ))}
            </div>
            {data.huom && <p className="text-sm text-gray-400">Huom! {data.huom}</p>}

            <div className="bg-gray-900 border border-amber-900 rounded-2xl p-4 space-y-4">
              <p className="text-sm font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /> Mestarin hyväksyntä</p>
              <p className="text-xs text-amber-300/90">
                Tarkista rivit yllä. Allekirjoituksen jälkeen pöytäkirja lukitaan pysyvästi eikä sitä voi muokata.
              </p>
              <input type="text" placeholder="Nimenselvennys" value={mestariNimi} onChange={(e) => setMestariNimi(e.target.value)} className={inputCls} />
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Allekirjoitus:</p>
                <SignatureCanvas onChange={setSignature} />
              </div>
              <button onClick={approve} disabled={locking || !signature || !mestariNimi.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40">
                <Check className="w-4 h-4" /> {locking ? 'Lukitaan…' : 'Hyväksy ja lukitse'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
