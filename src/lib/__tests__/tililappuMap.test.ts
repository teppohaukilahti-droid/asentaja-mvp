// Tililappupohjan nimikekartta: pohjan VLOOKUP hinnoittelee rivit nimikkeen
// TARKAN tekstin perusteella — tyhjä tai puuttuva nimike = rivi jää hinnoittelematta.
import { describe, it, expect } from 'vitest'
import { TILILAPPU_NIMIKKEET } from '../tililappuMap'

describe('TILILAPPU_NIMIKKEET — kartan eheys', () => {
  const entries = Object.entries(TILILAPPU_NIMIKKEET)

  it('kartassa on kattava määrä koodeja', () => {
    expect(entries.length).toBeGreaterThan(50)
  })
  it('jokaisella koodilla on ei-tyhjä nimike', () => {
    for (const [code, nimike] of entries) {
      expect(nimike.trim().length, `koodi ${code}`).toBeGreaterThan(0)
    }
  })
  it('nimikkeet alkavat numerolla kuten pohjassa', () => {
    for (const [code, nimike] of entries) {
      expect(/^\d/.test(nimike), `koodi ${code}: "${nimike}"`).toBe(true)
    }
  })
  it('hitsauskoodien alle/yli 200 jm -parit ovat molemmat kartassa', () => {
    expect(TILILAPPU_NIMIKKEET['110a']).toBeTruthy()
    expect(TILILAPPU_NIMIKKEET['110a2']).toBeTruthy()
    expect(TILILAPPU_NIMIKKEET['110b']).toBeTruthy()
    expect(TILILAPPU_NIMIKKEET['110b2']).toBeTruthy()
  })
})
