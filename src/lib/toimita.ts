// Valmiiden tiedostojen (tililaput, tunti-PDF:t) toimitus käyttäjälle.
// Puhelimessa avataan jakovalikko: tiedostot lähtevät suoraan WhatsAppiin,
// sähköpostiin tms. Tietokoneella tavallinen lataus.

export type ValmisLappu = { blob: Blob; tiedosto: string }

export async function toimitaLaput(laput: ValmisLappu[]): Promise<void> {
  const files = laput.map((l) => new File([l.blob], l.tiedosto, { type: l.blob.type }))
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  const puhelin = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (puhelin && nav.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: laput.length > 1 ? 'Tiedostot' : laput[0].tiedosto })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // käyttäjä sulki jakovalikon
    }
  }
  for (const l of laput) {
    const url = URL.createObjectURL(l.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = l.tiedosto
    a.click()
    URL.revokeObjectURL(url)
    await new Promise((r) => setTimeout(r, 800)) // selaimet estävät samanaikaiset lataukset
  }
}
