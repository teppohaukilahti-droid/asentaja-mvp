import { describe, it, expect } from 'vitest'
import { tuntiRivit, summatHenkiloittain } from '../tuntiPdf'

const ws = { name: 'Valo', client_company: 'Kivi Oy' }
const t = (pvm: string, hours: number, cat: string, tekija: string) => ({
  entry_type: 'tunti', entry_date: pvm, hours, hour_category: cat, description: 'Asennus', tekija, worksite_id: 'w1', worksites: ws,
})

describe('tuntierittely', () => {
  const e = [
    t('2026-11-03', 8, 'kuitattava', 'molemmat'),
    t('2026-11-04', 2, 'oma', 'pari'),
    t('2026-11-04', 1, 'kuitattava', 'mina'),
    { entry_type: 'urakka', entry_date: '2026-11-04', hours: null, hour_category: null, description: 'x', tekija: 'mina', worksite_id: 'w1', worksites: ws },
  ]

  it('kuitattavat: vain kuitattavat, molemmat kahdeksi riviksi', () => {
    const r = tuntiRivit(e, 'kuitattavat', 'Teppo', 'Eemil')
    expect(r.map((x) => `${x.kuka}:${x.tunnit}`)).toEqual(['Teppo:8', 'Eemil:8', 'Teppo:1'])
  })

  it('kaikki: Heikkisen tunnit mukaan, urakat eivät', () => {
    const r = tuntiRivit(e, 'kaikki', 'Teppo', 'Eemil')
    expect(r).toHaveLength(4)
    const s = summatHenkiloittain(r)
    expect(s.find((x) => x.kuka === 'Eemil')).toEqual({ kuka: 'Eemil', kuitattavat: 8, heikkinen: 2 })
    expect(s.find((x) => x.kuka === 'Teppo')).toEqual({ kuka: 'Teppo', kuitattavat: 9, heikkinen: 0 })
  })

  it('ilman työparia kaikki tunnit ovat minun', () => {
    const r = tuntiRivit(e, 'kaikki', 'Teppo', null)
    expect(new Set(r.map((x) => x.kuka))).toEqual(new Set(['Teppo']))
    expect(r.reduce((s, x) => s + x.tunnit, 0)).toBe(11)
  })
})
