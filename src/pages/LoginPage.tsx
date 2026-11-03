import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function suomennaVirhe(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Väärä sähköposti tai salasana.'
  if (/email not confirmed/i.test(message)) return 'Sähköpostia ei ole vahvistettu. Katso postilaatikkosi.'
  if (/user already registered|already been registered/i.test(message)) return 'Tällä sähköpostilla on jo tili. Kirjaudu sisään.'
  if (/password should be at least/i.test(message)) return 'Salasanan pitää olla vähintään 6 merkkiä.'
  if (/invalid email|unable to validate email/i.test(message)) return 'Tarkista sähköpostiosoite.'
  if (/network|fetch/i.test(message)) return 'Yhteysvirhe. Tarkista verkkoyhteys ja yritä uudelleen.'
  return 'Toiminto epäonnistui. Yritä uudelleen.'
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const { signIn, signUp } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    if (mode === 'login') {
      const { error } = await signIn(email.trim(), password)
      if (error) setError(suomennaVirhe(error.message))
    } else {
      if (fullName.trim().length < 3) {
        setError('Kirjoita koko nimesi — se näkyy kirjauksissa ja pöytäkirjoissa.')
        setLoading(false)
        return
      }
      const { error, needsConfirm } = await signUp(email.trim(), password, fullName.trim())
      if (error) setError(suomennaVirhe(error.message))
      else if (needsConfirm) {
        setInfo('Tili luotu! Vahvista sähköpostisi postilaatikkoosi tulleesta linkistä, ja kirjaudu sitten sisään.')
        setMode('login')
        setPassword('')
      }
      // Jos vahvistusta ei vaadita, sessio syntyy heti ja sovellus avautuu itsestään
    }
    setLoading(false)
  }

  const inputCls = 'w-full px-4 py-3.5 text-base bg-gray-800 text-white border border-gray-700 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="w-full">
            <img src="/mattomies-logo.webp" alt="Mattomies Äppi" className="w-full max-w-sm mx-auto" />
          </h1>
          <p className="text-gray-400 text-sm mt-3">Mattoasentajan työkalu</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-800">
            <button type="button" onClick={() => { setMode('login'); setError(null) }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === 'login' ? 'text-amber-400 border-b-2 border-amber-500 bg-gray-900' : 'text-gray-500 bg-gray-950/40'}`}>
              Kirjaudu sisään
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(null); setInfo(null) }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === 'register' ? 'text-amber-400 border-b-2 border-amber-500 bg-gray-900' : 'text-gray-500 bg-gray-950/40'}`}>
              Luo tili
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {mode === 'register' && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Koko nimi
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Matti Meikäläinen"
                  className={inputCls}
                />
              </div>
            )}

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
                className={inputCls}
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
              {mode === 'register' && (
                <p className="text-xs text-gray-500 mt-1.5">Vähintään 6 merkkiä.</p>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center" role="alert">{error}</p>
            )}
            {info && (
              <p className="text-green-400 text-sm text-center flex items-center justify-center gap-1.5" role="status">
                <Check className="w-4 h-4 shrink-0" /> {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-amber-500 text-gray-950 text-base font-semibold rounded-xl hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? (mode === 'login' ? 'Kirjaudutaan…' : 'Luodaan tiliä…')
                : (mode === 'login' ? 'Kirjaudu sisään' : 'Luo tili')}
            </button>

            {mode === 'register' && (
              <p className="text-xs text-gray-500 text-center">
                Uusi tili odottaa työnjohdon hyväksyntää ennen käyttöä.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
