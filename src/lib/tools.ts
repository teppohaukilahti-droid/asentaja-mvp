// Työkaluseurannan tyypit ja apurit
export type Tool = {
  id: string
  name: string
  numero: number
  status: 'varastossa' | 'tyomaalla' | 'asentajalla' | 'huollossa' | 'kadonnut'
  worksite_id: string | null
  holder_id: string | null
  qr_token: string
  huom: string | null
  vika_kuvaus: string | null
  vika_ilmoitettu: string | null
  vika_ilmoittaja: string | null
  updated_at: string
  worksites?: { name: string } | null
  holder?: { full_name: string } | null
}

export type ToolEvent = {
  id: string
  user_name: string | null
  event: string
  to_status: string | null
  worksite_name: string | null
  created_at: string
}

export const TOOL_STATUS_LABEL: Record<Tool['status'], string> = {
  varastossa: 'Varastossa',
  tyomaalla: 'Työmaalla',
  asentajalla: 'Asentajalla',
  huollossa: 'Huollossa',
  kadonnut: 'Etsinnässä',
}

export const TOOL_STATUS_STYLE: Record<Tool['status'], string> = {
  varastossa: 'bg-green-500/10 border-green-500/30 text-green-400',
  tyomaalla: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  asentajalla: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  huollossa: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  kadonnut: 'bg-red-500/10 border-red-500/30 text-red-400',
}

export const COMMON_TOOL_NAMES = [
  'Hiomakone', 'Imuri', 'Tasoitesekoitin', 'Hitsausautomaatti',
  'Kuumailmapuhallin', 'Jyrsin', 'Pora', 'Naulain',
]

export const toolLabel = (t: Pick<Tool, 'name' | 'numero'>) => `${t.name} #${t.numero}`

export const toolLocation = (t: Tool): string => {
  if (t.status === 'varastossa') return 'Varasto'
  if (t.status === 'tyomaalla') return t.worksites?.name ?? 'Työmaa'
  if (t.status === 'asentajalla') return t.holder?.full_name ?? 'Asentaja'
  if (t.status === 'huollossa') return 'Huolto'
  return 'Sijainti tuntematon'
}

export function toolTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'juuri nyt'
  if (min < 60) return `${min} min sitten`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h sitten`
  const d = Math.floor(h / 24)
  return `${d} pv sitten`
}
