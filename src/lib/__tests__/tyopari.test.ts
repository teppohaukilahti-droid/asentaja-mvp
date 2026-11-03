import { describe, it, expect } from 'vitest'
import { kirjauksetHenkilolle, osuusPct, ansio } from '../tyopari'

const urakka = (amount: number, price: number, tekija: string) => ({
  entry_type: 'urakka', amount, hours: null, unit_price: price, total_sum: amount * price, tekija,
})
const tunti = (hours: number, tekija: string) => ({
  entry_type: 'tunti', amount: null, hours, unit_price: null, total_sum: null, tekija,
})

describe('työparin tililappujako', () => {
  it('osuudet 60/40: pari 40 %, minä 60 %', () => {
    expect(osuusPct('mina', 40)).toBe(60)
    expect(osuusPct('pari', 40)).toBe(40)
  })

  it('molemmat-urakka jaetaan osuudella, summa täsmää alkuperäiseen', () => {
    const e = [urakka(100, 1.67, 'molemmat')]
    const mina = kirjauksetHenkilolle(e, 'mina', 40)
    const pari = kirjauksetHenkilolle(e, 'pari', 40)
    expect(mina[0].amount).toBe(60)
    expect(pari[0].amount).toBe(40)
    expect((mina[0].total_sum ?? 0) + (pari[0].total_sum ?? 0)).toBeCloseTo(167, 2)
  })

  it('molemmat-tunnit tulevat kummallekin täysinä', () => {
    const e = [tunti(8, 'molemmat')]
    expect(kirjauksetHenkilolle(e, 'mina', 50)[0].hours).toBe(8)
    expect(kirjauksetHenkilolle(e, 'pari', 50)[0].hours).toBe(8)
  })

  it('vain minä / vain pari menevät vain omalle lapulle', () => {
    const e = [tunti(8, 'mina'), urakka(20, 2, 'pari')]
    expect(kirjauksetHenkilolle(e, 'mina', 50)).toHaveLength(1)
    expect(kirjauksetHenkilolle(e, 'pari', 50)[0].entry_type).toBe('urakka')
  })

  it('vanhat kirjaukset ilman tekijää ovat minun', () => {
    const e = [{ entry_type: 'tunti', amount: null, hours: 4, unit_price: null }]
    expect(kirjauksetHenkilolle(e, 'mina', 50)).toHaveLength(1)
    expect(kirjauksetHenkilolle(e, 'pari', 50)).toHaveLength(0)
  })

  it('ansio = urakat + tunnit omalla tuntipalkalla', () => {
    const e = [urakka(10, 2, 'mina'), tunti(8, 'mina')]
    expect(ansio(e, 20)).toBe(180)
  })
})
