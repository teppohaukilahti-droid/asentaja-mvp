// Kuukausi: pitkän tähtäimen silmäys + silta puhelimen omaan kalenteriin.
// ICS-syöte: työnjohtaja tilaa henkilökohtaisen linkin Google/Apple/Outlook-
// kalenteriinsa, jolloin toimitukset, merkinnät ja valmistumiset näkyvät
// samassa kalenterissa kuin palaverit ja muu elämä — ilman kirjautumisia.
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Copy, Check, Trash2, Plus } from 'lucide-react'
import type { Ws, Vapautus, Toimitus, Merkinta, Tehtava } from '../../lib/kalenteri'
import { formatDate, today, toInput } from '../../lib/helpers'

type CalEvent = { key: string; type: 'toimitus' | 'vapautuminen' | 'alkaa' | 'valmis' | 'oma' | 'tehtava'; label: string; sub: string; dot: string }

type Props = {
  sites: Ws[]
  vapautumiset: Vapautus[]
  toimitukset: Toimitus[]
  merkinnat: Merkinta[]
  tehtavat: Tehtava[]
  siteName: Map<string, string>
  icsUrl: string | null
  canEdit: boolean
  onAddMerkinta: (pvm: string, otsikko: string) => void
  onDeleteMerkinta: (id: string) => void
}

const KUUKAUDET = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu']
const VIIKONPAIVAT = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su']

