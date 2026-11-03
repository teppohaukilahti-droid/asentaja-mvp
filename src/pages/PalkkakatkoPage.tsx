// Palkkakatko-apuri: työnjohtajan tarkastuksen tuki palkkakauden päättyessä.
// 1) Heikkinentunnit-analyysi: kuitattavat tunnit (= firmalle pelkkää miinusta)
//    per asentaja, vertailu tiimiin ja omaan historiaan, toistuvat syyt.
// 2) Oppiva tarkastus: tilastolliset liput (harvinainen rivi, määräpiikki,
//    tuntipiikki) + työnjohtajan päätökset muistiin — "OK, kuului maksaa"
//    hiljentää lipun jatkossa, "Aiheeton" nostaa sen aina esiin.
//    Ei mustaa laatikkoa: jokainen lippu kertoo perusteensa numeroina.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Banknote, RefreshCw, Check, X, AlertTriangle, TrendingUp, TrendingDown,
  Clock, Repeat, Sparkles, ShieldQuestion,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { eur, formatDate, payPeriod, toInput } from '../lib/helpers'

type E = {
  id: string; user_id: string; entry_type: string; amount: number | null; hours: number | null
  total_sum: number | null; description: string | null; hour_category: string | null
  entry_date: string; worksite_id: string
  tes_codes: { code: string; description: string } | null
  worksites: { name: string } | null
}
type Verdict = { entry_id: string; asentaja_id: string; koodi: string | null; verdict: 'ok' | 'aiheeton' }
type Prof = { id: string; full_name: string; role: string }

type Flag = {
  entry: E
  tyyppi: 'harvinainen' | 'maarapiikki' | 'aiheeton_historia'
  peruste: string
}

