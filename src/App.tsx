import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'

function AppContent() {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-lg">Ladataan...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            Profiilia ei löytynyt. Ota yhteyttä ylläpitäjään.
          </p>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Kirjaudu ulos
          </button>
        </div>
      </div>
    )
  }

  const roleLabel =
    profile.role === 'asentaja'
      ? 'asentajana'
      : profile.role === 'tyonjohtaja'
        ? 'työnjohtajana'
        : null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">
          <span className="text-blue-500">Asentaja</span> MVP
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{profile.full_name}</span>
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-sm bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Kirjaudu ulos
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-20">
        <p className="text-2xl mb-6 text-center">
          {roleLabel
            ? `Tervetuloa, ${profile.full_name}! Olet kirjautunut sisään ${roleLabel}.`
            : `Rooli: ${profile.role}`}
        </p>
        <div className="text-sm text-gray-500 space-y-1 text-center">
          <p>Organisaatio: {profile.organization_id}</p>
          <p>Ammattiala: {profile.profession_id}</p>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
