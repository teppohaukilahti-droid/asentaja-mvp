// Tuntierittelyt PDF:nä Heikkisen logolla:
//   'kuitattavat' → rakennusmestarille kuitattavaksi, oma sivu jokaiselle työmaalle
//                   ja allekirjoituskohta
//   'kaikki'      → omalle työnjohtajalle: kuitattavat + Heikkisen tunnit kaikilta työmailta
// Työparin kanssa "molemmat"-tunnit näkyvät kummallekin omana rivinään, jotta
// jokaisen tunnit ja summat ovat yksiselitteiset.
import { formatDate } from './helpers'
import type { ValmisLappu } from './toimita'

export type PdfTyyppi = 'kuitattavat' | 'kaikki'

type TuntiEntry = {
  entry_type: string
  entry_date: string
  hours: number | null
  hour_category: string | null
  description: string | null
  tekija?: string | null
  worksite_id: string
  worksites: { name: string; client_company: string | null } | null
}

export type TuntiRivi = {
  pvm: string
  tyomaaId: string
  tyomaa: string
  rakennusliike: string
  laji: string
  kuka: string
  tunnit: number
  kuitattava: boolean
}

/** Tuntirivit PDF:ää varten. Ilman työparia (pari = null) kaikki rivit ovat minun. */
export function tuntiRivit(entries: TuntiEntry[], tyyppi: PdfTyyppi, mina: string, pari: string | null): TuntiRivi[] {
  const out: TuntiRivi[] = []
  for (const e of entries) {
    if (e.entry_type !== 'tunti') continue
    const kuitattava = e.hour_category === 'kuitattava'
    if (tyyppi === 'kuitattavat' && !kuitattava) continue
    const h = Number(e.hours ?? 0)
    if (!(h > 0)) continue
    const t = e.tekija ?? 'mina'
    const kenelle = !pari ? [mina] : t === 'molemmat' ? [mina, pari] : t === 'pari' ? [pari] : [mina]
    for (const kuka of kenelle) {
      out.push({
        pvm: e.entry_date,
        tyomaaId: e.worksite_id,
        tyomaa: e.worksites?.name ?? 'Työmaa',
        rakennusliike: e.worksites?.client_company ?? '',
        laji: (e.description ?? 'Tuntityö').trim(),
        kuka,
        tunnit: h,
        kuitattava,
      })
    }
  }
  // Saman päivän ja työmaan rivit: minä ensin, työpari sitten
  const jarjestys = (kuka: string) => (kuka === mina ? 0 : 1)
  return out.sort((a, b) =>
    a.pvm.localeCompare(b.pvm) || a.tyomaa.localeCompare(b.tyomaa, 'fi') || jarjestys(a.kuka) - jarjestys(b.kuka))
}

/** Summat henkilöittäin: [nimi, kuitattavat, Heikkisen tunnit] */
export function summatHenkiloittain(rivit: TuntiRivi[]): { kuka: string; kuitattavat: number; heikkinen: number }[] {
  const m = new Map<string, { kuka: string; kuitattavat: number; heikkinen: number }>()
  for (const r of rivit) {
    const g = m.get(r.kuka) ?? { kuka: r.kuka, kuitattavat: 0, heikkinen: 0 }
    if (r.kuitattava) g.kuitattavat += r.tunnit
    else g.heikkinen += r.tunnit
    m.set(r.kuka, g)
  }
  return [...m.values()]
}

const h = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/heikkinen-logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

type PdfOpts = {
  tyyppi: PdfTyyppi
  rivit: TuntiRivi[]
  jakso: string          // esim. "Viikko 45 · 2.11.–8.11.2026"
  tiedostoJakso: string  // esim. "vko45"
  tyontekijat: string[]
  logo?: string | null   // dataURL; haetaan /heikkinen-logo.png jos ei annettu
}

