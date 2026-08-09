// Heikkisen virallisen tililappupohjan (1.6.2026) täyttö.
// Pohja ladataan /tililappu-pohja.xlsx ja täytetään niin, että pohjan omat
// VLOOKUP-kaavat hinnoittelevat rivit — kaavat ja muotoilut säilyvät.
import { TILILAPPU_NIMIKKEET } from './tililappuMap'
import { formatDate } from './helpers'

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

export async function exportTililappuHeikkinen(
  entries: TEntry[],
  workerName: string,
  rangeStart: string | null,
  rangeEnd: string | null,
): Promise<void> {
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

  // Tuntilappu
  const tws = wb.getWorksheet('Tuntilappu')
  if (tws) {
    setPlain(tws, 'B4', workerName)
    setPlain(tws, 'E4', `${rangeStart ? formatDate(rangeStart) : ''} - ${rangeEnd ? formatDate(rangeEnd) : ''}`)
    clearLiterals(tws, 7, 45, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])
    const tunnit = entries.filter((e) => e.entry_type === 'tunti').slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    let r = 7
    tunnit.forEach((e) => {
      if (r > 45) return
      setPlain(tws, `A${r}`, formatDate(e.entry_date))
      setPlain(tws, `C${r}`, Number(e.hours ?? 0))
      setPlain(tws, `D${r}`, e.worksites?.name ?? '')
      if (e.hour_category === 'kuitattava') setPlain(tws, `F${r}`, Number(e.hours ?? 0))
      else setPlain(tws, `G${r}`, Number(e.hours ?? 0))
      r++
    })
  }

  const out = await wb.xlsx.writeBuffer()
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Tililappu_${rangeStart ?? ''}_${rangeEnd ?? ''}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
