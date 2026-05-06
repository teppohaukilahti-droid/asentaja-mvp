import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Worksite = {
  id: string
  name: string
  address: string | null
  client_company: string | null
  status: string
}

export default function AsentajaHome() {
  const [worksites, setWorksites] = useState<Worksite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { profile, signOut } = useAuth()

  useEffect(() => {
    async function fetchWorksites() {
      const { data, error } = await supabase
        .from('worksites')
        .select('id, name, address, client_company, status')
        .eq('status', 'active')
        .order('name')

      if (error) {
        setError(error.message)
      } else {
        setWorksites(data)
      }
      setLoading(false)
    }

    fetchWorksites()
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">ProFloor</h1>
        <div className="text-right">
          <p className="text-sm text-gray-400">{profile?.full_name}</p>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Kirjaudu ulos
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">
            Työmaita: <span className="text-white font-semibold">{worksites.length}</span>
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Työmaat</h2>

          {loading && (
            <p className="text-gray-400 text-sm">Ladataan työmaita...</p>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && worksites.length === 0 && (
            <p className="text-gray-500 text-sm">Ei aktiivisia työmaita</p>
          )}

          {!loading && !error && worksites.length > 0 && (
            <div className="space-y-3">
              {worksites.map((site) => (
                <div
                  key={site.id}
                  className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 hover:ring-1 hover:ring-gray-600 active:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{site.name}</p>
                      {site.address && (
                        <p className="text-sm text-gray-400 mt-1">{site.address}</p>
                      )}
                      {site.client_company && (
                        <p className="text-sm text-gray-500 mt-0.5">{site.client_company}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                      Aktiivinen
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
