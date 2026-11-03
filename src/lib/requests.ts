// Tarve→tilaus-järjestelmän jaetut tyypit ja apurit
export type MaterialRequest = {
  id: string
  organization_id: string
  worksite_id: string
  requested_by: string
  material_id: string | null
  item_text: string
  maara: string | null
  kiire: boolean
  lisatiedot: string | null
  status: 'avoin' | 'hyvaksytty' | 'tilattu' | 'saapunut' | 'toimitettu' | 'hylatty'
  forwarded_to: 'tyonjohtaja' | 'varasto' | 'toimittaja' | null
  handled_by: string | null
  approved_at: string | null
  ordered_at: string | null
  delivered_at: string | null
  toimitus_pvm: string | null
  created_at: string
  worksites?: { name: string; address: string | null; client_company: string | null } | null
  requester?: { full_name: string } | null
}

export const STATUS_LABEL: Record<MaterialRequest['status'], string> = {
  avoin: 'Avoin',
  hyvaksytty: 'Hyväksytty',
  tilattu: 'Tilattu',
  saapunut: 'Varastolla',
  toimitettu: 'Toimitettu',
  hylatty: 'Hylätty',
}

export const STATUS_STYLE: Record<MaterialRequest['status'], string> = {
  avoin: 'bg-amber-500/15 text-amber-400',
  hyvaksytty: 'bg-blue-500/15 text-blue-300',
  tilattu: 'bg-purple-500/15 text-purple-300',
  saapunut: 'bg-cyan-500/15 text-cyan-300',
  toimitettu: 'bg-green-500/15 text-green-400',
  hylatty: 'bg-gray-700 text-gray-400',
}

export const FORWARD_LABEL: Record<string, string> = {
  tyonjohtaja: 'Työnjohtaja hoitaa',
  varasto: 'Varasto hoitaa',
  toimittaja: 'Tilaus toimittajalta',
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'juuri nyt'
  if (mins < 60) return `${mins} min sitten`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} h sitten`
  return `${Math.floor(h / 24)} pv sitten`
}

export function buildOrderMessage(r: MaterialRequest, ordererName: string): string {
  return [
    'TILAUS – Heikkinen Yhtiöt Oy',
    '',
    `Työmaa: ${r.worksites?.name ?? ''}`,
    r.worksites?.address ? `Toimitusosoite: ${r.worksites.address}` : '',
    r.worksites?.client_company ? `Tilaaja/kohde: ${r.worksites.client_company}` : '',
    '',
    `Tuote: ${r.item_text}`,
    r.maara ? `Määrä: ${r.maara}` : '',
    r.kiire ? 'Toimitus: KIIREELLINEN – mahdollisimman pian' : 'Toimitus: normaali aikataulu',
    r.lisatiedot ? `Lisätiedot: ${r.lisatiedot}` : '',
    '',
    `Yhteyshenkilö työmaalla: ${r.requester?.full_name ?? ''}`,
    `Tilauksen tekijä: ${ordererName}`,
  ].filter((l) => l !== '').join('\n')
}
