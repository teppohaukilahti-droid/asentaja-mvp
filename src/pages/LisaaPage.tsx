// "Lisää"-näkymä: kaikki harvemmin tarvittavat toiminnot yhdessä listassa.
// Etusivu pysyy väljänä kun nämä ovat täällä — alapalkin neljäs välilehti.
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, UserRound, Calculator, FileText, PackageOpen, Car, Archive, Bell, CalendarClock, LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AlaNav from '../components/AlaNav'
import { OMA_KAYTTO } from '../lib/tila'

// Omassa käytössä näkyvät vain asentajan omat työkalut; loput palaavat kun OMA_KAYTTO = false
const PIILOSSA_OMASSA_KAYTOSSA = ['/laskin', '/varastohaku', '/ajot', '/arkisto', '/ilmoitukset', '/?vapautus=1']

const KAIKKI = [
  { to: '/asetukset', label: 'Omat tiedot ja työpari', desc: 'Nimi, henkilönumero ja tuntipalkka tililapulle', icon: UserRound },
  { to: '/laskin', label: 'Laskin+', desc: 'Neliöt, jiirit, materiaalimenekit', icon: Calculator },
  { to: '/raportti', label: 'Raportti & tililappu', desc: 'Tililaput ja tuntierittelyt PDF:nä', icon: FileText },
  { to: '/varastohaku', label: 'Varastohaku', desc: 'Hyllyn QR-koodilla materiaalin otto', icon: PackageOpen },
  { to: '/ajot', label: 'Ajopäiväkirja', desc: 'Työajot ja kilometrit', icon: Car },
  { to: '/arkisto', label: 'Arkisto', desc: 'Haku: pöytäkirjat, materiaalit, kuvat', icon: Archive },
  { to: '/ilmoitukset', label: 'Ilmoitukset', desc: 'Push-ilmoitusten asetukset ja historia', icon: Bell },
  { to: '/?vapautus=1', label: 'Ilmoita vapautuminen', desc: 'Koska vapaudut työmaalta — työnjohdon kalenteriin', icon: CalendarClock },
]
const ITEMS = OMA_KAYTTO ? KAIKKI.filter((i) => !PIILOSSA_OMASSA_KAYTOSSA.includes(i.to)) : KAIKKI

export default function LisaaPage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/')} aria-label="Takaisin" className="p-3 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Lisää</h1>
          <p className="text-[11px] text-gray-500 -mt-0.5">{profile?.full_name}</p>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-md mx-auto space-y-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.to} onClick={() => navigate(item.to)}
              className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 hover:border-gray-700 transition-colors text-left min-h-[56px]">
              <Icon className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block text-xs text-gray-500 truncate">{item.desc}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
            </button>
          )
        })}

        <button onClick={signOut}
          className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 hover:border-gray-700 transition-colors text-left min-h-[56px] mt-4">
          <LogOut className="w-5 h-5 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-400">Kirjaudu ulos</span>
        </button>
      </main>

      <AlaNav />
    </div>
  )
}
