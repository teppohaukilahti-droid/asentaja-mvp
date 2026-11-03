// Oma viikko: työnjohtajan lukujärjestys. Ylimpänä hälytyskaista
// (punaiset materiaalisaldot, kiiretarpeet, myöhässä olevat toimitukset,
// eskaloinnit), sitten ma–su päivärivit tapahtumineen ja tehtävineen.
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, Plus, Check, Trash2, Truck, Square, CheckSquare } from 'lucide-react'
import type { Ws, Vapautus, Toimitus, Merkinta, Tehtava, MaterialRow } from '../../lib/kalenteri'
import { daysFromToday } from '../../lib/kalenteri'
import { formatDate, today, toInput } from '../../lib/helpers'

type Halytys = { key: string; teksti: string; wsId: string | null; tehtavaEhdotus: string }

type Props = {
  sites: Ws[]
  vapautumiset: Vapautus[]
  toimitukset: Toimitus[]
  merkinnat: Merkinta[]
  tehtavat: Tehtava[]
  materials: MaterialRow[]
  eskaloituja: number
  myId: string | null
  siteName: Map<string, string>
  onOpenSite: (ws: Ws) => void
  onAddTehtava: (pvm: string | null, teksti: string, wsId: string | null) => void
  onToggleTehtava: (t: Tehtava) => void
  onDeleteTehtava: (id: string) => void
  onDeleteMerkinta: (id: string) => void
  onAddMerkinta: (pvm: string, otsikko: string) => void
  onGoTyonjohto: () => void
}

const PAIVAT = ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai']

