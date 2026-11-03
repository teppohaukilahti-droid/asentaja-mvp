// Resursointi: kaikille työnjohtajille yhteinen taulu — työmaat riveinä,
// viikot sarakkeina, soluissa asentajat. Viikkopalaverin korvaaja:
// jokainen näkee kuka on missä ja koska vapautuu. Ehdotukset katkoviivalla,
// törmäykset punaisella, GPS-ristiriita varoitusmerkillä.
import { useMemo } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import type { Ws, Vapautus, Miehitys, Visit, Ent, WeekCol } from '../../lib/kalenteri'
import { effectiveEnd, overlapsWeek, daysFromToday } from '../../lib/kalenteri'
import { formatDate } from '../../lib/helpers'

type Props = {
  sites: Ws[]
  miehitykset: Miehitys[]
  vapautumiset: Vapautus[]
  visits: Visit[]
  ents: Ent[]
  nameOf: Map<string, string>
  weeks: WeekCol[]
  canEdit: boolean
  onOpenKiinnitys: (ws: Ws, week: WeekCol) => void
  onOpenMiehitys: (m: Miehitys) => void
  onOpenSite: (ws: Ws) => void
}

export default function ResursointiTab({
  sites, miehitykset, vapautumiset, visits, ents, nameOf, weeks, canEdit,
  onOpenKiinnitys, onOpenMiehitys, onOpenSite,
}: Props) {
  // Tehollinen loppu jokaiselle miehitykselle
  const ends = useMemo(() => {
    const m = new Map<string, string | null>()
    miehitykset.forEach((mi) => m.set(mi.id, effectiveEnd(mi, vapautumiset, sites.find((s) => s.id === mi.worksite_id))))
    return m
  }, [miehitykset, vapautumiset, sites])

  // Törmäykset: sama asentaja kahdessa (ei-vastustetussa) miehityksessä samalla viikolla eri työmailla
  const conflicts = useMemo(() => {
    const set = new Set<string>()
    const act = miehitykset.filter((m) => m.status !== 'vastustettu')
    for (const w of weeks) {
      const byUser = new Map<string, Miehitys[]>()
      act.forEach((m) => {
        if (overlapsWeek(m, ends.get(m.id) ?? null, w)) {
          byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), m])
        }
      })
      byUser.forEach((list) => {
        if (new Set(list.map((m) => m.worksite_id)).size > 1) list.forEach((m) => set.add(`${m.id}:${w.monday}`))
      })
    }
    return set
  }, [miehitykset, ends, weeks])

  // GPS-ristiriita kuluvalla viikolla: varmistettu miehitys, mutta tuoreimmat
  // havainnot (käynnit/kirjaukset) ovat toiselta työmaalta
  const gpsMismatch = useMemo(() => {
    const latest = new Map<string, { site: string; pvm: string }>()
    const consider = (name: string | null | undefined, wsId: string, pvm: string) => {
      if (!name) return
      const cur = latest.get(name)
      if (!cur || pvm > cur.pvm) latest.set(name, { site: wsId, pvm })
    }
    visits.forEach((v) => consider(v.user_name, v.worksite_id, v.pvm))
    ents.forEach((e) => consider(nameOf.get(e.user_id), e.worksite_id, e.entry_date))
    const set = new Set<string>()
    const curWeek = weeks.find((w) => w.isCurrent)
    if (!curWeek) return set
    miehitykset.forEach((m) => {
      if (m.status !== 'varmistettu' || !overlapsWeek(m, ends.get(m.id) ?? null, curWeek)) return
      const obs = latest.get(m.user_name)
      if (obs && obs.site !== m.worksite_id) set.add(m.id)
    })
    return set
  }, [miehitykset, ends, weeks, visits, ents, nameOf])

  const pendingCount = miehitykset.filter((m) => m.status === 'ehdotus').length

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-900 rounded-xl px-3 py-2">
          {pendingCount} ehdotusta odottaa — varmistuvat itsestään 24 h kuluttua ellei kukaan vastusta. Katkoviivachipin napautus avaa käsittelyn.
        </p>
      )}

      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <table className="border-separate border-spacing-0 min-w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-950 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 py-2 min-w-[7.5rem] max-w-[7.5rem]">
                Työmaa
              </th>
              {weeks.map((w) => (
                <th key={w.monday} className={`text-center text-[11px] font-bold px-1 py-2 min-w-[6.5rem] ${w.isCurrent ? 'text-amber-400' : 'text-gray-500'}`}>
                  vko {w.vko}
                  <span className="block text-[9px] font-normal text-gray-600">{formatDate(w.monday).slice(0, -5)}–</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((ws) => {
              const rowM = miehitykset.filter((m) => m.worksite_id === ws.id && m.status !== 'vastustettu')
              const late = ws.arvioitu_valmis && daysFromToday(ws.arvioitu_valmis) < 0 && ws.valmius_pct < 100
              return (
                <tr key={ws.id} className="align-top">
                  <td className="sticky left-0 z-10 bg-gray-950 px-2 py-1.5 min-w-[7.5rem] max-w-[7.5rem] border-t border-gray-800">
                    <button onClick={() => onOpenSite(ws)} className="text-left w-full">
                      <span className="block text-xs font-semibold leading-tight truncate">{ws.name}</span>
                      <span className="mt-1 flex items-center gap-1">
                        <span className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <span className={`block h-full rounded-full ${late ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${ws.valmius_pct}%` }} />
                        </span>
                        <span className={`text-[9px] tabular-nums ${late ? 'text-red-400 font-bold' : 'text-gray-500'}`}>{ws.valmius_pct}%</span>
                      </span>
                    </button>
                  </td>
                  {weeks.map((w) => {
                    const cell = rowM.filter((m) => overlapsWeek(m, ends.get(m.id) ?? null, w))
                    return (
                      <td key={w.monday} className={`px-1 py-1.5 border-t border-gray-800 ${w.isCurrent ? 'bg-gray-900/60' : ''}`}>
                        <div className="flex flex-col gap-1 items-stretch min-h-[1.75rem]">
                          {cell.map((m) => {
                            const conflict = conflicts.has(`${m.id}:${w.monday}`)
                            const mismatch = w.isCurrent && gpsMismatch.has(m.id)
                            const end = ends.get(m.id)
                            const endsThisWeek = end != null && end >= w.monday && end <= w.sunday
                            return (
                              <button key={m.id} onClick={() => canEdit && onOpenMiehitys(m)}
                                title={`${m.user_name} · ${formatDate(m.alkaa)} → ${end ? formatDate(end) : 'avoin'}${m.status === 'ehdotus' ? ` · ehdotti ${m.proposer_name ?? '?'}` : ''}`}
                                className={`text-[10px] font-semibold leading-tight px-1.5 py-1 rounded-lg text-left truncate
                                  ${conflict ? 'bg-red-500/20 text-red-300 border border-red-700'
                                    : m.status === 'ehdotus' ? 'bg-transparent text-amber-300 border border-dashed border-amber-500/60'
                                    : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>
                                {mismatch && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5 text-amber-400" />}
                                {m.user_name.split(' ')[0]}{endsThisWeek ? ' ↦' : ''}
                              </button>
                            )
                          })}
                          {canEdit && (
                            <button onClick={() => onOpenKiinnitys(ws, w)} aria-label="Kiinnitä asentaja"
                              className="self-center p-0.5 text-gray-700 hover:text-amber-400 transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sites.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Ei aktiivisia työmaita.</p>}

      <p className="text-[10px] text-gray-600">
        Kiinteä chip = varmistettu · katkoviiva = ehdotus (varmistuu 24 h) · punainen = sama mies kahdella työmaalla ·
        ↦ = vapautuu tällä viikolla · <AlertTriangle className="w-2.5 h-2.5 inline -mt-0.5" /> = kirjaukset tulevat muualta kuin suunnitelma sanoo.
        Loppupää: asentajan oma vapautumisilmoitus voittaa käsin asetetun ja työmaan aikataulun.
      </p>
    </div>
  )
}
