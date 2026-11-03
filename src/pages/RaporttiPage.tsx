import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OMA_KAYTTO } from '../lib/tila'
import { supabase } from '../lib/supabase'
import { eur, formatDate, toInput, payPeriod, today } from '../lib/helpers'
import { exportTililappuHeikkinen, toimitaLaput } from '../lib/tililappuExport'
import { tuntiRivit, teeTuntiPdf } from '../lib/tuntiPdf'
import type { PdfTyyppi } from '../lib/tuntiPdf'
import { weekMonday, isoWeek } from '../lib/kalenteri'
import type { LapunHenkilo } from '../lib/tililappuExport'
import { kirjauksetHenkilolle, osuusPct } from '../lib/tyopari'
import type { Henkilo } from '../lib/tyopari'

type ReportEntry = {
  id: string; entry_type: string; amount: number | null; hours: number | null
  unit_price: number | null; total_sum: number | null; description: string | null
  entry_date: string; hour_category: string | null; worksite_id: string
  tekija: string | null
  tes_codes: { code: string; description: string; unit: string } | null
  worksites: { name: string; client_company: string | null } | null
  mittapoytakirjat: { status: string; numero: number } | null
}

type PeriodKey = 'paiva' | 'vko' | 'edvko' | 'kausi' | 'oma' | 'all'