export default function OmaViikkoTab({
  sites, vapautumiset, toimitukset, merkinnat, tehtavat, materials, eskaloituja,
  myId, siteName, onOpenSite, onAddTehtava, onToggleTehtava, onDeleteTehtava,
  onDeleteMerkinta, onAddMerkinta, onGoTyonjohto,
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [omatVain, setOmatVain] = useState(false)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [addText, setAddText] = useState('')
  const [addKind, setAddKind] = useState<'tehtava' | 'merkinta'>('tehtava')

  const shownSites = useMemo(
    () => (omatVain && myId ? sites.filter((s) => s.foreman_id === myId) : sites),
    [sites, omatVain, myId],
  )
  const shownIds = useMemo(() => new Set(shownSites.map((s) => s.id)), [shownSites])

  // Viikon päivät
  const days = useMemo(() => {
    const mon = new Date()
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(d.getDate() + i)
      return toInput(d)
    })
  }, [weekOffset])

  // ── Hälytyskaista ──
  const halytykset = useMemo(() => {
    const list: Halytys[] = []
    materials.forEach((m) => {
      if (m.halytysraja != null && m.balance <= m.halytysraja && shownIds.has(m.worksite_id)) {
        list.push({
          key: `s${m.id}`, wsId: m.worksite_id,
          teksti: `${siteName.get(m.worksite_id) ?? ''}: ${m.name} jäljellä ${String(Math.round(m.balance * 10) / 10).replace('.', ',')} ${m.unit} (raja ${String(m.halytysraja).replace('.', ',')})`,
          tehtavaEhdotus: `Tilaa lisää: ${m.name} — ${siteName.get(m.worksite_id) ?? ''}`,
        })
      }
    })
    toimitukset.forEach((t) => {
      if (!shownIds.has(t.worksite_id)) return
      if (t.kiire && t.status === 'avoin') {
        list.push({
          key: `k${t.id}`, wsId: t.worksite_id,
          teksti: `KIIRE: ${t.item_text} — ${siteName.get(t.worksite_id) ?? ''}`,
          tehtavaEhdotus: `Hoida kiiretarve: ${t.item_text} — ${siteName.get(t.worksite_id) ?? ''}`,
        })
      }
      if (t.toimitus_pvm && daysFromToday(t.toimitus_pvm) < 0 && t.status !== 'toimitettu') {
        list.push({
          key: `m${t.id}`, wsId: t.worksite_id,
          teksti: `Toimitus myöhässä: ${t.item_text} — luvattu ${formatDate(t.toimitus_pvm)}`,
          tehtavaEhdotus: `Toimita myöhässä oleva: ${t.item_text} — ${siteName.get(t.worksite_id) ?? ''}`,
        })
      }
    })
    return list
  }, [materials, toimitukset, shownIds, siteName])

  // ── Päivän sisältö ──
  function dayItems(pvm: string) {
    const toim = toimitukset.filter((t) => t.toimitus_pvm === pvm && shownIds.has(t.worksite_id))
    const vaps = vapautumiset.filter((v) => v.pvm === pvm && shownIds.has(v.worksite_id))
    const merk = merkinnat.filter((m) => m.pvm === pvm)
    const valm = shownSites.filter((s) => s.arvioitu_valmis === pvm)
    const teht = tehtavat.filter((t) => t.pvm === pvm)
    return { toim, vaps, merk, valm, teht, empty: !toim.length && !vaps.length && !merk.length && !valm.length && !teht.length }
  }

  const undatedTehtavat = tehtavat.filter((t) => t.pvm === null && !t.tehty)

  function submitAdd() {
    if (!addFor || !addText.trim()) return
    if (addKind === 'tehtava') onAddTehtava(addFor, addText.trim(), null)
    else onAddMerkinta(addFor, addText.trim())
    setAddText(''); setAddFor(null)
  }

  return (
    <div className="space-y-3">
      {/* Hälytyskaista */}
      {(halytykset.length > 0 || eskaloituja > 0) && (
        <section className="bg-red-950/40 border border-red-900 rounded-2xl p-3 space-y-2">
          <p className="text-[11px] font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Vaatii toimia
          </p>
          {halytykset.map((h) => (
            <div key={h.key} className="flex items-center justify-between gap-2">
              <button onClick={() => { const ws = sites.find((s) => s.id === h.wsId); if (ws) onOpenSite(ws) }}
                className="text-sm text-red-200 text-left min-w-0 truncate">{h.teksti}</button>
              <button onClick={() => onAddTehtava(today(), h.tehtavaEhdotus, h.wsId)}
                title="Tee tästä tehtävä" aria-label="Tee tehtävä"
                className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-800 text-gray-300 hover:text-white">
                → tehtäväksi
              </button>
            </div>
          ))}
          {eskaloituja > 0 && (
            <button onClick={onGoTyonjohto} className="flex items-center gap-2 text-sm text-red-200">
              <Truck className="w-3.5 h-3.5 shrink-0" /> {eskaloituja} eskaloitua pöytäkirjaa odottaa hoitoa →
            </button>
          )}
        </section>
      )}

      {/* Viikkonavigointi + suodatus */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset((o) => o - 1)} aria-label="Edellinen viikko" className="p-3 text-gray-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <p className="text-sm font-bold">{weekOffset === 0 ? 'Tämä viikko' : `${formatDate(days[0])} – ${formatDate(days[6])}`}</p>
          <button onClick={() => setOmatVain(!omatVain)}
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full mt-0.5 ${omatVain ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
            {omatVain ? 'Omat työmaat' : 'Kaikki työmaat'}
          </button>
        </div>
        <button onClick={() => setWeekOffset((o) => o + 1)} aria-label="Seuraava viikko" className="p-3 text-gray-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Päivärivit */}
      {days.map((pvm, i) => {
        const it = dayItems(pvm)
        const isToday = pvm === today()
        if (it.empty && i >= 5 && !isToday) return null // tyhjät viikonloput piiloon
        return (
          <section key={pvm} className={`rounded-2xl border p-3 ${isToday ? 'bg-gray-900 border-amber-500/40' : 'bg-gray-900 border-gray-800'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-amber-400' : 'text-gray-400'}`}>
                {PAIVAT[i]} <span className="font-normal text-gray-600">{formatDate(pvm)}</span>
              </p>
              <button onClick={() => { setAddFor(addFor === pvm ? null : pvm); setAddText('') }} aria-label="Lisää tälle päivälle"
                className="p-1.5 text-gray-600 hover:text-amber-400"><Plus className="w-4 h-4" /></button>
            </div>

            {it.empty && <p className="text-xs text-gray-600">—</p>}

            {it.toim.map((t) => (
              <p key={t.id} className="text-sm py-0.5">
                <Truck className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-amber-400" />
                {t.item_text}{t.maara ? ` (${t.maara})` : ''} → <b>{siteName.get(t.worksite_id)}</b>
                {t.status === 'tilattu' && <span className="text-gray-500"> · tilattu</span>}
              </p>
            ))}
            {it.vaps.map((v) => (
              <p key={v.id} className="text-sm py-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2" />
                <b>{v.user_name}</b> vapautuu · {siteName.get(v.worksite_id)}{v.varma ? '' : ' (arvio)'}
              </p>
            ))}
            {it.valm.map((s) => (
              <button key={s.id} onClick={() => onOpenSite(s)} className="block text-sm py-0.5 text-left">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.valmius_pct >= 100 ? 'bg-green-400' : 'bg-red-400'}`} />
                <b>{s.name}</b> valmis (arvio) · nyt {s.valmius_pct} %
              </button>
            ))}
            {it.merk.map((m) => (
              <p key={m.id} className="text-sm py-0.5 flex items-center justify-between gap-2 group">
                <span className="min-w-0 truncate">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-2" />
                  {m.otsikko} <span className="text-gray-600">· {m.created_by_name}</span>
                </span>
                <button onClick={() => onDeleteMerkinta(m.id)} aria-label="Poista merkintä" className="p-1 text-gray-700 hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </p>
            ))}
            {it.teht.map((t) => (
              <p key={t.id} className="text-sm py-0.5 flex items-center justify-between gap-2">
                <button onClick={() => onToggleTehtava(t)} className={`flex items-center gap-2 min-w-0 text-left ${t.tehty ? 'text-gray-600 line-through' : ''}`}>
                  {t.tehty ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0" /> : <Square className="w-4 h-4 text-gray-500 shrink-0" />}
                  <span className="truncate">{t.teksti}</span>
                </button>
                <button onClick={() => onDeleteTehtava(t.id)} aria-label="Poista tehtävä" className="p-1 text-gray-700 hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </p>
            ))}

            {addFor === pvm && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => setAddKind('tehtava')} className={`py-2 rounded-lg text-xs font-semibold ${addKind === 'tehtava' ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Tehtävä (kuitattava)</button>
                  <button onClick={() => setAddKind('merkinta')} className={`py-2 rounded-lg text-xs font-semibold ${addKind === 'merkinta' ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Merkintä (muistiin)</button>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={addText} onChange={(e) => setAddText(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') submitAdd() }}
                    placeholder={addKind === 'tehtava' ? 'esim. Vie liimaa Valoon' : 'esim. Palaveri Kivi Oy klo 9'}
                    className="flex-1 px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <button onClick={submitAdd} disabled={!addText.trim()} aria-label="Tallenna"
                    className="px-3.5 rounded-xl bg-gray-800 border border-gray-700 text-amber-400 disabled:opacity-40"><Check className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </section>
        )
      })}

      {/* Päiväämättömät tehtävät */}
      {undatedTehtavat.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ilman päivää</p>
          {undatedTehtavat.map((t) => (
            <p key={t.id} className="text-sm py-0.5 flex items-center justify-between gap-2">
              <button onClick={() => onToggleTehtava(t)} className="flex items-center gap-2 min-w-0 text-left">
                <Square className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="truncate">{t.teksti}</span>
              </button>
              <button onClick={() => onDeleteTehtava(t.id)} aria-label="Poista tehtävä" className="p-1 text-gray-700 hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </p>
          ))}
        </section>
      )}

      {/* Työmaat pikalinkkeinä paneeliin */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {shownSites.map((s) => {
          const red = materials.some((m) => m.worksite_id === s.id && m.halytysraja != null && m.balance <= m.halytysraja)
          return (
            <button key={s.id} onClick={() => onOpenSite(s)}
              className={`text-xs font-semibold px-3 py-2 rounded-xl border ${red ? 'bg-red-500/10 border-red-800 text-red-300' : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'}`}>
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
