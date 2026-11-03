import { describe, it, expect } from 'vitest'
import { kateEnnuste, kolmeLausetta } from '../johtaja'
import type { KateRivi, ViikkoTilanne } from '../johtaja'

function rivi(over: Partial<KateRivi>): KateRivi {
  return {
    worksiteId: 'w1', name: 'Testityömaa', urakkasumma: 100000,
    tavoiteKatePct: 12, valmiusPct: 50, kustannus: 40000, ...over,
  }
}

const tyhja: ViikkoTilanne = {
  kateRivit: [], laskuttamatonKpl: 0, hiljaisetTyomaat: [],
  myohassaToimituksia: 0, koneitaVialla: 0, koneitaEtsinnassa: 0, kirjauksiaViikolla: 7,
}

describe('kateEnnuste — margin fade näkyväksi', () => {
  it('laskee ennusteen valmiusasteesta: 40k kustannus 50 % valmiina → 80k koko urakka → 20 % kate', () => {
    const t = kateEnnuste(rivi({}))
    expect(t.ennustePct).toBeCloseTo(20, 5)
    expect(t.fade).toBeCloseTo(8, 5) // tavoite 12 → +8
  })
  it('tunnistaa katteen syöjän: 55k kustannus 50 % valmiina → ennuste -10 %', () => {
    const t = kateEnnuste(rivi({ kustannus: 55000 }))
    expect(t.ennustePct).toBeCloseTo(-10, 5)
    expect(t.fade).toBeCloseTo(-22, 5)
  })
  it('ei ennusta ilman urakkasummaa tai valmiusastetta', () => {
    expect(kateEnnuste(rivi({ urakkasumma: null })).ennustePct).toBeNull()
    expect(kateEnnuste(rivi({ valmiusPct: 0 })).ennustePct).toBeNull()
    expect(kateEnnuste(rivi({ valmiusPct: null })).ennustePct).toBeNull()
  })
  it('fade jää nulliksi ilman tavoitetta', () => {
    expect(kateEnnuste(rivi({ tavoiteKatePct: null })).fade).toBeNull()
  })
})

describe('kolmeLausetta — huonot uutiset ensin, enintään kolme', () => {
  it('perustila kun mitään ei ole vialla', () => {
    const l = kolmeLausetta(tyhja)
    expect(l).toHaveLength(1)
    expect(l[0].sav).toBe('neutraali')
    expect(l[0].teksti).toContain('7 kuitattua kirjausta')
  })
  it('katteen syöjä nousee ykköseksi ja vie työmaalle', () => {
    const l = kolmeLausetta({
      ...tyhja,
      kateRivit: [kateEnnuste(rivi({ name: 'Vuotaja', kustannus: 55000 }))],
    })
    expect(l[0].teksti).toContain('Vuotaja syö katetta')
    expect(l[0].kohde).toEqual({ tyyppi: 'tyomaa', worksiteId: 'w1' })
  })
  it('hyvä uutinen mukaan kun tilaa on', () => {
    const l = kolmeLausetta({
      ...tyhja,
      kateRivit: [kateEnnuste(rivi({ name: 'Tähti', kustannus: 40000 }))],
      laskuttamatonKpl: 3,
    })
    expect(l.some((x) => x.teksti.includes('Kate syntyy: Tähti'))).toBe(true)
    expect(l.some((x) => x.teksti.includes('3 kirjausta'))).toBe(true)
  })
  it('enintään kolme lausetta vaikka kaikki palaa', () => {
    const l = kolmeLausetta({
      kateRivit: [kateEnnuste(rivi({ name: 'Vuotaja', kustannus: 60000 }))],
      laskuttamatonKpl: 9,
      hiljaisetTyomaat: [{ worksiteId: 'w2', name: 'Hiljainen', paivia: 4 }],
      myohassaToimituksia: 2, koneitaVialla: 1, koneitaEtsinnassa: 1, kirjauksiaViikolla: 0,
    })
    expect(l).toHaveLength(3)
    expect(l.every((x) => x.sav === 'huono')).toBe(true)
  })
})
