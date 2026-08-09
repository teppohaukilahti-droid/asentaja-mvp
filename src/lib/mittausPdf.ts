// Mittauspöytäkirjan PDF: sisältää allekirjoituksen, eheystiivisteen ja
// QR-koodin julkiseen varmennussivuun ("kolmas kappale" digitaalisesti).
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { formatDate } from './helpers'

export type MRow = {
  tuote: string; tila: 'ht' | 'kt' | 'lab'; huone: string; mitat: string; kpl: string
  itselleluovutus: boolean; primer: boolean; tasoitus: boolean; hionta: boolean
  suojaus: boolean; siivous: boolean; hammaslasta: boolean
}

export type PdfPoytakirja = {
  numero: number
  period_start: string | null; period_end: string | null
  tyokohde: string | null; osoite: string | null; laskutus: string | null
  huom: string | null; tyontekijat: string | null
  rows: MRow[]
  mestari_nimi: string | null; signature_png: string | null
  signed_at: string | null; content_hash: string | null
  signed_on_device?: string
}

export async function downloadMittausPdf(p: PdfPoytakirja): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape' })
  const W = 297
  doc.setFontSize(18); doc.setTextColor(160, 20, 30)
  doc.text('HEIKKINEN', 14, 16)
  doc.setFontSize(8); doc.setTextColor(80)
  doc.text('HEIKKINEN YHTIOT OY', 14, 21)
  doc.setFontSize(13); doc.setTextColor(160, 20, 30)
  doc.text('MITTAUSPOYTAKIRJA', W - 14, 14, { align: 'right' })
  doc.setFontSize(12)
  doc.text(String(p.numero), W - 14, 20, { align: 'right' })
  doc.setFontSize(9); doc.setTextColor(0)
  doc.text(`Suoritettu seina- ja lattiapaallystetyota ${p.period_start ? formatDate(p.period_start) : ''} - ${p.period_end ? formatDate(p.period_end) : ''}`, 100, 16)
  let y = 30
  doc.text(`Tyokohde: ${p.tyokohde ?? ''}`, 14, y); y += 5.5
  doc.text(`Osoite: ${p.osoite ?? ''}`, 14, y); y += 5.5
  doc.text(`Laskutus: ${p.laskutus ?? ''}`, 14, y); y += 8

  const cols = [
    { x: 14, t: 'TUOTE' }, { x: 76, t: 'Tila' }, { x: 86, t: 'Huone' },
    { x: 112, t: 'Itsel.' }, { x: 124, t: 'MITAT' }, { x: 154, t: 'KPL' },
    { x: 168, t: 'Primer' }, { x: 185, t: 'Tasoitus' }, { x: 203, t: 'Hionta+imur.' },
    { x: 227, t: 'Suojaus' }, { x: 245, t: 'Siivous' }, { x: 262, t: 'H-lasta' },
  ]
  doc.setFillColor(245, 235, 235)
  doc.rect(14, y - 4, W - 28, 6, 'F')
  doc.setFontSize(7); doc.setTextColor(120, 20, 30)
  cols.forEach((c) => doc.text(c.t, c.x + 1, y))
  y += 4
  doc.setTextColor(0); doc.setFontSize(8)
  const mark = (v: boolean) => (v ? 'X' : '')
  p.rows.forEach((r) => {
    if (y > 175) { doc.addPage(); y = 20 }
    doc.setDrawColor(200)
    doc.line(14, y + 2.5, W - 14, y + 2.5)
    doc.text((r.tuote || '').substring(0, 42), 15, y)
    doc.text(r.tila, 77, y)
    doc.text((r.huone || '').substring(0, 16), 87, y)
    doc.text(mark(r.itselleluovutus), 116, y)
    doc.text((r.mitat || '').substring(0, 18), 125, y)
    doc.text((r.kpl || '').substring(0, 8), 155, y)
    doc.text(mark(r.primer), 174, y)
    doc.text(mark(r.tasoitus), 192, y)
    doc.text(mark(r.hionta), 212, y)
    doc.text(mark(r.suojaus), 234, y)
    doc.text(mark(r.siivous), 251, y)
    doc.text(mark(r.hammaslasta), 269, y)
    y += 6
  })
  y += 3
  doc.setFontSize(7); doc.setTextColor(100)
  doc.text('ht=huonetila  kt=kosteatila  lab=IV-koneh., laboratoriot, muut vst. tilat  H-lasta=hammaslastatasoitus', 14, y)
  y += 6
  if (p.huom) {
    doc.setFontSize(9); doc.setTextColor(0)
    doc.text(`Huom! ${p.huom}`.substring(0, 160), 14, y)
    y += 8
  }
  y = Math.max(y, 160)
  doc.setDrawColor(120); doc.line(14, y, W - 14, y); y += 6
  doc.setFontSize(9); doc.setTextColor(0)
  doc.text(`Tyontekijat: ${p.tyontekijat ?? ''}`, 14, y)
  doc.text(`Mestari: ${p.mestari_nimi ?? ''}`, 120, y)
  if (p.signed_at) doc.text(`Paivays: ${formatDate(p.signed_at.slice(0, 10))}`, 210, y)
  y += 4
  if (p.signature_png) {
    try { doc.addImage(p.signature_png, 'PNG', 120, y, 55, 18) } catch { /* noop */ }
  }
  doc.setFontSize(7); doc.setTextColor(100)
  doc.text(p.signed_on_device === 'mestari' ? 'Allekirjoitettu mestarin omalla laitteella' : 'Allekirjoitettu tyontekijan laitteella', 120, y + 22)

  // Varmennus-QR ja tiiviste
  try {
    const verifyUrl = `${window.location.origin}/varmenna?nro=${p.numero}`
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 })
    doc.addImage(qr, 'PNG', W - 44, y - 2, 28, 28)
    doc.setFontSize(6); doc.setTextColor(100)
    doc.text('Varmenna aitous', W - 44, y + 29)
  } catch { /* noop */ }
  doc.setFontSize(6); doc.setTextColor(130)
  doc.text(`Sahkoisesti allekirjoitettu ja lukittu ${p.signed_at ?? ''}`, 14, y + 26)
  doc.text(`Eheystiiviste (SHA-256): ${p.content_hash ?? ''}`, 14, y + 30)
  doc.save(`Mittauspoytakirja_${p.numero}.pdf`)
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
