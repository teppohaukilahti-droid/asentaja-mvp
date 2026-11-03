// Asentajan alapalkki: neljä pysyvää päävalintaa peukalon ulottuvilla.
// Näytetään vain päätason näkymissä — syvemmillä sivuilla (työmaa, mittaus…)
// oma yläpalkin paluunuoli riittää eikä alapalkki peitä toimintonappeja.
import { useNavigate, useLocation } from 'react-router-dom'
import { Building2, PenLine, Wrench, Menu, Calculator } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OMA_KAYTTO } from '../lib/tila'

const TABS = [
  { path: '/', label: 'Työmaat', icon: Building2 },
  { path: '/paivakirjaus', label: 'Kirjaa', icon: PenLine },
  // Omassa käytössä työkaluvarasto on piilossa — tilalla laskin
  OMA_KAYTTO ? { path: '/laskin', label: 'Laskin', icon: Calculator } : { path: '/tyokalut', label: 'Työkalut', icon: Wrench },
  { path: '/lisaa', label: 'Lisää', icon: Menu },
]

export default function AlaNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { profile } = useAuth()

  // Vain asentajalle ja vain päätason sivuilla — muualla palkki jää pois tieltä
  if (profile?.role !== 'asentaja') return null
  if (!TABS.some((t) => t.path === pathname)) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-gray-900/95 backdrop-blur border-t border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = pathname === t.path
          return (
            <button key={t.path} onClick={() => navigate(t.path)} aria-label={t.label}
              className={`flex flex-col items-center gap-1 py-2.5 min-h-[52px] transition-colors ${active ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold leading-none">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
