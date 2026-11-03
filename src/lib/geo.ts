// Sijaintityökalut: työmaan tunnistus GPS:llä ja km-laskenta ajopäiväkirjaan.
// GPS on vapaaehtoinen (profiles.gps_sallittu) ja toimii vain kun äppi on auki —
// selain ei salli taustaseurantaa, eikä tämä ole kyttäystyökalu.

export type GeoSite = { id: string; name: string; lat: number | null; lng: number | null; gps_sade_m?: number | null }

/** Kahden pisteen etäisyys kilometreinä (haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Tieliikenne-etäisyysarvio: linnuntie × 1,3, pyöristys 0,1 km:iin. Käyttäjä voi aina korjata. */
export function roadKmEstimate(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * 1.3 * 10) / 10
}

/** Lähin työmaa jonka GPS-säteen sisällä ollaan, tai null. */
export function findNearestSite<T extends GeoSite>(sites: T[], lat: number, lng: number): { site: T; km: number } | null {
  let best: { site: T; km: number } | null = null
  for (const s of sites) {
    if (s.lat == null || s.lng == null) continue
    const km = haversineKm(lat, lng, s.lat, s.lng)
    if (km * 1000 <= (s.gps_sade_m ?? 250) && (!best || km < best.km)) best = { site: s, km }
  }
  return best
}

/** Nykyinen sijainti promisena; null jos ei saatavilla/estetty. */
export function getPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    )
  })
}

/** Poimi koordinaatit Google Maps -linkistä tai "lat, lng" -tekstistä. */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const t = text.trim()
  // Google Maps: .../@65.0121,25.4651,17z tai ?q=65.0121,25.4651
  const at = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  const q = t.match(/[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  const plain = t.match(/^(-?\d{1,3}[.,]\d+)[,;\s]+(-?\d{1,3}[.,]\d+)$/)
  const m = at ?? q ?? (plain ? [plain[0], plain[1].replace(',', '.'), plain[2].replace(',', '.')] : null)
  if (!m) return null
  const lat = Number(m[1]), lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}
