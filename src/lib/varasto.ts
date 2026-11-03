// Varasto-moduulin jaetut tyypit ja apurit: liikennevalosaldo, tuotehaku, noutopyynnöt.
// Periaate: EI tarkkoja määriä — vain tila jonka varastomies päivittää yhdellä napautuksella.

export type SaldoTila = 'vihrea' | 'keltainen' | 'punainen' | 'tilattu'

export type VarastoProduct = {
  id: string
  name: string
  unit: string
  qr_token: string
  active: boolean
  koodi: string | null
  hyllypaikka: string | null
  toimittaja: string | null
  saldo_tila: SaldoTila
  saldo_paivitetty: string
  tilattu_at: string | null
  tarra_tulostettu: boolean
}

export type Noutopyynto = {
  id: string
  worksite_id: string
  requested_by: string
  requester_name: string | null
  item_text: string
  maara: string | null
  lisatiedot: string | null
  status: 'avoin' | 'noudettu' | 'peruttu'
  noudettu_at: string | null
  created_at: string
  worksites?: { name: string; address: string | null } | null
}

export const SALDO_LABEL: Record<SaldoTila, string> = {
  vihrea: 'Hyllyssä',
  keltainen: 'Vähissä',
  punainen: 'Loppu',
  tilattu: 'Tilattu',
}

// Badge-tyylit (tausta + teksti) — liikennevalo on ainoa paikka jossa värit saavat huutaa
export const SALDO_STYLE: Record<SaldoTila, string> = {
  vihrea: 'bg-green-500/15 text-green-400 border-green-500/30',
  keltainen: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  punainen: 'bg-red-500/15 text-red-400 border-red-500/30',
  tilattu: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

// Iso valintanappi tuotesheetissä
export const SALDO_BUTTON: Record<Exclude<SaldoTila, 'tilattu'>, string> = {
  vihrea: 'bg-green-500/20 text-green-300 border-green-500/40',
  keltainen: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
  punainen: 'bg-red-500/20 text-red-300 border-red-500/40',
}

/** Normalisoi tuotekoodi vertailua varten: pienet kirjaimet, välit pois ("JL60 412" → "jl60412"). */
export function normKoodi(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

/**
 * Koodihaku: "onko meillä jl60 412" — osuu koodiin välilyönneistä riippumatta
 * ja nimeen tavallisena tekstihakuna. Tyhjä haku ei osu mihinkään (kutsuja päättää listasta).
 */
export function matchesProduct(p: Pick<VarastoProduct, 'name' | 'koodi' | 'hyllypaikka'>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (p.name.toLowerCase().includes(q)) return true
  const qk = normKoodi(q)
  if (p.koodi && qk && normKoodi(p.koodi).includes(qk)) return true
  if (p.hyllypaikka && p.hyllypaikka.toLowerCase().includes(q)) return true
  return false
}

/** Tilauslistan ryhmittely: toimittajittain, punaiset ennen keltaisia, ei-toimittajalliset viimeisenä. */
export function groupForOrdering(products: VarastoProduct[]): Array<{ toimittaja: string | null; items: VarastoProduct[] }> {
  const need = products.filter((p) => p.active && (p.saldo_tila === 'punainen' || p.saldo_tila === 'keltainen'))
  const byKey = new Map<string, VarastoProduct[]>()
  for (const p of need) {
    const key = p.toimittaja?.trim() || ''
    const arr = byKey.get(key) ?? []
    arr.push(p)
    byKey.set(key, arr)
  }
  const groups = [...byKey.entries()].map(([key, items]) => ({
    toimittaja: key || null,
    items: items.sort((a, b) => (a.saldo_tila === b.saldo_tila ? a.name.localeCompare(b.name, 'fi') : a.saldo_tila === 'punainen' ? -1 : 1)),
  }))
  return groups.sort((a, b) => {
    if (a.toimittaja === null) return 1
    if (b.toimittaja === null) return -1
    return a.toimittaja.localeCompare(b.toimittaja, 'fi')
  })
}
