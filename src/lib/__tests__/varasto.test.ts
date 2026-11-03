import { describe, it, expect } from 'vitest'
import { normKoodi, matchesProduct, groupForOrdering } from '../varasto'
import type { VarastoProduct } from '../varasto'

const base = {
  id: '1', unit: 'kpl', qr_token: 'x', active: true, hyllypaikka: null, toimittaja: null,
  saldo_tila: 'vihrea' as const, saldo_paivitetty: '', tilattu_at: null, tarra_tulostettu: true,
}

function prod(over: Partial<VarastoProduct>): VarastoProduct {
  return { ...base, name: 'Tuote', koodi: null, ...over }
}

describe('normKoodi', () => {
  it('poistaa välit ja pienentää', () => {
    expect(normKoodi('JL60 412')).toBe('jl60412')
    expect(normKoodi('  jl 60  412 ')).toBe('jl60412')
  })
})

describe('matchesProduct — koodihaku', () => {
  const p = prod({ name: 'Tarkett Granit', koodi: 'JL60 412', hyllypaikka: 'A3' })
  it('osuu koodiin välilyönneistä riippumatta', () => {
    expect(matchesProduct(p, 'jl60 412')).toBe(true)
    expect(matchesProduct(p, 'jl60412')).toBe(true)
    expect(matchesProduct(p, 'JL60')).toBe(true)
  })
  it('osuu nimeen ja hyllypaikkaan', () => {
    expect(matchesProduct(p, 'granit')).toBe(true)
    expect(matchesProduct(p, 'a3')).toBe(true)
  })
  it('ei osu vääriin ja tyhjä haku ei osu', () => {
    expect(matchesProduct(p, 'jl61')).toBe(false)
    expect(matchesProduct(p, '')).toBe(false)
    expect(matchesProduct(p, '   ')).toBe(false)
  })
  it('toimii ilman koodia', () => {
    expect(matchesProduct(prod({ name: 'Kiilto 2 Plus' }), 'kiilto')).toBe(true)
  })
})

describe('groupForOrdering — tilauslista', () => {
  it('punaiset ja keltaiset ryhmitellään toimittajittain, punaiset ensin', () => {
    const groups = groupForOrdering([
      prod({ id: 'a', name: 'Liima A', saldo_tila: 'keltainen', toimittaja: 'Kiilto' }),
      prod({ id: 'b', name: 'Liima B', saldo_tila: 'punainen', toimittaja: 'Kiilto' }),
      prod({ id: 'c', name: 'Matto C', saldo_tila: 'punainen' }),
      prod({ id: 'd', name: 'Vihreä D', saldo_tila: 'vihrea', toimittaja: 'Kiilto' }),
      prod({ id: 'e', name: 'Tilattu E', saldo_tila: 'tilattu', toimittaja: 'Kiilto' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].toimittaja).toBe('Kiilto')
    expect(groups[0].items.map((i) => i.id)).toEqual(['b', 'a'])
    expect(groups[1].toimittaja).toBeNull()
    expect(groups[1].items.map((i) => i.id)).toEqual(['c'])
  })
  it('epäaktiiviset eivät nouse tilauslistalle', () => {
    expect(groupForOrdering([prod({ saldo_tila: 'punainen', active: false })])).toHaveLength(0)
  })
})
