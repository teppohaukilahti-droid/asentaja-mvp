import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronRight, RefreshCw,
  Navigation, Phone, GraduationCap, Map as MapIcon, AlertTriangle,
  X, Check, CalendarClock, HelpCircle, Bell,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { eur, toInput, today, formatDate } from '../lib/helpers'
import { getPosition, findNearestSite } from '../lib/geo'
import AlaNav from '../components/AlaNav'
import { OMA_KAYTTO } from '../lib/tila'
import { kirjauksetHenkilolle } from '../lib/tyopari'

type WorksiteRow = {
  id: string; name: string; address: string | null; client_company: string | null; status: string
  oma_tyomaa: boolean
  lat: number | null; lng: number | null; gps_sade_m: number | null
  perehdytys_url: string | null; mestari_nimi: string | null; mestari_puhelin: string | null
  erityismaininnat: string | null; pohjakuva_path: string | null
}
type EntryRow = { worksite_id: string; entry_type: string; hours: number | null; total_sum: number | null; entry_date: string; tekija: string | null; amount: number | null; unit_price: number | null }

export default function AsentajaHome() {
  const [worksites, setWorksites] = useState<WorksiteRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [nextSite, setNextSite] = useState<{ ws_name: string; alkaa: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user, profile } = useAuth()
  const hourlyRate = profile?.hourly_rate ?? 0
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const [siteRes, entryRes, miehRes] = await Promise.all([
      supabase.from('worksites').select('id, name, address, client_company, status, oma_tyomaa, lat, lng, gps_sade_m, perehdytys_url, mestari_nimi, mestari_puhelin, erityismaininnat, pohjakuva_path').eq('status', 'active').order('name'),
      supabase.from('entries').select('worksite_id, entry_type, hours, total_sum, entry_date, tekija, amount, unit_price').eq('user_id', user.id),
      // Seuraava varmistettu työmaa: RLS näyttää asentajalle vain varmistetut
      supabase.from('miehitykset').select('alkaa, worksites(name)').eq('user_id', user.id).gt('alkaa', today()).order('alkaa').limit(1),
    ])
    if (siteRes.error) {
      setError('Työmaiden haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setWorksites(siteRes.data ?? [])
      const rivit = (entryRes.data ?? []).map((e) => ({ ...e, hours: e.hours === null ? null : Number(e.hours), total_sum: e.total_sum === null ? null : Number(e.total_sum), amount: e.amount === null ? null : Number(e.amount), unit_price: e.unit_price === null ? null : Number(e.unit_price) }))
      // Työparin kanssa etusivu näyttää vain MINUN osuuteni (yhteiset urakat jaettuna, parin omat pois)
      setEntries(profile?.tyopari_nimi ? kirjauksetHenkilolle(rivit, 'mina', profile.tyopari_osuus_pct ?? 50) : rivit)
      const mh = (miehRes.data ?? [])[0] as unknown as { alkaa: string; worksites: { name: string } | null } | undefined
      setNextSite(mh?.worksites?.name ? { ws_name: mh.worksites.name, alkaa: mh.alkaa } : null)
    }
    setLoading(false)
  }, [user, profile?.tyopari_nimi, profile?.tyopari_osuus_pct])

  useEffect(() => { fetchAll() }, [fetchAll])

  // GPS-työmaatunnistus: vapaaehtoinen, toimii vain kun äppi on auki.
  const [gpsOn, setGpsOn] = useState<boolean | null>(null)
  const [gpsSite, setGpsSite] = useState<WorksiteRow | null>(null)
  const [gpsChecked, setGpsChecked] = useState(false)

  useEffect(() => {
    if (gpsOn === null && profile) setGpsOn(profile.gps_sallittu ?? false)
  }, [profile, gpsOn])

  useEffect(() => {
    if (!gpsOn || worksites.length === 0 || gpsChecked || !user || !profile) return
    setGpsChecked(true)
    getPosition().then(async (pos) => {
      if (!pos) return
      const hit = findNearestSite(worksites, pos.lat, pos.lng)
      if (!hit) return
      setGpsSite(hit.site)
      // Käyntiloki tuntilappua varten (yksi rivi / päivä / työmaa)
      if (navigator.onLine) {
        await supabase.from('site_visits').upsert({
          organization_id: profile.organization_id, worksite_id: hit.site.id,
          user_id: user.id, user_name: profile.full_name ?? '', pvm: today(),
          last_seen: new Date().toISOString(), source: 'gps',
        }, { onConflict: 'user_id,worksite_id,pvm' })
      }
    })
  }, [gpsOn, worksites, gpsChecked, user, profile])

  // Työmaa puuttuu: pyyntö työnjohdolle TAI oma työmaa heti käyttöön
  const [missingOpen, setMissingOpen] = useState(false)
  const [missingMode, setMissingMode] = useState<'pyynto' | 'oma'>(OMA_KAYTTO ? 'oma' : 'pyynto')
  const [mf, setMf] = useState({ name: '', address: '', tilaaja: '', huom: '' })
  const [missingSaving, setMissingSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Vapautumisilmoitus: koska vapaudun työmaalta (varma tai arvio).
  // Avataan myös Lisää-näkymästä linkillä /?vapautus=1
  const [vapOpen, setVapOpen] = useState(false)
  const [vf, setVf] = useState({ wsId: '', pvm: '', varma: false, huom: '' })
  const [vapSaving, setVapSaving] = useState(false)

  useEffect(() => {
    if (searchParams.get('vapautus') === '1') {
      setVapOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  async function saveMissing() {
    if (!user || !profile || !mf.name.trim() || missingSaving) return
    setMissingSaving(true)
    const { error: insErr } = await supabase.from('worksites').insert({
      organization_id: profile.organization_id,
      name: mf.name.trim(), address: mf.address.trim() || null,
      client_company: mf.tilaaja.trim() || null,
      erityismaininnat: mf.huom.trim() || null,
      status: missingMode === 'oma' ? 'active' : 'pyynto',
      oma_tyomaa: missingMode === 'oma',
      created_by: user.id,
    })
    if (insErr) setToast('Tallennus epäonnistui')
    else {
      setToast(missingMode === 'oma'
        ? `${mf.name.trim()} luotu — voit kirjata heti`
        : 'Pyyntö lähetetty työnjohdolle — työmaa ilmestyy kun se on hyväksytty')
      setMissingOpen(false)
      setMf({ name: '', address: '', tilaaja: '', huom: '' })
      if (missingMode === 'oma') fetchAll()
    }
    setMissingSaving(false)
  }

  async function saveVapautus() {
    if (!user || !profile || !vf.wsId || !vf.pvm || vapSaving) return
    setVapSaving(true)
    const { error: upErr } = await supabase.from('vapautumiset').upsert({
      organization_id: profile.organization_id, user_id: user.id,
      user_name: profile.full_name ?? '', worksite_id: vf.wsId,
      pvm: vf.pvm, varma: vf.varma, huom: vf.huom.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,worksite_id' })
    if (upErr) setToast('Tallennus epäonnistui')
    else {
      setToast(`Vapautuminen ilmoitettu: ${vf.varma ? 'varma' : 'arvio'} — työnjohto näkee sen kalenterissa`)
      setVapOpen(false)
      setVf({ wsId: '', pvm: '', varma: false, huom: '' })
    }
    setVapSaving(false)
  }

  async function enableGps() {
    const pos = await getPosition()
    if (!pos) return
    setGpsOn(true)
    if (user) await supabase.from('profiles').update({ gps_sallittu: true }).eq('id', user.id)
  }

  async function openPohjakuva(path: string) {
    const { data } = await supabase.storage.from('arkisto').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

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

  // Kuukauden palkkakooste: urakat euroina, tunnit tunteina omalla tuntipalkalla.
  // Keskituntipalkka on laskennallinen (ansio / työpäivät × 7,5 h) — todellinen KTA
  // vaatisi urakkaan käytettyjen tuntien kirjaamisen.
  const month = useMemo(() => {
    const now = new Date()
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const list = entries.filter((e) => e.entry_date >= first)
    const urakkaEur = list.filter((e) => e.entry_type !== 'tunti').reduce((s, e) => s + (e.total_sum ?? 0), 0)
    const tuntiH = list.filter((e) => e.entry_type === 'tunti').reduce((s, e) => s + (e.hours ?? 0), 0)
    const tuntiEur = tuntiH * hourlyRate
    const totalEur = urakkaEur + tuntiEur
    const days = new Set(list.map((e) => e.entry_date)).size
    return {
      urakkaEur, tuntiH, tuntiEur, totalEur, days,
      kta: days > 0 ? totalEur / (days * 7.5) : 0,
      urakkaPct: totalEur > 0 ? Math.round((urakkaEur / totalEur) * 100) : 0,
      nimi: ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'][now.getMonth()],
    }
  }, [entries, hourlyRate])

  const total = useMemo(() => entries.reduce((s, e) => s + entryValue(e), 0), [entries, entryValue])
  const siteSums = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach((e) => m.set(e.worksite_id, (m.get(e.worksite_id) ?? 0) + entryValue(e)))
    return m
  }, [entries, entryValue])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1><img src="/mattomies-logo.webp" alt="Mattomies Äppi" className="h-8 w-auto" /></h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{profile?.full_name}</span>
          {!OMA_KAYTTO && <button onClick={() => navigate('/ilmoitukset')} aria-label="Ilmoitukset" className="p-3 -m-1 text-gray-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>}
        </div>
      </header>

      <main className="px-4 py-5 pb-28 max-w-md mx-auto">
        {/* GPS: olet työmaalla X — esitiedot ilman valikoita */}
        {gpsSite && (
          <section className="bg-gray-900 border border-amber-500/50 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-amber-400">Olet työmaalla</p>
            <div>
              <p className="font-bold text-lg leading-tight">{gpsSite.name}</p>
              {gpsSite.client_company && <p className="text-sm text-gray-400">{gpsSite.client_company}</p>}
            </div>
            {gpsSite.erityismaininnat && (
              <p className="text-sm text-amber-200 bg-amber-500/10 rounded-xl px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {gpsSite.erityismaininnat}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigate(`/tyomaa/${gpsSite.id}`)}
                className="col-span-2 py-3 bg-amber-500 text-gray-950 rounded-xl text-sm font-bold">
                Avaa työmaa ja kirjaa
              </button>
              {gpsSite.mestari_puhelin && (
                <a href={`tel:${gpsSite.mestari_puhelin}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold">
                  <Phone className="w-3.5 h-3.5 text-amber-400" /> {gpsSite.mestari_nimi ?? 'Mestari'}
                </a>
              )}
              {gpsSite.perehdytys_url && (
                <a href={gpsSite.perehdytys_url} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-400" /> Perehdytys
                </a>
              )}
              {gpsSite.pohjakuva_path && (
                <button onClick={() => openPohjakuva(gpsSite.pohjakuva_path!)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold">
                  <MapIcon className="w-3.5 h-3.5 text-amber-400" /> Pohjakuva
                </button>
              )}
              {gpsSite.address && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gpsSite.address)}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold">
                  <Navigation className="w-3.5 h-3.5 text-amber-400" /> Navigoi
                </a>
              )}
            </div>
          </section>
        )}

        {gpsOn === false && (
          <button onClick={enableGps}
            className="w-full flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-4 text-left">
            <span className="text-sm">
              <span className="font-medium block">Työmaan tunnistus sijainnista</span>
              <span className="text-xs text-gray-500">Vain kun avaat äpin. Ei taustaseurantaa.</span>
            </span>
            <span className="text-sm font-semibold text-amber-400 shrink-0">Ota käyttöön</span>
          </button>
        )}

        {/* Kuukauden palkkakooste: yksi luku isona, erittely tilikirjan riveinä */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-gray-400">Palkka, {month.nimi}</h2>
            <p className="text-2xl font-semibold tabular-nums">{eur(month.totalEur)}</p>
          </div>
          <dl className="mt-3 pt-3 border-t border-gray-800 space-y-1.5 text-sm tabular-nums">
            <div className="flex justify-between"><dt className="text-gray-400">Urakat</dt><dd>{eur(month.urakkaEur)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Tunnit {String(Math.round(month.tuntiH * 10) / 10).replace('.', ',')} h</dt>
              <dd>{eur(month.tuntiEur)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-gray-400">Keskituntipalkka*</dt><dd>{month.days > 0 ? eur(month.kta) : '–'}</dd></div>
            <div className="flex justify-between pt-1.5"><dt className="text-gray-500">Työpäiviä</dt><dd className="text-gray-400">{month.days}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Viimeiset 7 päivää</dt><dd className="text-gray-400">{eur(week.sum)}</dd></div>
            {total > 0 && <div className="flex justify-between"><dt className="text-gray-500">Kaikki kirjaukset</dt><dd className="text-gray-400">{eur(total)}</dd></div>}
          </dl>
          <p className="text-xs text-gray-600 mt-3">* Laskennallinen: kuukauden ansio jaettuna työpäivät × 7,5 h.</p>
        </section>

        {/* Työnjohdon varmistama seuraava työmaa — ei enää maanantaiaamun soittoa */}
        {!OMA_KAYTTO && nextSite && (
          <div className="flex items-center gap-2.5 bg-gray-900 border border-amber-500/40 rounded-xl px-4 py-3 mb-4">
            <CalendarClock className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm">
              <span className="text-gray-400">Seuraava työmaa:</span> <b>{nextSite.ws_name}</b>
              <span className="text-gray-400"> · alkaen {formatDate(nextSite.alkaa)}</span>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Työmaat</h2>
          {OMA_KAYTTO ? (
            <button onClick={() => setMissingOpen(true)} className="px-3 py-2 -my-2 text-sm font-semibold text-amber-400">
              + Lisää työmaa
            </button>
          ) : (
            <button onClick={() => setMissingOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <HelpCircle className="w-4 h-4" /> Työmaa puuttuu?
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="bg-gray-900 rounded-xl h-24 animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
              <RefreshCw className="w-4 h-4" /> Yritä uudelleen
            </button>
          </div>
        )}

        {!loading && !error && worksites.length === 0 && (
          <p className="text-gray-500 text-sm">{OMA_KAYTTO ? 'Ei työmaita vielä. Lisää ensimmäinen yläpuolen napista.' : 'Ei aktiivisia työmaita. Uudet työmaat ilmestyvät tähän, kun työnjohto lisää ne.'}</p>
        )}

        {!loading && !error && worksites.length > 0 && (
          <div className="space-y-3">
            {worksites.map((site) => {
              const sum = siteSums.get(site.id) ?? 0
              return (
                <button key={site.id} onClick={() => navigate(`/tyomaa/${site.id}`)}
                  className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 active:bg-gray-800 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{site.name}</p>
                      {(site.address || site.client_company) && (
                        <p className="text-sm text-gray-400 mt-1 truncate">
                          {[site.address, site.client_company].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sum > 0 && <span className="text-sm font-semibold tabular-nums text-gray-200">{eur(sum)}</span>}
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Työmaa puuttuu: pyyntö tai oma työmaa */}
      {missingOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setMissingOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{OMA_KAYTTO ? 'Uusi työmaa' : 'Työmaa puuttuu listalta'}</h3>
              <button onClick={() => setMissingOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            {!OMA_KAYTTO && <>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMissingMode('pyynto')}
                className={`py-2.5 rounded-xl text-sm font-semibold ${missingMode === 'pyynto' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Pyydä työnjohdolta
              </button>
              <button onClick={() => setMissingMode('oma')}
                className={`py-2.5 rounded-xl text-sm font-semibold ${missingMode === 'oma' ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                Oma työmaa
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {missingMode === 'pyynto'
                ? 'Työnjohto saa pyynnön ja luo työmaan esitietoineen. Käytä tätä kun kyseessä on firman kohde.'
                : 'Oma työmaa on heti käytettävissä kirjauksiin, mutta se ei ole työnjohdon putkessa. Käytä tätä omiin keikkoihin.'}
            </p>
            </>}

            <input type="text" value={mf.name} onChange={(e) => setMf({ ...mf, name: e.target.value })}
              placeholder="Työmaan nimi *" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <input type="text" value={mf.address} onChange={(e) => setMf({ ...mf, address: e.target.value })}
              placeholder="Osoite" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <input type="text" value={mf.tilaaja} onChange={(e) => setMf({ ...mf, tilaaja: e.target.value })}
              placeholder="Rakennusliike (tulee tililappuun)" className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <textarea value={mf.huom} onChange={(e) => setMf({ ...mf, huom: e.target.value })} rows={2}
              placeholder={missingMode === 'pyynto' ? 'Lisätieto työnjohdolle (tilaaja, kiireellisyys…)' : 'Lisätiedot'}
              className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />

            <button onClick={saveMissing} disabled={!mf.name.trim() || missingSaving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {missingSaving ? 'Tallennetaan…' : missingMode === 'pyynto' ? 'Lähetä pyyntö' : OMA_KAYTTO ? 'Lisää työmaa' : 'Luo oma työmaa'}
            </button>
          </div>
        </div>
      )}

      {/* Vapautumisilmoitus */}
      {vapOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end" onClick={() => setVapOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-gray-900 border-t border-gray-700 rounded-t-3xl p-5 pb-8 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-amber-400" /> Koska vapaudut?</h3>
              <button onClick={() => setVapOpen(false)} aria-label="Sulje" className="p-3 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-xs font-semibold text-gray-500">Miltä työmaalta</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {worksites.map((w) => (
                <button key={w.id} onClick={() => setVf({ ...vf, wsId: w.id })}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold ${vf.wsId === w.id ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {w.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Päivämäärä</p>
                <input type="date" value={vf.pvm} onChange={(e) => setVf({ ...vf, pvm: e.target.value })}
                  className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <button onClick={() => setVf({ ...vf, varma: !vf.varma })}
                className={`py-3 rounded-xl text-sm font-semibold ${vf.varma ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                {vf.varma ? 'Varma tieto' : 'Arvio'}
              </button>
            </div>

            <input type="text" value={vf.huom} onChange={(e) => setVf({ ...vf, huom: e.target.value })}
              placeholder="Lisätieto (esim. riippuu tasoitteen kuivumisesta)"
              className="w-full px-3.5 py-3 text-base bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />

            <button onClick={saveVapautus} disabled={!vf.wsId || !vf.pvm || vapSaving}
              className="w-full py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {vapSaving ? 'Tallennetaan…' : 'Ilmoita työnjohdolle'}
            </button>
            <p className="text-[11px] text-gray-600">Ilmoitus näkyy työnjohdon kalenterissa heti. Voit päivittää sitä milloin vain — uusi ilmoitus samalta työmaalta korvaa vanhan.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-700 text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" /> {toast}
        </div>
      )}

      <AlaNav />
    </div>
  )
}
