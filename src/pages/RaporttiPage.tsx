import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { eur, formatDate, toInput, payPeriod } from '../lib/helpers'
import { exportTililappuHeikkinen } from '../lib/tililappuExport'

type ReportEntry = {
  id: string; entry_type: string; amount: number | null; hours: number | null
  unit_price: number | null; total_sum: number | null; description: string | null
  entry_date: string; hour_category: string | null; worksite_id: string
  tes_codes: { code: string; description: string; unit: string } | null
  worksites: { name: string; client_company: string | null } | null
}

type PeriodKey = 'week' | 'month' | 'kausi' | 'all'

export default function RaporttiPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const hourlyRate = profile?.hourly_rate ?? 0
  const cutoff = profile?.pay_period_cutoff ?? 15
  const worksiteFilter = params.get('tyomaa')

  const [period, setPeriod] = useState<PeriodKey>('week')
  const [entries, setEntries] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo((): { start: string | null; end: string | null; label: string } => {
    const now = new Date()
    if (period === 'week') {
      const s = new Date(now); s.setDate(s.getDate() - 7)
      return { start: toInput(s), end: toInput(now), label: 'Viimeiset 7 päivää' }
    }
    if (period === 'month') {
      const s = new Date(now); s.setDate(s.getDate() - 30)
      return { start: toInput(s), end: toInput(now), label: 'Viimeiset 30 päivää' }
    }
    if (period === 'kausi') {
      const p = payPeriod(cutoff)
      return { start: p.start, end: p.end, label: `Palkkakausi ${formatDate(p.start)} – ${formatDate(p.end)}` }
    }
    return { start: null, end: null, label: 'Kaikki kirjaukset' }
  }, [period, cutoff])

  const fetchEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    let q = supabase.from('entries')
      .select('id, entry_type, amount, hours, unit_price, total_sum, description, entry_date, hour_category, worksite_id, tes_codes(code, description, unit), worksites(name, client_company)')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
    if (worksiteFilter) q = q.eq('worksite_id', worksiteFilter)
    if (range.start) q = q.gte('entry_date', range.start)
    if (range.end) q = q.lte('entry_date', range.end)
    const { data, error } = await q
    if (error) {
      setError('Kirjausten haku epäonnistui. Tarkista verkkoyhteys.')
    } else {
      setEntries((data ?? []).map((e) => ({
        ...e,
        amount: e.amount === null ? null : Number(e.amount),
        hours: e.hours === null ? null : Number(e.hours),
        unit_price: e.unit_price === null ? null : Number(e.unit_price),
        total_sum: e.total_sum === null ? null : Number(e.total_sum),
        tes_codes: e.tes_codes as unknown as ReportEntry['tes_codes'],
        worksites: e.worksites as unknown as ReportEntry['worksites'],
      })))
    }
    setLoading(false)
  }, [user, worksiteFilter, range.start, range.end])

  useEffect(() => { fetchEntries() }, [fetchEntries])

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

  function downloadPdf() {
    const doc = new jsPDF()
    let y = 18
    doc.setFontSize(16)
    doc.setTextColor(200, 120, 0)
    doc.text(range.label, 14, y); y += 8
    doc.setFontSize(10)
    doc.setTextColor(0)
    if (profile?.full_name) { doc.text('Asentaja: ' + profile.full_name, 14, y); y += 6 }
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
      doc.text(`Kuitatut: ${stats.kuitatut} h   Omat: ${stats.omat} h`, 14, y); y += 8
    }
    doc.setFontSize(12); doc.setTextColor(0)
    doc.text(`KAIKKI YHTEENSA: ${stats.total.toFixed(2)} e`, 14, y)
    doc.save(`Raportti_${range.start ?? 'kaikki'}_${range.end ?? ''}.pdf`)
  }

  const [excelBusy, setExcelBusy] = useState(false)
  async function downloadHeikkinen() {
    setExcelBusy(true)
    try {
      await exportTililappuHeikkinen(
        entries as never,
        profile?.full_name ?? '',
        range.start,
        range.end,
      )
    } catch (e) {
      console.error('Heikkisen pohjan täyttö epäonnistui, käytetään perusmuotoa:', e)
      downloadExcel()
    }
    setExcelBusy(false)
  }

  function downloadExcel() {
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
      ['Pvm', 'Tehdyt tunnit', 'Työmaa', 'Kuitatut tunnit', 'Omat tunnit'],
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
    <button onClick={() => setPeriod(key)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${period === key ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>{label}</button>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate(worksiteFilter ? `/tyomaa/${worksiteFilter}` : '/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-500" /> Raportti {worksiteFilter ? '· työmaa' : '· kaikki työmaat'}
        </h1>
      </header>

      <main className="px-4 py-5 pb-20 max-w-md mx-auto space-y-5">
        <div className="flex gap-2">
          {periodBtn('week', '7 pv')}
          {periodBtn('month', '30 pv')}
          {periodBtn('kausi', 'Palkkakausi')}
          {periodBtn('all', 'Kaikki')}
        </div>
        <p className="text-sm text-gray-400">{range.label}</p>

        {loading && <div className="bg-gray-900 rounded-2xl h-40 animate-pulse" />}

        {error && (
          <div className="bg-red-950/60 border border-red-900 rounded-2xl p-4 space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={fetchEntries} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl text-sm font-medium"><RefreshCw className="w-4 h-4" /> Yritä uudelleen</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="grid grid-cols-3 gap-3 text-center mb-4">
                <div><p className="text-xl font-bold">{entries.length}</p><p className="text-xs text-gray-500">kirjausta</p></div>
                <div><p className="text-xl font-bold">{stats.paivat}</p><p className="text-xs text-gray-500">työpäivää</p></div>
                <div><p className="text-xl font-bold text-green-400">{eur(stats.total)}</p><p className="text-xs text-gray-500">yhteensä</p></div>
              </div>
              <div className="space-y-1.5 text-sm border-t border-gray-800 pt-3">
                <p className="flex justify-between"><span className="text-gray-400">Urakat ({stats.urakat.length} kpl)</span><span className="font-semibold">{eur(stats.urakkaSum)}</span></p>
                <p className="flex justify-between"><span className="text-gray-400">Kuitatut tunnit</span><span className="font-semibold">{String(stats.kuitatut).replace('.', ',')} h</span></p>
                <p className="flex justify-between"><span className="text-gray-400">Omat tunnit</span><span className="font-semibold">{String(stats.omat).replace('.', ',')} h</span></p>
                <p className="flex justify-between"><span className="text-gray-400">Tunnit € ({eur(hourlyRate)}/h)</span><span className="font-semibold">{eur(stats.tuntiSum)}</span></p>
              </div>
            </section>

            {!worksiteFilter && stats.bySite.length > 1 && (
              <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Työmaittain</p>
                {stats.bySite.map((s) => (
                  <p key={s.name} className="flex justify-between text-sm"><span className="text-gray-300">{s.name}</span><span className="font-semibold">{eur(s.sum)}</span></p>
                ))}
              </section>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadPdf} disabled={entries.length === 0}
                className="flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-gray-950 font-semibold rounded-xl disabled:opacity-40">
                <FileText className="w-4 h-4" /> Lataa PDF
              </button>
              <button onClick={downloadHeikkinen} disabled={entries.length === 0 || excelBusy}
                className="flex items-center justify-center gap-2 py-3.5 bg-gray-800 border border-gray-700 font-semibold rounded-xl disabled:opacity-40">
                <FileSpreadsheet className="w-4 h-4" /> {excelBusy ? 'Täytetään…' : 'Tililappu (Excel)'}
              </button>
            </div>

            {entries.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Ei kirjauksia valitulla aikavälillä.</p>}

            {entries.length > 0 && (
              <section className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase">Kirjaukset</p>
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{e.tes_codes ? `${e.tes_codes.code} ${e.tes_codes.description}` : (e.description ?? e.entry_type)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(e.entry_date)}{!worksiteFilter && e.worksites ? ` · ${e.worksites.name}` : ''} · {e.entry_type === 'tunti' ? `${String(e.hours).replace('.', ',')} h (${e.hour_category})` : `${String(e.amount ?? '').replace('.', ',')} ${e.tes_codes?.unit ?? ''}`}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${e.entry_type === 'tunti' ? 'text-blue-300' : 'text-green-400'}`}>
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
