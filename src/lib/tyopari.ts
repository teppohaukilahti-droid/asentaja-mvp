// Työpari: yksi äppi tuottaa tililaput kahdelle (esim. Teppo ja Eemil).
// Jokainen kirjaus kertoo kenen työtä se on (entries.tekija):
//   'mina'      → vain minun lapulleni
//   'pari'      → vain työparin lapulle
//   'molemmat'  → urakat jaetaan osuusprosentilla, tunnit tulevat KUMMALLEKIN
//                 täysimääräisinä (molemmat olivat paikalla ne tunnit)

export type Tekija = 'mina' | 'pari' | 'molemmat'
export type Henkilo = 'mina' | 'pari'

export const TEKIJA_LABEL: Record<Tekija, string> = {
  molemmat: 'Molemmat',
  mina: 'Vain minä',
  pari: 'Vain työpari',
}

type SplitEntry = {
  entry_type: string
  amount: number | null
  hours: number | null
  unit_price: number | null
  total_sum?: number | null
  tekija?: string | null
}

/** Henkilön osuus urakoista prosentteina, kun parin osuus on pariPct. */
export function osuusPct(henkilo: Henkilo, pariPct: number): number {
  const p = Math.min(100, Math.max(0, pariPct))
  return henkilo === 'pari' ? p : 100 - p
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Palauttaa henkilön tililappuun kuuluvat kirjaukset: muiden kirjaukset pois,
 * 'molemmat'-urakoiden määrä ja summa kerrottuna henkilön osuudella.
 * Tunnit eivät jakaudu — 'molemmat'-tunnit tulevat kummallekin sellaisinaan.
 */
export function kirjauksetHenkilolle<T extends SplitEntry>(entries: T[], henkilo: Henkilo, pariPct: number): T[] {
  const kerroin = osuusPct(henkilo, pariPct) / 100
  const out: T[] = []
  for (const e of entries) {
    const t = (e.tekija ?? 'mina') as Tekija
    if (t !== 'molemmat' && t !== henkilo) continue
    if (t === 'molemmat' && e.entry_type !== 'tunti') {
      if (kerroin === 0) continue
      const amount = e.amount === null ? null : round2(Number(e.amount) * kerroin)
      const total = e.total_sum == null ? e.total_sum : round2(Number(e.total_sum) * kerroin)
      out.push({ ...e, amount, total_sum: total })
    } else {
      out.push(e)
    }
  }
  return out
}

/** Henkilön ansio kirjauksista: urakat eurot + tunnit × henkilön tuntipalkka. */
export function ansio(entries: SplitEntry[], tuntipalkka: number): number {
  return entries.reduce((s, e) => s + (e.entry_type === 'tunti'
    ? Number(e.hours ?? 0) * tuntipalkka
    : Number(e.total_sum ?? 0)), 0)
}

/** Lyhyt merkintä kirjauslistaan: tyhjä kun kirjaus on vain minun. */
export function tekijaMerkki(tekija: string | null | undefined, pariNimi: string | null | undefined): string {
  if (!pariNimi) return ''
  const etu = pariNimi.trim().split(' ')[0]
  if (tekija === 'molemmat') return 'molemmat'
  if (tekija === 'pari') return etu
  return ''
}