export default function PalkkakatkoPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const cutoff = profile?.pay_period_cutoff ?? 15

  const [entries, setEntries] = useState<E[]>([])       // kuluva kausi
  const [history, setHistory] = useState<E[]>([])       // 180 pv ennen kautta (vertailupohja)
  const [verdicts, setVerdicts] = useState<Verdict[]>([])
  const [profs, setProfs] = useState<Prof[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const period = useMemo(() => payPeriod(cutoff), [cutoff])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const fetchAll = useCallback(async () => {
    setError(null)
    const histStart = toInput(new Date(new Date(period.start).getTime() - 180 * 86400000))
    const sel = 'id, user_id, entry_type, amount, hours, total_sum, description, hour_category, entry_date, worksite_id, tes_codes(code, description), worksites(name)'
    const [curRes, histRes, verRes, profRes] = await Promise.all([
      supabase.from('entries').select(sel).gte('entry_date', period.start).lte('entry_date', period.end),
      supabase.from('entries').select(sel).gte('entry_date', histStart).lt('entry_date', period.start),
      supabase.from('tarkastusmerkinnat').select('entry_id, asentaja_id, koodi, verdict'),
      supabase.from('profiles').select('id, full_name, role').eq('approved', true),
    ])
    if (curRes.error) setError('Tietojen haku epäonnistui.')
    else {
      setEntries((curRes.data ?? []) as unknown as E[])
      setHistory((histRes.data ?? []) as unknown as E[])
      setVerdicts((verRes.data ?? []) as Verdict[])
      setProfs(profRes.data ?? [])
    }
    setLoading(false)
  }, [period])

  useEffect(() => { fetchAll() }, [fetchAll])

  const nameOf = useMemo(() => new Map(profs.map((p) => [p.id, p.full_name])), [profs])
  const asentajat = useMemo(() =>
    [...new Set(entries.map((e) => e.user_id))].filter((id) => profs.find((p) => p.id === id)), [entries, profs])

  // Muisti: (asentaja|koodi) → ok-määrä / aiheeton-määrä
  const memory = useMemo(() => {
    const m = new Map<string, { ok: number; aiheeton: number }>()
    for (const v of verdicts) {
      const key = `${v.asentaja_id}|${v.koodi ?? ''}`
      const g = m.get(key) ?? { ok: 0, aiheeton: 0 }
      g[v.verdict]++
      m.set(key, g)
    }
    return m
  }, [verdicts])
  const verdictByEntry = useMemo(() => new Map(verdicts.map((v) => [v.entry_id, v.verdict])), [verdicts])

  // Per asentaja: kauden luvut + vertailut
  const stats = useMemo(() => {
    const calc = (list: E[], uid: string) => {
      const mine = list.filter((e) => e.user_id === uid)
      return {
        urakka: mine.filter((e) => e.entry_type !== 'tunti').reduce((s, e) => s + Number(e.total_sum ?? 0), 0),
        kuitattavat: mine.filter((e) => e.entry_type === 'tunti' && e.hour_category === 'kuitattava').reduce((s, e) => s + Number(e.hours ?? 0), 0),
        omat: mine.filter((e) => e.entry_type === 'tunti' && e.hour_category !== 'kuitattava').reduce((s, e) => s + Number(e.hours ?? 0), 0),
      }
    }
    // Historia jaettuna ~kauden mittaisiin jaksoihin vertailua varten
    const periodDays = Math.max(1, Math.round((new Date(period.end).getTime() - new Date(period.start).getTime()) / 86400000))
    const histPeriods = Math.max(1, Math.floor(180 / periodDays))
    return new Map(asentajat.map((uid) => {
      const cur = calc(entries, uid)
      const hist = calc(history, uid)
      const histAvgKuit = hist.kuitattavat / histPeriods
      return [uid, { ...cur, histAvgKuit }]
    }))
  }, [entries, history, asentajat, period])

  const teamKuitAvg = useMemo(() => {
    if (asentajat.length === 0) return 0
    let sum = 0
    asentajat.forEach((uid) => { sum += stats.get(uid)?.kuitattavat ?? 0 })
    return sum / asentajat.length
  }, [asentajat, stats])

  // Toistuvat tuntisyyt: sama selite tunneissa sekä kaudella että historiassa
  const toistuvat = useMemo(() => {
    const out: { uid: string; desc: string; nyt: number; ennen: number }[] = []
    for (const uid of asentajat) {
      const descNow = new Map<string, number>()
      entries.filter((e) => e.user_id === uid && e.entry_type === 'tunti' && e.description)
        .forEach((e) => descNow.set(e.description!.toLowerCase().trim(), (descNow.get(e.description!.toLowerCase().trim()) ?? 0) + Number(e.hours ?? 0)))
      for (const [desc, h] of descNow) {
        const ennen = history.filter((e) => e.user_id === uid && e.entry_type === 'tunti' && (e.description ?? '').toLowerCase().trim() === desc).length
        if (ennen >= 2) out.push({ uid, desc, nyt: h, ennen })
      }
    }
    return out
  }, [entries, history, asentajat])

  // Liput: tilastolliset perusteet + muistin vaikutus
  const flags = useMemo(() => {
    const out: Flag[] = []
    for (const e of entries) {
      if (e.entry_type === 'tunti') continue
      const code = e.tes_codes?.code ?? null
      if (!code) continue
      const memKey = `${e.user_id}|${code}`
      const mem = memory.get(memKey)
      // Muisti voittaa tilaston: 2× "OK" hiljentää, yksikin "aiheeton" nostaa aina
      if (mem && mem.aiheeton > 0) {
        out.push({ entry: e, tyyppi: 'aiheeton_historia', peruste: `Tämä rivi on aiemmin merkitty aiheettomaksi (${mem.aiheeton} krt)` })
        continue
      }
      if (mem && mem.ok >= 2) continue

      const ownHist = history.filter((h) => h.user_id === e.user_id && h.tes_codes?.code === code)
      const othersUse = new Set(history.filter((h) => h.user_id !== e.user_id && h.tes_codes?.code === code).map((h) => h.user_id)).size
      const otherAsentajat = Math.max(1, new Set(history.map((h) => h.user_id)).size - 1)

      if (ownHist.length === 0 && othersUse / otherAsentajat < 0.34) {
        out.push({ entry: e, tyyppi: 'harvinainen', peruste: `Uusi rivi tälle asentajalle, ja vain ${othersUse}/${otherAsentajat} muusta käyttää koodia ${code}` })
        continue
      }
      if (ownHist.length >= 3) {
        const amounts = ownHist.map((h) => Number(h.amount ?? 0)).sort((a, b) => a - b)
        const median = amounts[Math.floor(amounts.length / 2)]
        if (median > 0 && Number(e.amount ?? 0) > 2 * median) {
          out.push({ entry: e, tyyppi: 'maarapiikki', peruste: `Määrä ${String(e.amount).replace('.', ',')} on yli 2× oma mediaani (${String(median).replace('.', ',')}, ${ownHist.length} aiempaa kirjausta)` })
        }
      }
    }
    return out
  }, [entries, history, memory])

  // Linjaukset: miten kutakin koodia on päätetty — ristiriita = talon linjaus puuttuu.
  // Tämä on se "jyräys-kysymyksen" lopullinen vastaus: päätökset näkyviin ja yhdenmukaisiksi.
  const linjaukset = useMemo(() => {
    const codeDesc = new Map<string, string>()
    ;[...entries, ...history].forEach((e) => {
      if (e.tes_codes) codeDesc.set(e.tes_codes.code, e.tes_codes.description)
    })
    const byCode = new Map<string, { ok: number; aiheeton: number }>()
    for (const v of verdicts) {
      if (!v.koodi) continue
      const g = byCode.get(v.koodi) ?? { ok: 0, aiheeton: 0 }
      g[v.verdict]++
      byCode.set(v.koodi, g)
    }
    return [...byCode.entries()]
      .map(([code, g]) => ({ code, desc: codeDesc.get(code) ?? '', ...g, ristiriita: g.ok > 0 && g.aiheeton > 0 }))
      .sort((a, b) => Number(b.ristiriita) - Number(a.ristiriita) || (b.ok + b.aiheeton) - (a.ok + a.aiheeton))
  }, [verdicts, entries, history])

  async function saveVerdict(f: Flag, verdict: 'ok' | 'aiheeton') {
    if (!user || !profile) return
    const { error: upErr } = await supabase.from('tarkastusmerkinnat').upsert({
      organization_id: profile.organization_id, entry_id: f.entry.id,
      asentaja_id: f.entry.user_id, koodi: f.entry.tes_codes?.code ?? null,
      verdict, reviewer_id: user.id, reviewer_name: profile.full_name ?? '',
    }, { onConflict: 'entry_id' })
    if (upErr) setToast('Merkintä epäonnistui')
    else {
      setToast(verdict === 'ok' ? 'Merkitty: kuului maksaa — ei liputeta jatkossa' : 'Merkitty aiheettomaksi — liputetaan jatkossa aina')
      fetchAll()
    }
  }

  const maxKuit = Math.max(1, ...asentajat.map((uid) => stats.get(uid)?.kuitattavat ?? 0))

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-500" /> Palkkakatko-apuri
          </h1>
          <p className="text-[11px] text-gray-500">Kausi {formatDate(period.start)} – {formatDate(period.end)}</p>
        </div>
      </header>

      <main className="px-4 py-4 pb-20 max-w-md mx-auto space-y-5">
        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}
        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Tarkastettavat liput ensin — tämä on se painajaisen poistaja */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldQuestion className="w-4 h-4" /> Tarkista nämä ({flags.length})
              </h2>
              {flags.length === 0 && (
                <p className="text-gray-500 text-sm bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
                  Ei liputettavaa tällä kaudella — kaikki rivit ovat linjassa historian kanssa.
                </p>
              )}
              {flags.map((f) => (
                <div key={f.entry.id} className={`bg-gray-900 border rounded-2xl p-4 space-y-2 ${f.tyyppi === 'aiheeton_historia' ? 'border-red-800' : 'border-amber-500/40'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">
                        {f.entry.tes_codes ? `${f.entry.tes_codes.code} ${f.entry.tes_codes.description}` : f.entry.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {nameOf.get(f.entry.user_id)} · {f.entry.worksites?.name} · {formatDate(f.entry.entry_date)}
                        {f.entry.amount != null && ` · ${String(f.entry.amount).replace('.', ',')}`}
                        {f.entry.total_sum != null && ` · ${eur(Number(f.entry.total_sum))}`}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${f.tyyppi === 'aiheeton_historia' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {f.tyyppi === 'harvinainen' ? 'Harvinainen' : f.tyyppi === 'maarapiikki' ? 'Määräpiikki' : 'Aiheeton ennen'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" /> {f.peruste}
                  </p>
                  {verdictByEntry.get(f.entry.id) ? (
                    <p className="text-xs font-semibold text-gray-500">
                      Päätetty: {verdictByEntry.get(f.entry.id) === 'ok' ? 'kuului maksaa' : 'aiheeton'}
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => saveVerdict(f, 'ok')}
                        className="flex-1 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-green-400 flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> OK, kuului maksaa
                      </button>
                      <button onClick={() => saveVerdict(f, 'aiheeton')}
                        className="flex-1 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-red-400 flex items-center justify-center gap-1.5">
                        <X className="w-3.5 h-3.5" /> Aiheeton
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {flags.length > 0 && (
                <p className="text-[11px] text-gray-600">
                  Apuri oppii päätöksistäsi: kahdesti "OK" kuitattu rivi ei enää liputa samalla asentajalla — "Aiheeton" liputetaan aina.
                </p>
              )}
            </section>

            {/* Heikkinentunnit per asentaja */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Kuitattavat tunnit (firman miinus)
              </h2>
              {asentajat.map((uid) => {
                const s = stats.get(uid)!
                const trendUp = s.kuitattavat > s.histAvgKuit * 1.3 && s.kuitattavat > 2
                const trendDown = s.kuitattavat < s.histAvgKuit * 0.7
                return (
                  <div key={uid} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{nameOf.get(uid)}</p>
                      <p className="text-xs text-gray-400 shrink-0">
                        urakat {eur(s.urakka)} · <b className={s.kuitattavat > teamKuitAvg * 1.5 && s.kuitattavat > 2 ? 'text-amber-400' : 'text-gray-200'}>{String(s.kuitattavat).replace('.', ',')} h</b>
                        {trendUp && <TrendingUp className="w-3.5 h-3.5 inline ml-1 text-amber-400" />}
                        {trendDown && <TrendingDown className="w-3.5 h-3.5 inline ml-1 text-green-400" />}
                      </p>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(s.kuitattavat / maxKuit) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-600">
                      kausikeskiarvo ennen: {s.histAvgKuit.toFixed(1).replace('.', ',')} h · tiimin keskiarvo nyt: {teamKuitAvg.toFixed(1).replace('.', ',')} h · omat tunnit {String(s.omat).replace('.', ',')} h
                    </p>
                  </div>
                )
              })}
              {asentajat.length === 0 && <p className="text-gray-500 text-sm">Ei kirjauksia tällä kaudella.</p>}
            </section>

            {/* Linjaukset: maksetaanko tämä rivi vai ei — ja missä linja horjuu */}
            {linjaukset.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Linjaukset (päätöshistoria koodeittain)
                </h2>
                {linjaukset.map((l) => (
                  <div key={l.code} className={`bg-gray-900 border rounded-xl px-4 py-2.5 ${l.ristiriita ? 'border-amber-500/40' : 'border-gray-800'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{l.code} {l.desc}</p>
                      <p className="text-xs shrink-0">
                        <span className="text-green-400 font-semibold">{l.ok}× maksettu</span>
                        <span className="text-gray-600"> · </span>
                        <span className="text-red-400 font-semibold">{l.aiheeton}× evätty</span>
                      </p>
                    </div>
                    {l.ristiriita && (
                      <p className="text-xs text-amber-400 mt-1 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        Ristiriitaisia päätöksiä — sopikaa talon linjaus, niin sama sääntö koskee kaikkia
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Toistuvat tuntisyyt */}
            {toistuvat.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Repeat className="w-4 h-4" /> Toistuvat tuntisyyt
                </h2>
                {toistuvat.map((t, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                    <p className="text-sm">"{t.desc}" — {nameOf.get(t.uid)}</p>
                    <p className="text-xs text-gray-500">
                      {String(t.nyt).replace('.', ',')} h tällä kaudella · esiintynyt {t.ennen} kertaa aiemmin — jos syy toistuu kaudesta toiseen, se voi olla prosessiongelma eikä palkka-asia
                    </p>
                  </div>
                ))}
              </section>
            )}

            <p className="text-[11px] text-gray-600 text-center flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Jokainen lippu perustuu näkyviin numeroihin — apuri ehdottaa, työnjohtaja päättää.
            </p>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}
