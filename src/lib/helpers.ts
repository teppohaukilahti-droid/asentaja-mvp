export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function toInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function eur(n: number): string {
  return n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)}.${Number(m)}.${y}`
}

export function parseNum(s: string): number {
  return Number(String(s).replace(',', '.'))
}

export const HOUR_TYPES = [
  'Asennus', 'Paikkaus', 'Raivaus', 'Siivous', 'Tyhjäys', 'Tavaran siirto',
  'Odotus', 'Suojaus', 'Purku', 'Pohjatyöt', 'Mittaus', 'Muu',
]

export const QUICK_HOURS = ['0,5', '1', '2', '4', '7,5', '8']

// TES 110-sarja (hitsaus, esim. 110a, 110b2): paketissa lasketaan 50 % määrästä.
// HUOM: pelkkä "110"-alku ei riitä, koska esim. 1104 on tekstiililaatta!
export function isWeldingCode(code: string): boolean {
  return /^110[a-g]/i.test(code)
}

// Palkkakausi: kausi päättyy katkopäivään joka kuussa
export function payPeriod(cutoff: number): { start: string; end: string } {
  const now = new Date()
  let end = new Date(now.getFullYear(), now.getMonth(), cutoff)
  if (now > end) end = new Date(now.getFullYear(), now.getMonth() + 1, cutoff)
  const prev = new Date(end.getFullYear(), end.getMonth() - 1, cutoff)
  const start = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1)
  return { start: toInput(start), end: toInput(end) }
}
