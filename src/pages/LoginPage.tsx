import { useState } from 'react'
import { HardHat } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function suomennaVirhe(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Väärä sähköposti tai salasana.'
  if (/email not confirmed/i.test(message)) return 'Sähköpostia ei ole vahvistettu.'
  if (/network|fetch/i.test(message)) return 'Yhteysvirhe. Tarkista verkkoyhteys ja yritä uudelleen.'
  return 'Kirjautuminen epäonnistui. Yritä uudelleen.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { signIn } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await signIn(email.trim(), password)
    if (error) {
      setError(suomennaVirhe(error.message))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center mb-4">
            <HardHat className="w-9 h-9 text-gray-950" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ProFloor</h1>
          <p className="text-gray-400 text-sm mt-1">Mattoasentajan työkalu</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
              Sähköposti
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nimi@yritys.fi"
              className="w-full px-4 py-3.5 text-base bg-gray-800 text-white border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
              Salasana
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 text-base bg-gray-800 text-white border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 text-gray-950 text-base font-semibold rounded-xl hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Kirjaudutaan…' : 'Kirjaudu sisään'}
          </button>
        </form>
      </div>
    </div>
  )
}
