// Odotussivu: tili on luotu mutta työnjohto ei ole vielä hyväksynyt sitä.
// Hyväksymätön käyttäjä ei näe mitään organisaation dataa (RLS estää kaiken).
import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function OdottaaPage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <img src="/icon-192.png" alt="FloorData" className="w-20 h-20 rounded-xl mb-4 mx-auto" />
        <h1 className="text-2xl font-bold text-white mb-2">Hei{profile?.full_name ? ` ${profile.full_name.split(' ')[0]}` : ''}!</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <Clock className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-gray-300 text-sm leading-relaxed">
            Tilisi on luotu ja <b>odottaa työnjohdon hyväksyntää</b>.
            Saat käyttöoikeudet heti kun tilisi on hyväksytty — kokeile sen jälkeen kirjautua uudelleen.
          </p>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()}
              className="flex-1 py-3 bg-amber-500 text-gray-950 font-semibold rounded-xl flex items-center justify-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Tarkista uudelleen
            </button>
            <button onClick={signOut}
              className="flex-1 py-3 bg-gray-800 border border-gray-700 text-gray-300 font-semibold rounded-xl flex items-center justify-center gap-2 text-sm">
              <LogOut className="w-4 h-4" /> Kirjaudu ulos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
