// Johtajan näkymän laskenta: kate-vaaka (margin fade näkyväksi) ja
// kolmen lauseen viikko — laskettua suomea suoraan kannasta, EI tekoälyä.
// Jokainen lause on sääntö jonka voi tarkistaa käsin: siksi se kelpaa johtajalle.

export type KateRivi = {
  worksiteId: string
  name: string
  urakkasumma: number | null
  tavoiteKatePct: number | null
  valmiusPct: number | null
  kustannus: number // toteutunut työkustannuskertymä (kuitatut kirjaukset)
}

export type KateTulos = KateRivi & {
  /** Kate-ennuste %: mihin kate on menossa jos loppu etenee samalla kustannustahdilla. */
  ennustePct: number | null
  /** Ero tavoitteeseen (%-yksikköä): negatiivinen = margin fade käynnissä. */
  fade: number | null
}

/**
 * Earned value -henkinen kate-ennuste: kustannus suhteessa valmiusasteeseen
 * skaalattuna koko urakkaan. Vaatii urakkasumman ja valmiusasteen (>0).
 */
export function kateEnnuste(rivi: KateRivi): KateTulos {
  const { urakkasumma, valmiusPct, tavoiteKatePct, kustannus } = rivi
  if (!urakkasumma || urakkasumma <= 0 || !valmiusPct || valmiusPct <= 0) {
    return { ...rivi, ennustePct: null, fade: null }
  }
  const ennustettuKustannus = kustannus / (valmiusPct / 100)
  const ennustePct = (1 - ennustettuKustannus / urakkasumma) * 100
  const fade = tavoiteKatePct != null ? ennustePct - tavoiteKatePct : null
  return { ...rivi, ennustePct, fade }
}

export type Lause = {
  teksti: string
  sav: 'hyva' | 'huono' | 'neutraali'
  /** Minne lause vie napautettaessa */
  kohde: { tyyppi: 'tyomaa'; worksiteId: string } | { tyyppi: 'laskutus' } | { tyyppi: 'tyokalut' } | { tyyppi: 'ei' }
}

export type ViikkoTilanne = {
  kateRivit: KateTulos[]
  laskuttamatonKpl: number
  hiljaisetTyomaat: Array<{ worksiteId: string; name: string; paivia: number }>
  myohassaToimituksia: number
  koneitaVialla: number
  koneitaEtsinnassa: number
  kirjauksiaViikolla: number
}

const pct = (n: number) => `${n.toFixed(1).replace('.', ',')} %`

/**
 * Kolmen lauseen viikko: säännöt tärkeysjärjestyksessä, kolme ensimmäistä voittaa.
 * Huonot uutiset ensin — johtaja maksaa siitä että kuulee ne ajoissa.
 */
export function kolmeLausetta(t: ViikkoTilanne): Lause[] {
  const lauseet: Lause[] = []
  const mitatut = t.kateRivit.filter((r) => r.fade != null)

  // 1. Pahin kadonnut kate (fade alle -2 %-yks) — margin fade käynnissä
  const pahin = [...mitatut].sort((a, b) => (a.fade! - b.fade!))[0]
  if (pahin && pahin.fade! < -2) {
    lauseet.push({
      teksti: `${pahin.name} syö katetta: ennuste ${pct(pahin.ennustePct!)} (tavoite ${pct(pahin.tavoiteKatePct!)}).`,
      sav: 'huono',
      kohde: { tyyppi: 'tyomaa', worksiteId: pahin.worksiteId },
    })
  }

  // 2. Hiljainen työmaa — miehitys on, kirjauksia ei
  if (t.hiljaisetTyomaat.length > 0) {
    const h = t.hiljaisetTyomaat[0]
    lauseet.push({
      teksti: `${h.name}: ei kirjauksia ${h.paivia} päivään vaikka miehitys on paikalla — kysy työnjohtajalta.`,
      sav: 'huono',
      kohde: { tyyppi: 'tyomaa', worksiteId: h.worksiteId },
    })
  }

  // 3. Laskuttamaton raha pöydällä
  if (t.laskuttamatonKpl > 0) {
    lauseet.push({
      teksti: `Laskuttamatonta työtä pöydällä: ${t.laskuttamatonKpl} kirjausta odottaa vientiä laskutukseen.`,
      sav: 'huono',
      kohde: { tyyppi: 'laskutus' },
    })
  }

  // 4. Kalusto vuotaa rahaa
  const koneOngelmat = t.koneitaVialla + t.koneitaEtsinnassa
  if (koneOngelmat > 0) {
    const osat = [
      t.koneitaVialla > 0 ? `${t.koneitaVialla} vialla` : '',
      t.koneitaEtsinnassa > 0 ? `${t.koneitaEtsinnassa} etsinnässä` : '',
    ].filter(Boolean).join(', ')
    lauseet.push({ teksti: `Kalusto: ${osat}.`, sav: 'huono', kohde: { tyyppi: 'tyokalut' } })
  }

  // 5. Myöhässä olevat toimitukset
  if (t.myohassaToimituksia > 0) {
    lauseet.push({
      teksti: `${t.myohassaToimituksia} toimituslupaus${t.myohassaToimituksia > 1 ? 'ta' : ''} myöhässä.`,
      sav: 'huono', kohde: { tyyppi: 'ei' },
    })
  }

  // 6. Paras työmaa — kate syntyy jossain (hyvä uutinen mukaan jos tilaa)
  const paras = [...mitatut].sort((a, b) => (b.fade! - a.fade!))[0]
  if (paras && paras.fade! > 1) {
    lauseet.push({
      teksti: `Kate syntyy: ${paras.name} ennuste ${pct(paras.ennustePct!)} (+${paras.fade!.toFixed(1).replace('.', ',')} %-yks tavoitteeseen).`,
      sav: 'hyva',
      kohde: { tyyppi: 'tyomaa', worksiteId: paras.worksiteId },
    })
  }

  // 7. Perustila — kaikki kunnossa
  if (lauseet.length === 0) {
    lauseet.push({
      teksti: `Viikko etenee normaalisti: ${t.kirjauksiaViikolla} kuitattua kirjausta, kate tavoitteessa.`,
      sav: 'neutraali', kohde: { tyyppi: 'ei' },
    })
  }

  return lauseet.slice(0, 3)
}
