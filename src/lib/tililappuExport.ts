// Heikkisen virallisen tililappupohjan (1.6.2026) täyttö.
// Pohja ladataan /tililappu-pohja.xlsx ja täytetään niin, että pohjan omat
// VLOOKUP-kaavat hinnoittelevat rivit — kaavat ja muotoilut säilyvät.
import { TILILAPPU_NIMIKKEET } from './tililappuMap'
import { formatDate } from './helpers'
import type { ValmisLappu } from './toimita'

type TEntry = {
  entry_type: string
  amount: number | null
  hours: number | null
  unit_price: number | null
  description: string | null
  entry_date: string
  hour_category: string | null
  worksite_id: string
  tes_codes: { code: string; description: string; unit: string } | null
  worksites: { name: string; client_company: string | null } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFormulaCell(cell: any): boolean {
  if (cell.formula) return true
  const v = cell.value
  return !!(v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clearLiterals(ws: any, r1: number, r2: number, cols: string[]) {
  for (let r = r1; r <= r2; r++) {
    for (const c of cols) {
      const cell = ws.getCell(`${c}${r}`)
      if (!isFormulaCell(cell) && cell.value !== null && cell.value !== undefined) {
        cell.value = null
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setPlain(ws: any, addr: string, value: string | number | null) {
  const cell = ws.getCell(addr)
  if (!isFormulaCell(cell)) cell.value = value
}

export type DayVisit = { pvm: string; siteName: string }

/** Kenen tililappu: nimi, henkilönumero ja tuntipalkka lapun yläosaan ja tuntiriveille. */
export type LapunHenkilo = { nimi: string; henkilonumero?: string | null; tuntipalkka?: number | null }

export type { ValmisLappu } from './toimita'
export { toimitaLaput } from './toimita'

export async function exportTililappuHeikkinen(
  entries: TEntry[],
  henkilo: LapunHenkilo,
  rangeStart: string | null,
  rangeEnd: string | null,
  visits: DayVisit[] = [],
): Promise<ValmisLappu> {
  const workerName = henkilo.nimi
  const ExcelJS = await import('exceljs')
  const res = await fetch('/tililappu-pohja.xlsx')
  if (!res.ok) throw new Error('Pohjan lataus epäonnistui')
  const buf = await res.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)

  // Ryhmittele työmaittain
  const bySite = new Map<string, { name: string; client: string | null; list: TEntry[] }>()
  entries.forEach((e) => {
    const key = e.worksite_id
    const g = bySite.get(key) ?? { name: e.worksites?.name ?? 'Työmaa', client: e.worksites?.client_company ?? null, list: [] }
    g.list.push(e)
    bySite.set(key, g)
  })
  const sites = [...bySite.values()].slice(0, 10)

  // Tyhjennä KAIKKI Taul-välilehdet esimerkkidatasta
  for (let n = 1; n <= 10; n++) {
    const ws = wb.getWorksheet(`Taul${n}`)
    if (!ws) continue
    clearLiterals(ws, 10, 35, ['A', 'C', 'E'])
    clearLiterals(ws, 10, 21, ['H', 'I', 'J', 'L', 'M'])
    clearLiterals(ws, 27, 33, ['H'])
    setPlain(ws, 'J3', null); setPlain(ws, 'J4', null)
    setPlain(ws, 'J5', null); setPlain(ws, 'J6', null)
    // Nimi ja henkilönumero: Taul1:ssä arvo, muut välilehdet viittaavat siihen kaavalla
    setPlain(ws, 'J2', workerName)
    setPlain(ws, 'N2', henkilo.henkilonumero ?? null)
    // Tuntipalkka kuitattujen ja Heikkisen tuntien riveille (pohjassa on esimerkkiarvo 23)
    if (henkilo.tuntipalkka && henkilo.tuntipalkka > 0) {
      setPlain(ws, 'M32', henkilo.tuntipalkka)
      setPlain(ws, 'M33', henkilo.tuntipalkka)
    }
  }

  sites.forEach((site, idx) => {
    const ws = wb.getWorksheet(`Taul${idx + 1}`)
    if (!ws) return
    setPlain(ws, 'J2', workerName)
    setPlain(ws, 'J3', site.client ?? '')
    setPlain(ws, 'J4', site.name)
    setPlain(ws, 'J5', rangeStart ? formatDate(rangeStart) : '')
    setPlain(ws, 'J6', rangeEnd ? formatDate(rangeEnd) : '')

    // Urakat: summaa koodeittain
    const byCode = new Map<string, { code: string; sum: number; unit: string; desc: string; price: number | null }>()
    const vapaat: { name: string; sum: number; unit: string; price: number | null }[] = []
    site.list.forEach((e) => {
      if (e.entry_type === 'tunti') return
      if (e.tes_codes) {
        const g = byCode.get(e.tes_codes.code) ?? { code: e.tes_codes.code, sum: 0, unit: e.tes_codes.unit, desc: e.tes_codes.description, price: e.unit_price }
        g.sum += Number(e.amount ?? 0)
        byCode.set(e.tes_codes.code, g)
      } else {
        vapaat.push({ name: e.description ?? 'Työ', sum: Number(e.amount ?? 0), unit: 'm²', price: e.unit_price })
      }
    })

    let leftRow = 10
    const rightRows: { name: string; sum: number; unit: string; price: number | null }[] = [...vapaat]
    byCode.forEach((g) => {
      const nimike = TILILAPPU_NIMIKKEET[g.code]
      if (nimike && leftRow <= 35) {
        ws.getCell(`A${leftRow}`).value = Math.round(g.sum * 100) / 100
        ws.getCell(`C${leftRow}`).value = nimike
        leftRow++
      } else {
        rightRows.push({ name: `${g.code} ${g.desc}`, sum: g.sum, unit: g.unit, price: g.price })
      }
    })

    let rightRow = 10
    rightRows.forEach((r) => {
      if (rightRow > 21) return
      setPlain(ws, `H${rightRow}`, Math.round(r.sum * 100) / 100)
      const iCell = ws.getCell(`I${rightRow}`)
      if (!isFormulaCell(iCell)) iCell.value = r.unit
      setPlain(ws, `J${rightRow}`, r.name.substring(0, 50))
      const mCell = ws.getCell(`M${rightRow}`)
      if (!isFormulaCell(mCell) && r.price !== null) mCell.value = r.price
      rightRow++
    })

    // Tunnit
    const kuitatut = site.list.filter((e) => e.entry_type === 'tunti' && e.hour_category === 'kuitattava').reduce((s, e) => s + Number(e.hours ?? 0), 0)
    const omat = site.list.filter((e) => e.entry_type === 'tunti' && e.hour_category !== 'kuitattava').reduce((s, e) => s + Number(e.hours ?? 0), 0)
    if (kuitatut > 0) setPlain(ws, 'H32', kuitatut)
    if (omat > 0) setPlain(ws, 'H33', omat)
  })

  // Tuntilappu: jokaiselle päivälle KAIKKI työmaat joilla oltiin —
  // kirjauksista (urakat + tunnit) ja GPS-käyntilokista. Kahdella työmaalla
  // käyty päivä saa kaksi riviä.
  const tws = wb.getWorksheet('Tuntilappu')
  if (tws) {
    setPlain(tws, 'B4', workerName)
    setPlain(tws, 'E4', `${rangeStart ? formatDate(rangeStart) : ''} - ${rangeEnd ? formatDate(rangeEnd) : ''}`)
    clearLiterals(tws, 7, 45, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])

    type DaySite = { kuitattavat: number; omat: number; vainKaynti: boolean }
    const dayMap = new Map<string, Map<string, DaySite>>()
    const touch = (pvm: string, site: string): DaySite => {
      const day = dayMap.get(pvm) ?? new Map<string, DaySite>()
      const g = day.get(site) ?? { kuitattavat: 0, omat: 0, vainKaynti: true }
      day.set(site, g)
      dayMap.set(pvm, day)
      return g
    }
    entries.forEach((e) => {
      const g = touch(e.entry_date, e.worksites?.name ?? 'Työmaa')
      g.vainKaynti = false
      if (e.entry_type === 'tunti') {
        if (e.hour_category === 'kuitattava') g.kuitattavat += Number(e.hours ?? 0)
        else g.omat += Number(e.hours ?? 0)
      }
    })
    visits.forEach((v) => {
      if (rangeStart && v.pvm < rangeStart) return
      if (rangeEnd && v.pvm > rangeEnd) return
      touch(v.pvm, v.siteName)
    })

    let r = 7
    const days = [...dayMap.keys()].sort()
    for (const pvm of days) {
      const sitesOfDay = dayMap.get(pvm)!
      for (const [siteName, g] of sitesOfDay) {
        if (r > 45) break
        setPlain(tws, `A${r}`, formatDate(pvm))
        setPlain(tws, `D${r}`, siteName)
        const yht = g.kuitattavat + g.omat
        if (yht > 0) setPlain(tws, `C${r}`, yht)
        if (g.kuitattavat > 0) setPlain(tws, `F${r}`, g.kuitattavat)
        if (g.omat > 0) setPlain(tws, `G${r}`, g.omat)
        if (g.vainKaynti && yht === 0) setPlain(tws, `E${r}`, 'käynti (GPS)')
        r++
      }
    }
  }

  // Pohjaan on tallentunut esimerkkidatan LASKETUT tulokset. LibreOffice ei oletuksena
  // laske xlsx-kaavoja uudelleen avatessa, joten vanha tulos (esim. "Urakka yht.")
  // jäisi näkyviin. Poistetaan välimuistitulokset ja pyydetään täysi uudelleenlaskenta.
  wb.eachSheet((sheet) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheet.eachRow({ includeEmpty: false }, (row: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      row.eachCell({ includeEmpty: false }, (cell: any) => {
        const v = cell.value
        if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v) && 'result' in v) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { result, ...ilmanTulosta } = v
          cell.value = ilmanTulosta
        }
      })
    })
  })
  wb.calcProperties = { ...(wb.calcProperties ?? {}), fullCalcOnLoad: true }

  const out = await wb.xlsx.writeBuffer()
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const etunimi = workerName.trim().split(' ')[0] || 'tililappu'
  return { blob, tiedosto: `Tililappu_${etunimi}_${rangeStart ?? ''}_${rangeEnd ?? ''}.xlsx` }
}
