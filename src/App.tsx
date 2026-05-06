import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import AsentajaHome from './pages/AsentajaHome'

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

  if (profile.role === 'asentaja') {
    return <AsentajaHome />
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-white text-lg mb-4">
          {profile.role === 'tyonjohtaja'
            ? 'Työnjohtajan näkymä rakentuu seuraavaksi'
            : `Rooli ${profile.role} ei vielä tuettu`}
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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
