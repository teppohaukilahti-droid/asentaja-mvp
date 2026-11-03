// Kalenterin yhteiset tyypit ja viikkolaskenta (ISO-viikot, ma–su).
import { toInput, today } from './helpers'

export type Ws = {
  id: string; name: string; client_company: string | null; status: string
  oma_tyomaa: boolean; alkaa: string | null; arvioitu_valmis: string | null
  valmius_pct: number; foreman_id: string | null
  address: string | null; mestari_nimi: string | null; mestari_puhelin: string | null
}
export type Visit = { worksite_id: string; user_name: string | null; pvm: string }
export type Ent = { worksite_id: string; user_id: string; entry_date: string }
export type Vapautus = { id: string; user_id: string; user_name: string | null; worksite_id: string; pvm: string; varma: boolean; huom: string | null }
export type Prof = { id: string; full_name: string; role: string }
export type Toimitus = { id: string; item_text: string; maara: string | null; kiire: boolean; status: string; toimitus_pvm: string | null; worksite_id: string }
export type Merkinta = { id: string; pvm: string; otsikko: string; worksite_id: string | null; created_by_name: string | null }
export type Miehitys = {
  id: string; worksite_id: string; user_id: string; user_name: string
  alkaa: string; loppu: string | null
  status: 'ehdotus' | 'varmistettu' | 'vastustettu'
  proposer_id: string | null; proposer_name: string | null
  vastustaja_name: string | null; vastustus_syy: string | null
  created_at: string
}
export type Tehtava = {
  id: string; pvm: string | null; teksti: string; worksite_id: string | null
  tehty: boolean; lahde: string; created_by_name: string | null
}
export type MaterialRow = { id: string; worksite_id: string; name: string; balance: number; unit: string; halytysraja: number | null }

// ── Viikkolaskenta ──

/** Maanantai sille viikolle johon päivä kuuluu */
export function weekMonday(d: Date): Date {
  const n = new Date(d)
  n.setDate(n.getDate() - ((n.getDay() + 6) % 7))
  n.setHours(0, 0, 0, 0)
  return n
}

/** ISO-viikkonumero */
export function isoWeek(d: Date): number {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)) // torstai määrää vuoden
  const jan4 = new Date(t.getFullYear(), 0, 4)
  return 1 + Math.round(((t.getTime() - weekMonday(jan4).getTime()) / 86400000) / 7)
}

export type WeekCol = { monday: string; sunday: string; vko: number; isCurrent: boolean }

/** Viikkosarakkeet: back viikkoa taakse, fwd eteenpäin kuluvasta */
export function weekColumns(back: number, fwd: number): WeekCol[] {
  const cur = weekMonday(new Date())
  const cols: WeekCol[] = []
  for (let i = -back; i <= fwd; i++) {
    const mon = new Date(cur)
    mon.setDate(mon.getDate() + i * 7)
    const sun = new Date(mon)
    sun.setDate(sun.getDate() + 6)
    cols.push({ monday: toInput(mon), sunday: toInput(sun), vko: isoWeek(mon), isCurrent: i === 0 })
  }
  return cols
}

export function daysFromToday(iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date(today()).getTime()) / 86400000)
}

/**
 * Miehityksen tehollinen loppupäivä: asentajan oma vapautumisilmoitus samalta
 * työmaalta voittaa, sitten käsin asetettu loppu, sitten työmaan aikataulu.
 * Ilman mitään näistä: jatkuu toistaiseksi (näytetään avoimena).
 */
export function effectiveEnd(m: Miehitys, vapautumiset: Vapautus[], site: Ws | undefined): string | null {
  const vap = vapautumiset.find((v) => v.user_id === m.user_id && v.worksite_id === m.worksite_id)
  if (vap) return vap.pvm
  if (m.loppu) return m.loppu
  if (site?.arvioitu_valmis) return site.arvioitu_valmis
  return null
}

/** Osuuko miehitys viikolle [monday..sunday]? */
export function overlapsWeek(m: Miehitys, end: string | null, col: WeekCol): boolean {
  if (m.alkaa > col.sunday) return false
  if (end && end < col.monday) return false
  return true
}
