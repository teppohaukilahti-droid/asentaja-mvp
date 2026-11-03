// Ajopäiväkirjan km-laskennan ja GPS-työmaatunnistuksen testit.
// Km-korvaus on rahaa: etäisyyslaskun pitää olla oikein ja koordinaattien
// jäsennyksen kestää kaikki muodot joita käyttäjä liittää.
import { describe, it, expect } from 'vitest'
import { haversineKm, roadKmEstimate, findNearestSite, parseCoords } from '../geo'

describe('haversineKm — linnuntie', () => {
  it('Oulu keskusta → Helsinki keskusta ≈ 540 km', () => {
    const km = haversineKm(65.0121, 25.4651, 60.1699, 24.9384)
    expect(km).toBeGreaterThan(520)
    expect(km).toBeLessThan(560)
  })
  it('sama piste = 0 km', () => {
    expect(haversineKm(65.0, 25.5, 65.0, 25.5)).toBe(0)
  })
  it('lyhyt matka: ~1 leveysasteen sadasosa ≈ 1,11 km', () => {
    const km = haversineKm(65.0, 25.5, 65.01, 25.5)
    expect(km).toBeGreaterThan(1.0)
    expect(km).toBeLessThan(1.2)
  })
})

describe('roadKmEstimate — tie-arvio', () => {
  it('linnuntie × 1,3 pyöristettynä 0,1 km:iin', () => {
    const linnuntie = haversineKm(65.0121, 25.4651, 65.05, 25.5)
    const arvio = roadKmEstimate(65.0121, 25.4651, 65.05, 25.5)
    expect(arvio).toBeCloseTo(Math.round(linnuntie * 1.3 * 10) / 10, 5)
  })
})

describe('findNearestSite — työmaan GPS-tunnistus', () => {
  const sites = [
    { id: 'a', name: 'Lähellä', lat: 65.0121, lng: 25.4651, gps_sade_m: 250 },
    { id: 'b', name: 'Kaukana', lat: 65.1, lng: 25.6, gps_sade_m: 250 },
    { id: 'c', name: 'Ei koordinaatteja', lat: null, lng: null },
  ]
  it('löytää säteen sisällä olevan', () => {
    const hit = findNearestSite(sites, 65.0125, 25.4655)
    expect(hit?.site.id).toBe('a')
  })
  it('ei osumaa säteen ulkopuolelta', () => {
    expect(findNearestSite(sites, 64.5, 25.0)).toBeNull()
  })
  it('koordinaatittomat työmaat ohitetaan kaatumatta', () => {
    expect(findNearestSite([sites[2]], 65.0, 25.5)).toBeNull()
  })
})

describe('parseCoords — koordinaattien jäsennys', () => {
  it('Google Maps @-muoto', () => {
    expect(parseCoords('https://www.google.com/maps/@65.0121,25.4651,17z')).toEqual({ lat: 65.0121, lng: 25.4651 })
  })
  it('Google Maps ?q=-muoto', () => {
    expect(parseCoords('https://maps.google.com/?q=65.0121,25.4651')).toEqual({ lat: 65.0121, lng: 25.4651 })
  })
  it('paljas pistemuoto', () => {
    expect(parseCoords('65.0121, 25.4651')).toEqual({ lat: 65.0121, lng: 25.4651 })
  })
  it('suomalainen pilkkumuoto', () => {
    expect(parseCoords('65,0121 25,4651')).toEqual({ lat: 65.0121, lng: 25.4651 })
  })
  it('roska hylätään', () => {
    expect(parseCoords('Valokatu 8, Oulu')).toBeNull()
    expect(parseCoords('')).toBeNull()
  })
  it('mahdottomat koordinaatit hylätään', () => {
    expect(parseCoords('95.0, 25.0')).toBeNull()
  })
})