export async function teeTuntiPdf(o: PdfOpts): Promise<ValmisLappu> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = o.logo === undefined ? await logoDataUrl() : o.logo
  const W = 210, L = 15, R = 195
  const naytaKuka = o.tyontekijat.length > 1

  // Kuitattavat: sivu per työmaa (mestari kuittaa oman työmaansa). Kaikki: yksi kokonaisuus.
  const ryhmat: { otsikko: string; rakennusliike: string; rivit: TuntiRivi[] }[] = []
  if (o.tyyppi === 'kuitattavat') {
    const m = new Map<string, TuntiRivi[]>()
    o.rivit.forEach((r) => m.set(r.tyomaaId, [...(m.get(r.tyomaaId) ?? []), r]))
    m.forEach((list) => ryhmat.push({ otsikko: list[0].tyomaa, rakennusliike: list[0].rakennusliike, rivit: list }))
    if (ryhmat.length === 0) ryhmat.push({ otsikko: '', rakennusliike: '', rivit: [] })
  } else {
    ryhmat.push({ otsikko: '', rakennusliike: '', rivit: o.rivit })
  }

  const otsikko = o.tyyppi === 'kuitattavat' ? 'Kuitattavat tunnit' : 'Tuntierittely'

  const ylaosa = (ryhma: (typeof ryhmat)[number]) => {
    if (logo) doc.addImage(logo, 'PNG', L, 12, 58, 13.4)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20)
    doc.text(otsikko, R, 18, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(70)
    doc.text(o.jakso, R, 24, { align: 'right' })
    let y = 36
    doc.setDrawColor(200); doc.line(L, y - 4, R, y - 4)
    const kentta = (nimi: string, arvo: string) => {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(110); doc.text(nimi, L, y)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.text(arvo || '–', L + 32, y)
      y += 6
    }
    kentta(o.tyontekijat.length > 1 ? 'Työntekijät' : 'Työntekijä', o.tyontekijat.join(', '))
    if (o.tyyppi === 'kuitattavat') {
      kentta('Työmaa', ryhma.otsikko)
      kentta('Rakennusliike', ryhma.rakennusliike)
    }
    return y + 4
  }

  // Sarakkeet
  type Sar = { otsikko: string; x: number; oikea?: boolean }
  const sar: Sar[] = o.tyyppi === 'kuitattavat'
    ? [
        { otsikko: 'Pvm', x: L },
        { otsikko: 'Työ', x: L + 24 },
        ...(naytaKuka ? [{ otsikko: 'Tekijä', x: L + 105 }] : []),
        { otsikko: 'Tunnit', x: R, oikea: true },
      ]
    : [
        { otsikko: 'Pvm', x: L },
        { otsikko: 'Työmaa', x: L + 22 },
        { otsikko: 'Työ', x: L + 72 },
        ...(naytaKuka ? [{ otsikko: 'Tekijä', x: L + 112 }] : []),
        { otsikko: 'Kuitattavat', x: R - 26, oikea: true },
        { otsikko: 'Heikkinen', x: R, oikea: true },
      ]

  const otsikkorivi = (y: number) => {
    doc.setFillColor(242, 242, 242); doc.rect(L, y - 4.5, R - L, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60)
    sar.forEach((s) => doc.text(s.otsikko, s.x + (s.oikea ? 0 : 1), y, s.oikea ? { align: 'right' } : undefined))
    return y + 7
  }

  const lyhenna = (t: string, mm: number) => {
    let s = t
    while (s.length > 1 && doc.getTextWidth(s) > mm) s = s.slice(0, -1)
    return s === t ? t : s.slice(0, -1) + '…'
  }

  ryhmat.forEach((ryhma, gi) => {
    if (gi > 0) doc.addPage()
    let y = otsikkorivi(ylaosa(ryhma))
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20)
    if (ryhma.rivit.length === 0) {
      doc.setTextColor(120); doc.text('Ei tunteja valitulla jaksolla.', L + 1, y); y += 8
    }
    ryhma.rivit.forEach((r, i) => {
      if (y > 262) { doc.addPage(); y = otsikkorivi(ylaosa(ryhma)); doc.setFont('helvetica', 'normal'); doc.setFontSize(9) }
      if (i % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(L, y - 4.2, R - L, 6.2, 'F') }
      doc.setTextColor(20)
      if (o.tyyppi === 'kuitattavat') {
        doc.text(formatDate(r.pvm), L + 1, y)
        doc.text(lyhenna(r.laji, naytaKuka ? 78 : 140), L + 25, y)
        if (naytaKuka) doc.text(lyhenna(r.kuka, 45), L + 106, y)
        doc.text(h(r.tunnit), R, y, { align: 'right' })
      } else {
        doc.text(formatDate(r.pvm), L + 1, y)
        doc.text(lyhenna(r.tyomaa, 47), L + 23, y)
        doc.text(lyhenna(r.laji, naytaKuka ? 37 : 70), L + 73, y)
        if (naytaKuka) doc.text(lyhenna(r.kuka, 30), L + 113, y)
        doc.text(r.kuitattava ? h(r.tunnit) : '', R - 26, y, { align: 'right' })
        doc.text(r.kuitattava ? '' : h(r.tunnit), R, y, { align: 'right' })
      }
      y += 6.2
    })

    // Yhteensä henkilöittäin
    y += 2
    doc.setDrawColor(160); doc.line(L, y - 3, R, y - 3)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    const summat = summatHenkiloittain(ryhma.rivit)
    if (summat.length === 0) summat.push({ kuka: o.tyontekijat[0] ?? '', kuitattavat: 0, heikkinen: 0 })
    summat.forEach((s) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(`Yhteensä${naytaKuka ? ` ${s.kuka}` : ''}`, L + 1, y + 2)
      if (o.tyyppi === 'kuitattavat') doc.text(h(s.kuitattavat), R, y + 2, { align: 'right' })
      else {
        doc.text(h(s.kuitattavat), R - 26, y + 2, { align: 'right' })
        doc.text(h(s.heikkinen), R, y + 2, { align: 'right' })
      }
      y += 7
    })

    // Kuittaus rakennusmestarilta
    if (o.tyyppi === 'kuitattavat') {
      if (y > 235) { doc.addPage(); y = 30 }
      y += 12
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60)
      doc.text('Kuitataan yllä olevat tunnit tehdyiksi.', L, y)
      y += 18
      doc.setDrawColor(120)
      doc.line(L, y, L + 45, y); doc.line(L + 55, y, R, y)
      doc.setFontSize(8); doc.setTextColor(110)
      doc.text('Päiväys', L, y + 4.5)
      doc.text('Rakennusmestari, allekirjoitus ja nimenselvennys', L + 55, y + 4.5)
    }
  })

  // Sivunumerot
  const sivuja = doc.getNumberOfPages()
  for (let p = 1; p <= sivuja; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140)
    doc.text(`Laadittu ${formatDate(new Date().toISOString().slice(0, 10))}`, L, 287)
    doc.text(`Sivu ${p}/${sivuja}`, W - L, 287, { align: 'right' })
  }

  const yksiTyomaa = o.tyyppi === 'kuitattavat' && ryhmat.length === 1 && ryhmat[0].otsikko
    ? `_${ryhmat[0].otsikko.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}` : ''
  const nimi = o.tyyppi === 'kuitattavat' ? 'Kuitattavat_tunnit' : 'Tunnit'
  return { blob: doc.output('blob'), tiedosto: `${nimi}${yksiTyomaa}_${o.tiedostoJakso}.pdf` }
}