export default function KuukausiTab({
  sites, vapautumiset, toimitukset, merkinnat, tehtavat, siteName, icsUrl, canEdit,
  onAddMerkinta, onDeleteMerkinta,
}: Props) {
  const [monthAnchor, setMonthAnchor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDay, setSelectedDay] = useState(today())
  const [newMerkinta, setNewMerkinta] = useState('')
  const [copied, setCopied] = useState(false)

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    const add = (pvm: string, ev: CalEvent) => m.set(pvm, [...(m.get(pvm) ?? []), ev])
    toimitukset.forEach((t) => {
      if (!t.toimitus_pvm || t.status === 'toimitettu') return
      add(t.toimitus_pvm, {
        key: `t${t.id}`, type: 'toimitus', dot: 'bg-amber-400',
        label: `${t.item_text}${t.maara ? ` (${t.maara})` : ''} → ${siteName.get(t.worksite_id) ?? 'työmaa'}`,
        sub: `toimitus${t.kiire ? ' · KIIRE' : ''}${t.status === 'tilattu' ? ' · tilattu' : ''}`,
      })
    })
    vapautumiset.forEach((v) => add(v.pvm, {
      key: `v${v.id}`, type: 'vapautuminen', dot: 'bg-green-400',
      label: `${v.user_name ?? '?'} vapautuu`,
      sub: `${siteName.get(v.worksite_id) ?? ''}${v.varma ? '' : ' · arvio'}`,
    }))
    sites.forEach((w) => {
      if (w.alkaa) add(w.alkaa, { key: `a${w.id}`, type: 'alkaa', dot: 'bg-gray-400', label: `${w.name} alkaa`, sub: 'työmaa' })
      if (w.arvioitu_valmis) add(w.arvioitu_valmis, {
        key: `d${w.id}`, type: 'valmis', dot: w.valmius_pct >= 100 ? 'bg-green-400' : 'bg-red-400',
        label: `${w.name} valmis (arvio)`, sub: `valmius nyt ${w.valmius_pct} %`,
      })
    })
    merkinnat.forEach((k) => add(k.pvm, {
      key: `m${k.id}`, type: 'oma', dot: 'bg-gray-200',
      label: k.otsikko, sub: k.created_by_name ?? 'oma merkintä',
    }))
    tehtavat.forEach((t) => {
      if (!t.pvm || t.tehty) return
      add(t.pvm, { key: `h${t.id}`, type: 'tehtava', dot: 'bg-gray-200', label: t.teksti, sub: 'tehtävä' })
    })
    return m
  }, [toimitukset, vapautumiset, sites, merkinnat, tehtavat, siteName])

  const monthGrid = useMemo(() => {
    const y = monthAnchor.getFullYear(); const mo = monthAnchor.getMonth()
    const first = new Date(y, mo, 1)
    const start = new Date(first)
    start.setDate(1 - ((first.getDay() + 6) % 7))
    const weeks: { pvm: string; day: number; inMonth: boolean }[][] = []
    const cur = new Date(start)
    const end = new Date(y, mo + 1, 0)
    while (cur <= end || (weeks.length > 0 && weeks[weeks.length - 1].length % 7 !== 0)) {
      if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([])
      weeks[weeks.length - 1].push({ pvm: toInput(cur), day: cur.getDate(), inMonth: cur.getMonth() === mo })
      cur.setDate(cur.getDate() + 1)
      if (weeks.length > 6) break
    }
    return weeks.filter((w) => w.length === 7)
  }, [monthAnchor])

  function shiftMonth(delta: number) {
    setMonthAnchor((d) => { const n = new Date(d); n.setMonth(n.getMonth() + delta); return n })
  }

  async function copyIcs() {
    if (!icsUrl) return
    try {
      await navigator.clipboard.writeText(icsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* selain esti */ }
  }

  const dayEvents = eventsByDay.get(selectedDay) ?? []

  return (
    <div className="space-y-3">
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shiftMonth(-1)} aria-label="Edellinen kuukausi" className="p-3 text-gray-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
          <p className="text-sm font-bold capitalize">{KUUKAUDET[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</p>
          <button onClick={() => shiftMonth(1)} aria-label="Seuraava kuukausi" className="p-3 text-gray-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {VIIKONPAIVAT.map((d) => <p key={d} className="text-center text-[10px] font-semibold text-gray-600">{d}</p>)}
        </div>
        {monthGrid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((d) => {
              const evs = eventsByDay.get(d.pvm) ?? []
              const isToday = d.pvm === today()
              const isSel = d.pvm === selectedDay
              return (
                <button key={d.pvm} onClick={() => setSelectedDay(d.pvm)}
                  className={`relative h-11 rounded-lg flex flex-col items-center justify-center transition-colors
                    ${isSel ? 'bg-amber-500 text-gray-950' : isToday ? 'bg-gray-800' : 'hover:bg-gray-800/60'}
                    ${d.inMonth ? '' : 'opacity-30'}`}>
                  <span className={`text-sm ${isSel || isToday ? 'font-bold' : ''} leading-none`}>{d.day}</span>
                  <span className="flex gap-0.5 mt-1 h-1.5">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.key} className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-gray-950/70' : e.dot}`} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
        <p className="text-[10px] text-gray-600 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />toimitus</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />vapautuu</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />valmistuu</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-gray-200 mr-1" />merkintä/tehtävä</span>
        </p>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {selectedDay === today() ? 'Tänään' : formatDate(selectedDay)}
        </h2>
        {dayEvents.length === 0 && <p className="text-sm text-gray-500">Ei tapahtumia.</p>}
        {dayEvents.map((e) => (
          <div key={e.key} className="flex items-start justify-between gap-2">
            <p className="text-sm min-w-0">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${e.dot}`} />
              <b>{e.label}</b>
              <span className="text-gray-500"> · {e.sub}</span>
            </p>
            {e.type === 'oma' && canEdit && (
              <button onClick={() => onDeleteMerkinta(e.key.slice(1))} aria-label="Poista merkintä" className="p-1.5 text-gray-600 hover:text-red-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="flex gap-2 pt-1">
            <input type="text" value={newMerkinta} onChange={(e) => setNewMerkinta(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newMerkinta.trim()) { onAddMerkinta(selectedDay, newMerkinta.trim()); setNewMerkinta('') } }}
              placeholder="Oma merkintä tälle päivälle…"
              className="flex-1 px-3.5 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <button onClick={() => { if (newMerkinta.trim()) { onAddMerkinta(selectedDay, newMerkinta.trim()); setNewMerkinta('') } }}
              disabled={!newMerkinta.trim()} aria-label="Lisää merkintä"
              className="px-4 rounded-xl bg-gray-800 border border-gray-700 text-amber-400 disabled:opacity-40">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* ICS: silta puhelimen omaan kalenteriin */}
      {icsUrl && (
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" /> Tilaa puhelimen kalenteriin
          </h2>
          <p className="text-xs text-gray-500">
            Henkilökohtainen kalenterisyöte: toimitukset, merkinnät, tehtävät, vapautumiset ja valmistumiset
            ilmestyvät omaan kalenteriisi (Google/Apple/Outlook) ja pysyvät ajan tasalla itsestään.
            Kopioi linkki ja lisää se kalenterisovelluksessa: "Tilaa kalenteri" / "Lisää URL-osoitteesta".
          </p>
          <button onClick={copyIcs}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-semibold">
            {copied ? <><Check className="w-4 h-4 text-green-400" /> Linkki kopioitu</> : <><Copy className="w-4 h-4" /> Kopioi kalenterilinkki</>}
          </button>
          <p className="text-[10px] text-gray-600">Linkki on henkilökohtainen — älä jaa sitä firman ulkopuolelle. Kalenterisovellukset päivittävät syötteen muutaman tunnin välein.</p>
        </section>
      )}
    </div>
  )
}
