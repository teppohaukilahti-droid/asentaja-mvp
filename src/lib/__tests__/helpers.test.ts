// Rahakriittisten apufunktioiden testit.
// Nämä ajetaan komennolla: npm test
// Palkkakauden rajat, desimaalipilkut ja euromuotoilu eivät saa mennä
// hiljaisesti rikki — jokainen virhe näissä näkyy jonkun tilipussissa.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseNum, eur, formatDate, payPeriod, isWeldingCode, toInput } from '../helpers'

afterEach(() => {
  vi.useRealTimers()
})

describe('parseNum — suomalainen desimaalipilkku', () => {
  it('muuntaa pilkun pisteeksi', () => {
    expect(parseNum('12,5')).toBe(12.5)
    expect(parseNum('0,25')).toBe(0.25)
  })
  it('hyväksyy myös pisteen', () => {
    expect(parseNum('7.5')).toBe(7.5)
  })
  it('kokonaisluvut', () => {
    expect(parseNum('120')).toBe(120)
  })
  it('tyhjä ja roska eivät tuota lukua', () => {
    expect(Number.isFinite(parseNum('abc'))).toBe(false)
    expect(parseNum('')).toBe(0) // Number('') === 0 — kutsujat validoivat > 0
  })
})

describe('eur — euromuotoilu', () => {
  it('kaksi desimaalia ja euromerkki', () => {
    // fi-FI käyttää tuhaterottimena kapeaa sitovaa välilyöntiä — \s kattaa sen
    expect(eur(1234.5)).toMatch(/^1\s234,50 €$/)
    expect(eur(0)).toBe('0,00 €')
  })
  it('pyöristys senttiin', () => {
    expect(eur(4.204)).toBe('4,20 €')
    expect(eur(4.205)).toMatch(/4,2[01] €/) // toLocaleString-pyöristys
  })
})

describe('formatDate', () => {
  it('ISO → suomalainen ilman etunollia', () => {
    expect(formatDate('2026-08-05')).toBe('5.8.2026')
    expect(formatDate('2026-12-24')).toBe('24.12.2026')
  })
})

describe('payPeriod — palkkakauden rajat (katkopäivä)', () => {
  it('kauden keskellä: kausi on edellisen katkon jälkeisestä päivästä seuraavaan katkoon', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 5, 12)) // 5.8.2026
    const p = payPeriod(15)
    expect(p.start).toBe('2026-07-16')
    expect(p.end).toBe('2026-08-15')
  })
  it('heti katkon jälkeen: uusi kausi alkaa', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 8)) // 16.8.2026
    const p = payPeriod(15)
    expect(p.start).toBe('2026-08-16')
    expect(p.end).toBe('2026-09-15')
  })
  it('vuodenvaihde: joulukuun katko → tammikuun kausi', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 20, 12)) // 20.12.2026
    const p = payPeriod(15)
    expect(p.start).toBe('2026-12-16')
    expect(p.end).toBe('2027-01-15')
  })
  it('kausi on aina yhtenäinen: start = edellinen end + 1 päivä', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 1, 12))
    const p = payPeriod(15)
    const start = new Date(p.start)
    const prevEnd = new Date(start.getTime() - 86400000)
    expect(toInput(prevEnd).endsWith('-15')).toBe(true)
  })
})

describe('isWeldingCode — hitsauskoodien tunnistus (paketin 50 % -sääntö)', () => {
  it('110-sarjan kirjainkoodit ovat hitsausta', () => {
    expect(isWeldingCode('110a')).toBe(true)
    expect(isWeldingCode('110b2')).toBe(true)
    expect(isWeldingCode('110G')).toBe(true)
  })
  it('1104 (tekstiililaatta) EI ole hitsausta — tämä oli oikea bugiriski', () => {
    expect(isWeldingCode('1104')).toBe(false)
  })
  it('muut koodit eivät ole hitsausta', () => {
    expect(isWeldingCode('201')).toBe(false)
    expect(isWeldingCode('101')).toBe(false)
  })
})
