// Omat tiedot ja työpari. Nämä menevät suoraan tililapun yläosaan:
// nimi, henkilönumero ja tuntipalkka. Työparille tehdään oma lappu samoista kirjauksista.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, KeyRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { parseNum } from '../lib/helpers'

const JAOT = [50, 40, 30] // työparin osuus %: 50/50, 60/40, 70/30

const numStr = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export default function AsetuksetPage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()

  const [nimi, setNimi] = useState(profile?.full_name ?? '')
  const [hlonro, setHlonro] = useState(profile?.henkilonumero ?? '')
  const [palkka, setPalkka] = useState(numStr(profile?.hourly_rate))
  const [pariNimi, setPariNimi] = useState(profile?.tyopari_nimi ?? '')
  const [pariHlonro, setPariHlonro] = useState(profile?.tyopari_henkilonumero ?? '')
  const [pariPalkka, setPariPalkka] = useState(numStr(profile?.tyopari_tuntipalkka))
  const [pariPct, setPariPct] = useState(profile?.tyopari_osuus_pct ?? 50)
  const [omaJako, setOmaJako] = useState(!JAOT.includes(profile?.tyopari_osuus_pct ?? 50))
  const [saving, setSaving] = useState(false)
  const [viesti, setViesti] = useState<string | null>(null)
  // Salasanan vaihto: käyttäjä vaihtaa itse, sisäänkirjautuneena
  const [uusiSala, setUusiSala] = useState('')
  const [toistoSala, setToistoSala] = useState('')
  const [salaTila, setSalaTila] = useState<{ ok: boolean; teksti: string } | null>(null)
  const [salaSaving, setSalaSaving] = useState(false)
  const salaVirhe =
    uusiSala.length > 0 && uusiSala.length < 6 ? 'Vähintään 6 merkkiä.'
    : toistoSala.length > 0 && uusiSala !== toistoSala ? 'Salasanat eivät täsmää.'
    : null
  const salaValmis = uusiSala.length >= 6 && uusiSala === toistoSala

  async function vaihdaSalasana() {
    if (!salaValmis || salaSaving) return
    setSalaSaving(true)
    setSalaTila(null)
    const { error } = await supabase.auth.updateUser({ password: uusiSala })
    if (error) {
      setSalaTila({ ok: false, teksti: error.message.includes('different')
        ? 'Uusi salasana on sama kuin vanha.'
        : 'Vaihto ei onnistunut. Kirjaudu ulos ja sisään ja yritä uudelleen.' })
    } else {
      setUusiSala('')
      setToistoSala('')
      setSalaTila({ ok: true, teksti: 'Salasana vaihdettu.' })
    }
    setSalaSaving(false)
  }

  const palkkaNum = palkka.trim() ? parseNum(palkka) : null
  const pariPalkkaNum = pariPalkka.trim() ? parseNum(pariPalkka) : null
  const virhe =
    !nimi.trim() ? 'Kirjoita nimesi.'
    : palkkaNum !== null && !(palkkaNum > 0) ? 'Tarkista tuntipalkka.'
    : pariPalkkaNum !== null && !(pariPalkkaNum > 0) ? 'Tarkista työparin tuntipalkka.'
    : null

  async function tallenna() {
    if (!user || virhe || saving) return
    setSaving(true)
    setViesti(null)
    const { error } = await supabase.from('profiles').update({
      full_name: nimi.trim(),
      henkilonumero: hlonro.trim() || null,
      hourly_rate: palkkaNum,
      tyopari_nimi: pariNimi.trim() || null,
      tyopari_henkilonumero: pariHlonro.trim() || null,
      tyopari_tuntipalkka: pariPalkkaNum,
      tyopari_osuus_pct: Math.round(pariPct),
    }).eq('id', user.id)
    if (error) setViesti('Tallennus ei onnistunut. Tarkista verkkoyhteys.')
    else {
      await refreshProfile()
      setViesti('Tallennettu.')
    }
    setSaving(false)
  }

  const input = 'w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500'
  const label = 'block text-sm text-gray-400 mb-1.5'
  const minunPct = 100 - pariPct

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/lisaa')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Omat tiedot</h1>
      </header>

      <main className="px-4 py-5 pb-28 max-w-md mx-auto space-y-8">
        <section className="space-y-4">
          <p className="text-sm text-gray-400">Nämä tulevat tililapun yläosaan.</p>
          <div>
            <label className={label} htmlFor="nimi">Nimi</label>
            <input id="nimi" className={input} value={nimi} onChange={(e) => setNimi(e.target.value)} placeholder="Etunimi Sukunimi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="hlonro">Henkilönumero</label>
              <input id="hlonro" className={input} value={hlonro} onChange={(e) => setHlonro(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className={label} htmlFor="palkka">Tuntipalkka €</label>
              <input id="palkka" className={input} value={palkka} onChange={(e) => setPalkka(e.target.value)} inputMode="decimal" placeholder="23,00" />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-800 pt-6">
          <div>
            <h2 className="text-base font-semibold">Työpari</h2>
            <p className="text-sm text-gray-400 mt-1">
              Kun työparin nimi on annettu, raportista saa tililaput molemmille. Kirjatessa valitaan,
              onko työ molempien, vain sinun vai vain työparin.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="parinimi">Työparin nimi</label>
            <input id="parinimi" className={input} value={pariNimi} onChange={(e) => setPariNimi(e.target.value)} placeholder="Tyhjä = ei työparia" />
          </div>
          {pariNimi.trim() !== '' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="parihlonro">Henkilönumero</label>
                  <input id="parihlonro" className={input} value={pariHlonro} onChange={(e) => setPariHlonro(e.target.value)} inputMode="numeric" />
                </div>
                <div>
                  <label className={label} htmlFor="paripalkka">Tuntipalkka €</label>
                  <input id="paripalkka" className={input} value={pariPalkka} onChange={(e) => setPariPalkka(e.target.value)} inputMode="decimal" placeholder="23,00" />
                </div>
              </div>

              <div>
                <p className={label}>Urakoiden jako (sinä / {pariNimi.trim().split(' ')[0]})</p>
                <div className="grid grid-cols-4 gap-2">
                  {JAOT.map((p) => (
                    <button key={p} onClick={() => { setPariPct(p); setOmaJako(false) }}
                      className={`py-3 rounded-lg text-sm font-bold ${!omaJako && pariPct === p ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-200'}`}>
                      {100 - p}/{p}
                    </button>
                  ))}
                  <button onClick={() => setOmaJako(true)}
                    className={`py-3 rounded-lg text-sm font-bold ${omaJako ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-200'}`}>
                    Muu
                  </button>
                </div>
                {omaJako && (
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-sm text-gray-400 shrink-0">Työparin osuus</span>
                    <input className={`${input} w-24`} inputMode="numeric" value={String(pariPct)}
                      onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')); if (v <= 100) setPariPct(v) }} />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Sinulle {minunPct} %, työparille {pariPct} % yhteisistä urakoista. Yhteiset tunnit tulevat
                  kummallekin kokonaan, omalla tuntipalkalla.
                </p>
              </div>
            </>
          )}
        </section>

        {virhe && <p className="text-sm text-red-400">{virhe}</p>}
        {viesti && <p className="text-sm text-green-400">{viesti}</p>}
        <button onClick={tallenna} disabled={!!virhe || saving}
          className="w-full h-14 rounded-lg bg-amber-500 text-gray-950 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
          <Check className="w-5 h-5" /> {saving ? 'Tallennetaan…' : 'Tallenna'}
        </button>

        <section className="space-y-4 border-t border-gray-800 pt-6">
          <h2 className="text-base font-semibold">Vaihda salasana</h2>
          <div>
            <label className={label} htmlFor="uusisala">Uusi salasana</label>
            <input id="uusisala" type="password" autoComplete="new-password" className={input}
              value={uusiSala} onChange={(e) => setUusiSala(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="toistosala">Toista salasana</label>
            <input id="toistosala" type="password" autoComplete="new-password" className={input}
              value={toistoSala} onChange={(e) => setToistoSala(e.target.value)} />
          </div>
          {salaVirhe && <p className="text-sm text-red-400">{salaVirhe}</p>}
          {salaTila && <p className={`text-sm ${salaTila.ok ? 'text-green-400' : 'text-red-400'}`}>{salaTila.teksti}</p>}
          <button onClick={vaihdaSalasana} disabled={!salaValmis || salaSaving}
            className="w-full h-12 rounded-lg bg-gray-800 border border-gray-700 font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5" /> {salaSaving ? 'Vaihdetaan…' : 'Vaihda salasana'}
          </button>
        </section>
      </main>
    </div>
  )
}