export default function RaporttiPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  // Työpari: raportti näytetään jommankumman henkilön silmin, tililaput saa molemmille
  const pariNimi = profile?.tyopari_nimi?.trim() || ''
  const pariPct = profile?.tyopari_osuus_pct ?? 50
  const [henkilo, setHenkilo] = useState<Henkilo>('mina')
  const nakyma: Henkilo = pariNimi ? henkilo : 'mina'
  const lapunHenkilo = useCallback((h: Henkilo): LapunHenkilo => h === 'pari'
    ? { nimi: pariNimi, henkilonumero: profile?.tyopari_henkilonumero, tuntipalkka: profile?.tyopari_tuntipalkka }
    : { nimi: profile?.full_name ?? '', henkilonumero: profile?.henkilonumero, tuntipalkka: profile?.hourly_rate },
  [pariNimi, profile])
  const hourlyRate = lapunHenkilo(nakyma).tuntipalkka ?? 0
  const cutoff = profile?.pay_period_cutoff ?? 15
  const worksiteFilter = params.get('tyomaa')

  const [period, setPeriod] = useState<PeriodKey>('vko')
  // Vapaa väli: yksi päivä tai mikä tahansa jakso (esim. päivän mittainen työmaa)
  const [omaAlku, setOmaAlku] = useState(today())
  const [omaLoppu, setOmaLoppu] = useState(today())
  const [allEntries, setAllEntries] = useState<ReportEntry[]>([])
  const [vainHyvaksytyt, setVainHyvaksytyt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Jakso. tiedosto = jakson lyhyt nimi PDF-tiedostoon (esim. "vko45")
  const range = useMemo((): { start: string | null; end: string | null; label: string; tiedosto: string } => {
    if (period === 'paiva') {
      const t = today()
      return { start: t, end: t, label: `Tänään ${formatDate(t)}`, tiedosto: t }
    }
    if (period === 'oma') {
      const a = omaAlku, b = omaLoppu < omaAlku ? omaAlku : omaLoppu
      return a === b
        ? { start: a, end: a, label: formatDate(a), tiedosto: a }
        : { start: a, end: b, label: `${formatDate(a)} – ${formatDate(b)}`, tiedosto: `${a}_${b}` }
    }
    if (period === 'vko' || period === 'edvko') {
      const ma = weekMonday(new Date())
      if (period === 'edvko') ma.setDate(ma.getDate() - 7)
      const su = new Date(ma); su.setDate(su.getDate() + 6)
      const vko = isoWeek(ma)
      const lyhyt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`
      return { start: toInput(ma), end: toInput(su), label: `Viikko ${vko} · ${lyhyt(ma)}–${formatDate(toInput(su))}`, tiedosto: `vko${vko}` }
    }
    if (period === 'kausi') {
      const p = payPeriod(cutoff)
      return { start: p.start, end: p.end, label: `Palkkakausi ${formatDate(p.start)} – ${formatDate(p.end)}`, tiedosto: `${p.start}_${p.end}` }
    }
    return { start: null, end: null, label: 'Kaikki kirjaukset', tiedosto: 'kaikki' }
  }, [period, cutoff, omaAlku, omaLoppu])

  const fetchEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    let q = supabase.from('entries')
      .select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, hour_category, worksite_id, tekija, tes_codes(code, description, unit), worksites(name, client_company), mittapoytakirjat(status, numero)')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
    if (worksiteFilter) q = q.eq('worksite_id', worksiteFilter)
    if (range.start) q = q.gte('entry_date', range.start)
    if (range.end) q = q.lte('entry_date', range.end)
    const { data, error } = await q
    if (error) {
      setError('Kirjausten haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setAllEntries((data ?? []).map((e) => ({
        ...e,
        amount: e.amount === null ? null : Number(e.amount),
        hours: e.hours === null ? null : Number(e.hours),
        unit_price: e.unit_price === null ? null : Number(e.unit_price),
        total_sum: e.total_sum === null ? null : Number(e.total_sum),
        tes_codes: e.tes_codes as unknown as ReportEntry['tes_codes'],
        worksites: e.worksites as unknown as ReportEntry['worksites'],
        mittapoytakirjat: e.mittapoytakirjat as unknown as ReportEntry['mittapoytakirjat'],
      })))
    }
    setLoading(false)
  }, [user, worksiteFilter, range.start, range.end])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Hyväksyntäsuodatin: näkymä ja KAIKKI lataukset (PDF, Excel, tililappu) noudattavat tätä
  const suodatetut = useMemo(
    () => (vainHyvaksytyt ? allEntries.filter((e) => e.mittapoytakirjat?.status === 'lukittu') : allEntries),
    [allEntries, vainHyvaksytyt],
  )
  // Valitun henkilön osuus: yhteiset urakat jaettuna, yhteiset tunnit kokonaan
  const entries = useMemo(
    () => (pariNimi ? kirjauksetHenkilolle(suodatetut, nakyma, pariPct) : suodatetut),
    [suodatetut, pariNimi, nakyma, pariPct],
  )

  const approval = useMemo(() => {
    const sum = (list: ReportEntry[]) => list.reduce((s, e) => s + (e.entry_type === 'tunti' ? (e.hours ?? 0) * hourlyRate : (e.total_sum ?? 0)), 0)
    const hyvaksytty = allEntries.filter((e) => e.mittapoytakirjat?.status === 'lukittu')
    const odottaa = allEntries.filter((e) => e.mittapoytakirjat?.status !== 'lukittu')
    return { hyvaksyttyCount: hyvaksytty.length, hyvaksyttySum: sum(hyvaksytty), odottaaCount: odottaa.length, odottaaSum: sum(odottaa) }
  }, [allEntries, hourlyRate])

  const stats = useMemo(() => {
    const urakat = entries.filter((e) => e.entry_type !== 'tunti')
    const tunnit = entries.filter((e) => e.entry_type === 'tunti')
    const urakkaSum = urakat.reduce((s, e) => s + (e.total_sum ?? 0), 0)
    const kuitatut = tunnit.filter((e) => e.hour_category === 'kuitattava').reduce((s, e) => s + (e.hours ?? 0), 0)
    const omat = tunnit.filter((e) => e.hour_category !== 'kuitattava').reduce((s, e) => s + (e.hours ?? 0), 0)
    const tuntiSum = (kuitatut + omat) * hourlyRate
    const paivat = new Set(entries.map((e) => e.entry_date)).size
    const bySite = new Map<string, { name: string; sum: number }>()
    entries.forEach((e) => {
      const key = e.worksite_id
      const val = e.entry_type === 'tunti' ? (e.hours ?? 0) * hourlyRate : (e.total_sum ?? 0)
      const cur = bySite.get(key)
      if (cur) cur.sum += val
      else bySite.set(key, { name: e.worksites?.name ?? 'Työmaa', sum: val })
    })
    return { urakat, tunnit, urakkaSum, kuitatut, omat, tuntiSum, paivat, total: urakkaSum + tuntiSum, bySite: [...bySite.values()] }
  }, [entries, hourlyRate])

  async function downloadPdf() {
    // jspdf ladataan vasta napin painalluksesta — pienempi aloituspaketti
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 18
    doc.setFontSize(16)
    doc.setTextColor(200, 120, 0)
    doc.text(range.label, 14, y); y += 8
    doc.setFontSize(10)
    doc.setTextColor(0)
    const tekijanNimi = lapunHenkilo(nakyma).nimi
    if (tekijanNimi) { doc.text('Asentaja: ' + tekijanNimi, 14, y); y += 6 }
    doc.text('Luotu: ' + formatDate(toInput(new Date())), 14, y); y += 8

    if (stats.urakat.length) {
      doc.setFontSize(11); doc.setTextColor(180, 100, 0)
      doc.text('URAKKATYOT', 14, y); y += 6
      doc.setFontSize(8); doc.setTextColor(0)
      stats.urakat.forEach((e) => {
        if (y > 278) { doc.addPage(); y = 18 }
        const name = e.tes_codes ? `${e.tes_codes.code} ${e.tes_codes.description}` : (e.description ?? '')
        const unit = e.tes_codes?.unit ?? ''
        const line = `${formatDate(e.entry_date)}  ${(e.worksites?.name ?? '').substring(0, 16)}  ${name.substring(0, 42)}  ${String(e.amount ?? '')}${unit}  ${e.total_sum !== null ? e.total_sum.toFixed(2) + ' e' : ''}`
        doc.text(line, 14, y); y += 4.5
      })
      y += 3
      doc.setFontSize(10)
      doc.text(`Urakat yhteensa: ${stats.urakkaSum.toFixed(2)} e`, 14, y); y += 8
    }
    if (stats.tunnit.length) {
      doc.setFontSize(11); doc.setTextColor(0, 90, 160)
      doc.text('TUNTITYOT', 14, y); y += 6
      doc.setFontSize(8); doc.setTextColor(0)
      stats.tunnit.forEach((e) => {
        if (y > 278) { doc.addPage(); y = 18 }
        const line = `${formatDate(e.entry_date)}  ${(e.worksites?.name ?? '').substring(0, 16)}  ${(e.description ?? '').substring(0, 40)}  ${String(e.hours ?? '')}h (${e.hour_category ?? ''})`
        doc.text(line, 14, y); y += 4.5
      })
      y += 3
      doc.setFontSize(10)
      doc.text(`Kuitatut: ${stats.kuitatut} h   Heikkisen tunnit: ${stats.omat} h`, 14, y); y += 8
    }
    doc.setFontSize(12); doc.setTextColor(0)
    doc.text(`KAIKKI YHTEENSA: ${stats.total.toFixed(2)} e`, 14, y)
    doc.save(`Raportti_${(tekijanNimi.split(' ')[0] || 'oma')}_${range.start ?? 'kaikki'}_${range.end ?? ''}.pdf`)
  }

  // Tuntierittely PDF: kuitattavat mestarille, kaikki tunnit omalle työnjohtajalle.
  // Työparin kanssa molempien tunnit samalla lapulla (mestari kuittaa koko porukan).
  const [pdfBusy, setPdfBusy] = useState<PdfTyyppi | null>(null)
  async function lataaTuntiPdf(tyyppi: PdfTyyppi) {
    setPdfBusy(tyyppi)
    try {
      const mina = profile?.full_name ?? ''
      const pari = pariNimi || null
      const pdf = await teeTuntiPdf({
        tyyppi,
        rivit: tuntiRivit(suodatetut, tyyppi, mina, pari),
        jakso: range.label,
        tiedostoJakso: range.tiedosto,
        tyontekijat: pari ? [mina, pari] : [mina],
      })
      await toimitaLaput([pdf])
    } catch (e) {
      console.error('Tunti-PDF epäonnistui:', e)
    }
    setPdfBusy(null)
  }
  const kuitattaviaTunteja = suodatetut.some((e) => e.entry_type === 'tunti' && e.hour_category === 'kuitattava')
  const tunteja = suodatetut.some((e) => e.entry_type === 'tunti')

  const [excelBusy, setExcelBusy] = useState(false)
  async function downloadHeikkinen(kenelle: Henkilo[] = [nakyma]) {
    setExcelBusy(true)
    try {
      // GPS-käyntiloki mukaan: tuntilappu näyttää joka päivälle kaikki työmaat joilla oltiin
      let visits: { pvm: string; siteName: string }[] = []
      if (user) {
        let vq = supabase.from('site_visits').select('pvm, worksites(name)').eq('user_id', user.id)
        if (range.start) vq = vq.gte('pvm', range.start)
        if (range.end) vq = vq.lte('pvm', range.end)
        const { data: vData } = await vq
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        visits = (vData ?? []).map((v: any) => ({ pvm: v.pvm, siteName: v.worksites?.name ?? 'Työmaa' }))
      }
      const laput = []
      for (const h of kenelle) {
        const omat = pariNimi ? kirjauksetHenkilolle(suodatetut, h, pariPct) : suodatetut
        laput.push(await exportTililappuHeikkinen(omat as never, lapunHenkilo(h), range.start, range.end, visits))
      }
      await toimitaLaput(laput)
    } catch (e) {
      console.error('Heikkisen pohjan täyttö epäonnistui, käytetään perusmuotoa:', e)
      await downloadExcel()
    }
    setExcelBusy(false)
  }

  async function downloadExcel() {
    // xlsx ladataan vasta napin painalluksesta — pienempi aloituspaketti
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const bySiteEntries = new Map<string, ReportEntry[]>()
    entries.forEach((e) => {
      const key = e.worksites?.name ?? 'Työmaa'
      const arr = bySiteEntries.get(key) ?? []
      arr.push(e)
      bySiteEntries.set(key, arr)
    })
    let idx = 0
    bySiteEntries.forEach((list, siteName) => {
      idx++
      const urakat = list.filter((e) => e.entry_type !== 'tunti')
      const tunnitK = list.filter((e) => e.entry_type === 'tunti' && e.hour_category === 'kuitattava').reduce((s, e) => s + (e.hours ?? 0), 0)
      const tunnitO = list.filter((e) => e.entry_type === 'tunti' && e.hour_category !== 'kuitattava').reduce((s, e) => s + (e.hours ?? 0), 0)
      const rows: (string | number)[][] = [
        ['Työntekijä', profile?.full_name ?? ''],
        ['Rakennusliike', list[0]?.worksites?.client_company ?? ''],
        ['Työmaa', siteName],
        ['Alkupvm', range.start ?? ''],
        ['Loppupvm', range.end ?? ''],
        [],
        ['määrä', 'yks.', 'URAKKATYÖT', 'á-hinta', 'yht. euroa'],
      ]
      urakat.forEach((e) => {
        rows.push([
          e.amount ?? '',
          e.tes_codes?.unit ?? '',
          e.tes_codes ? `${e.tes_codes.code} ${e.tes_codes.description}` : (e.description ?? ''),
          e.unit_price ?? '',
          e.total_sum ?? '',
        ])
      })
      rows.push([])
      rows.push(['', '', 'Urakka yht.', '', urakat.reduce((s, e) => s + (e.total_sum ?? 0), 0)])
      rows.push([tunnitK, 't', 'Kuitatut tunnit', hourlyRate, tunnitK * hourlyRate])
      rows.push([tunnitO, 't', 'Tuntityöt', hourlyRate, tunnitO * hourlyRate])
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 8 }, { wch: 6 }, { wch: 45 }, { wch: 8 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws, `Taul${idx}`)
    })
    // Tuntilappu
    const tlRows: (string | number)[][] = [
      ['TUNTILAPPU'],
      ['Työntekijä', profile?.full_name ?? '', '', 'Ajalta', `${range.start ?? ''} - ${range.end ?? ''}`],
      [],
      ['Pvm', 'Tehdyt tunnit', 'Työmaa', 'Kuitatut tunnit', 'Heikkisen tunnit'],
    ]
    entries.filter((e) => e.entry_type === 'tunti').slice().reverse().forEach((e) => {
      tlRows.push([
        formatDate(e.entry_date),
        e.hours ?? '',
        e.worksites?.name ?? '',
        e.hour_category === 'kuitattava' ? (e.hours ?? '') : '',
        e.hour_category !== 'kuitattava' ? (e.hours ?? '') : '',
      ])
    })
    const tlWs = XLSX.utils.aoa_to_sheet(tlRows)
    tlWs['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, tlWs, 'Tuntilappu')
    XLSX.writeFile(wb, `Tililappu_${range.start ?? 'kaikki'}_${range.end ?? ''}.xlsx`)
  }

  const periodBtn = (key: PeriodKey, label: string) => (
    <button onClick={() => setPeriod(key)} className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${period === key ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>{label}</button>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate(worksiteFilter ? `/tyomaa/${worksiteFilter}` : '/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">Raportti {worksiteFilter ? '· työmaa' : '· kaikki työmaat'}</h1>
      </header>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {periodBtn('paiva', 'Tänään')}
          {periodBtn('vko', 'Tämä vko')}
          {periodBtn('edvko', 'Ed. vko')}
          {periodBtn('kausi', 'Palkkakausi')}
          {periodBtn('oma', 'Valitse päivät')}
          {periodBtn('all', 'Kaikki')}
        </div>
        {period === 'oma' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Alkaen</span>
              <input type="date" value={omaAlku}
                onChange={(e) => { const v = e.target.value; if (!v) return; setOmaAlku(v); if (omaLoppu < v) setOmaLoppu(v) }}
                className="w-full px-3 py-3 text-base bg-gray-800 border border-gray-700 rounded-lg [color-scheme:dark]" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Päättyen</span>
              <input type="date" value={omaLoppu} min={omaAlku}
                onChange={(e) => { if (e.target.value) setOmaLoppu(e.target.value) }}
                className="w-full px-3 py-3 text-base bg-gray-800 border border-gray-700 rounded-lg [color-scheme:dark]" />
            </label>
          </div>
        )}
        <p className="text-sm text-gray-400">{range.label}</p>

        {pariNimi && (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {(['mina', 'pari'] as const).map((h) => (
                <button key={h} onClick={() => setHenkilo(h)}
                  className={`py-2.5 rounded-lg text-sm font-semibold truncate px-2 ${nakyma === h ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
                  {(lapunHenkilo(h).nimi || (h === 'mina' ? 'Minä' : 'Työpari')).split(' ')[0]} · {osuusPct(h, pariPct)} %
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Prosentti on osuus yhteisistä urakoista. Yhteiset tunnit tulevat molemmille kokonaan.</p>
          </div>
        )}

        {loading && <div className="bg-gray-900 rounded-xl h-40 animate-pulse" />}

        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchEntries} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Yhteenveto tilikirjan riveinä: yksi summa isona, loput erittelynä */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm text-gray-400">Yhteensä</h2>
                <p className="text-2xl font-semibold tabular-nums">{eur(stats.total)}</p>
              </div>
              <dl className="mt-3 pt-3 border-t border-gray-800 space-y-1.5 text-sm tabular-nums">
                <div className="flex justify-between"><dt className="text-gray-400">Urakat ({stats.urakat.length} kpl)</dt><dd>{eur(stats.urakkaSum)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Kuitatut tunnit</dt><dd>{String(stats.kuitatut).replace('.', ',')} h</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Heikkisen tunnit</dt><dd>{String(stats.omat).replace('.', ',')} h</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Tunnit € ({eur(hourlyRate)}/h)</dt><dd>{eur(stats.tuntiSum)}</dd></div>
                <div className="flex justify-between pt-1.5"><dt className="text-gray-500">Kirjauksia · työpäiviä</dt><dd className="text-gray-400">{entries.length} · {stats.paivat}</dd></div>
              </dl>
            </section>

            {/* Hyväksyntäketju: mestarin kuittaamat vs. odottavat (piilossa omassa käytössä) */}
            {!OMA_KAYTTO && <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <dl className="space-y-1.5 text-sm tabular-nums">
                <div className="flex justify-between"><dt className="text-gray-400">Mestarin hyväksymät ({approval.hyvaksyttyCount})</dt><dd className="text-green-400">{eur(approval.hyvaksyttySum)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Odottaa hyväksyntää ({approval.odottaaCount})</dt><dd>{eur(approval.odottaaSum)}</dd></div>
              </dl>
              <button
                onClick={() => setVainHyvaksytyt((v) => !v)}
                aria-pressed={vainHyvaksytyt}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${vainHyvaksytyt ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}
              >
                {vainHyvaksytyt ? 'Vain hyväksytyt (koskee myös latauksia)' : 'Näytä vain mestarin hyväksymät'}
              </button>
            </section>}

            {!worksiteFilter && stats.bySite.length > 1 && (
              <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-medium text-gray-500 mb-1">Työmaittain</p>
                {stats.bySite.map((s) => (
                  <p key={s.name} className="flex justify-between text-sm"><span className="text-gray-300">{s.name}</span><span className="font-semibold">{eur(s.sum)}</span></p>
                ))}
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-300">Tililappu</h2>
              {pariNimi ? (
                <button onClick={() => downloadHeikkinen(['mina', 'pari'])} disabled={suodatetut.length === 0 || excelBusy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-bold rounded-xl disabled:opacity-40">
                  <FileSpreadsheet className="w-4 h-4" /> {excelBusy ? 'Täytetään…' : `Tililaput: ${lapunHenkilo('mina').nimi.split(' ')[0]} ja ${pariNimi.split(' ')[0]}`}
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => downloadHeikkinen()} disabled={entries.length === 0 || excelBusy}
                  className={`flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl disabled:opacity-40 ${pariNimi ? 'bg-gray-800 border border-gray-700' : 'bg-amber-500 text-gray-950'}`}>
                  <FileSpreadsheet className="w-4 h-4" /> {excelBusy ? 'Täytetään…' : pariNimi ? `Vain ${lapunHenkilo(nakyma).nimi.split(' ')[0]}` : 'Tililappu'}
                </button>
                <button onClick={downloadPdf} disabled={entries.length === 0}
                  className="flex items-center justify-center gap-2 py-3.5 bg-gray-800 border border-gray-700 font-semibold rounded-xl disabled:opacity-40">
                  <FileText className="w-4 h-4" /> Yhteenveto PDF
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-300">Tuntierittely PDF</h2>
              <button onClick={() => lataaTuntiPdf('kuitattavat')} disabled={!kuitattaviaTunteja || pdfBusy !== null}
                className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg disabled:opacity-40">
                <span className="block font-semibold">{pdfBusy === 'kuitattavat' ? 'Tehdään…' : 'Kuitattavat tunnit'}</span>
                <span className="block text-xs text-gray-500">Rakennusmestarille. Oma sivu joka työmaalle ja kuittauskohta.</span>
              </button>
              <button onClick={() => lataaTuntiPdf('kaikki')} disabled={!tunteja || pdfBusy !== null}
                className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg disabled:opacity-40">
                <span className="block font-semibold">{pdfBusy === 'kaikki' ? 'Tehdään…' : 'Kaikki tunnit'}</span>
                <span className="block text-xs text-gray-500">Omalle työnjohtajalle. Kuitattavat ja Heikkisen tunnit kaikilta työmailta.</span>
              </button>
            </section>

            {entries.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Ei kirjauksia valitulla aikavälillä.</p>}

            {entries.length > 0 && (
              <section className="space-y-1.5">
                <p className="text-sm font-medium text-gray-500">Kirjaukset</p>
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{e.tes_codes ? `${e.tes_codes.code} ${e.tes_codes.description}` : (e.description ?? e.entry_type)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(e.entry_date)}{!worksiteFilter && e.worksites ? ` · ${e.worksites.name}` : ''} · {e.entry_type === 'tunti' ? `${String(e.hours).replace('.', ',')} h (${e.hour_category === 'kuitattava' ? 'kuitattava' : 'Heikkinen'})` : `${String(e.amount ?? '').replace('.', ',')} ${e.tes_codes?.unit ?? ''}`}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${e.entry_type === 'tunti' ? 'text-gray-400' : 'text-gray-100'}`}>
                      {e.entry_type === 'tunti' ? eur((e.hours ?? 0) * hourlyRate) : e.total_sum !== null ? eur(e.total_sum) : '–'}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
