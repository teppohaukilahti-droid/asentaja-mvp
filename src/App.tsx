import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import AsentajaHome from './pages/AsentajaHome'
import WorksitePage from './pages/WorksitePage'
import LaskinPage from './pages/LaskinPage'
import RaporttiPage from './pages/RaporttiPage'
import MittausPage from './pages/MittausPage'
import HyvaksyPage from './pages/HyvaksyPage'
import VarmennaPage from './pages/VarmennaPage'
import TyonjohtajaHome from './pages/TyonjohtajaHome'
import VarastoHome from './pages/VarastoHome'

function AppContent() {
  const { user, profile, loading, signOut } = useAuth()

  // Julkiset sivut: mestarin hyväksyntä ja aitousvarmennus toimivat ilman kirjautumista
  const path = window.location.pathname
  if (path === '/hyvaksy') return <HyvaksyPage />
  if (path === '/varmenna') return <VarmennaPage />

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-base animate-pulse">Ladataan…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-base mb-4">
            Profiilia ei löytynyt. Ota yhteyttä työnjohtoon.
          </p>
          <button
            onClick={signOut}
            className="px-5 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
          >
            Kirjaudu ulos
          </button>
        </div>
      </div>
    )
  }

  if (profile.role === 'asentaja') {
    return (
      <Routes>
        <Route path="/" element={<AsentajaHome />} />
        <Route path="/tyomaa/:id" element={<WorksitePage />} />
        <Route path="/laskin" element={<LaskinPage />} />
        <Route path="/raportti" element={<RaporttiPage />} />
        <Route path="/mittaus" element={<MittausPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'tyonjohtaja' || profile.role === 'johtaja') {
    return (
      <Routes>
        <Route path="/" element={<TyonjohtajaHome />} />
        <Route path="/tyomaa/:id" element={<WorksitePage />} />
        <Route path="/laskin" element={<LaskinPage />} />
        <Route path="/raportti" element={<RaporttiPage />} />
        <Route path="/mittaus" element={<MittausPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'varasto') {
    return (
      <Routes>
        <Route path="/" element={<VarastoHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-white text-base mb-4">
          {`Rooli "${profile.role}" ei ole vielä tuettu`}
        </p>
        <button
          onClick={signOut}
          className="px-5 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
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
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}
