import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { startOutboxAutoFlush, outboxCount } from './lib/offline'
import LoginPage from './pages/LoginPage'
import OdottaaPage from './pages/OdottaaPage'

// Sivut ladataan omina paketteinaan → aloituspaketti pysyy pienenä ja äppi
// aukeaa nopeasti hitaallakin yhteydellä. Heti avauksen jälkeen kaikki sivut
// esiladataan taustalla (ks. warmup alla), jotta offline-käyttö toimii:
// service worker välimuistittaa jokaisen paketin kun se on kerran haettu.
const pageLoaders = {
  AsentajaHome: () => import('./pages/AsentajaHome'),
  WorksitePage: () => import('./pages/WorksitePage'),
  LaskinPage: () => import('./pages/LaskinPage'),
  RaporttiPage: () => import('./pages/RaporttiPage'),
  MittausPage: () => import('./pages/MittausPage'),
  HyvaksyPage: () => import('./pages/HyvaksyPage'),
  VarmennaPage: () => import('./pages/VarmennaPage'),
  TyonjohtajaHome: () => import('./pages/TyonjohtajaHome'),
  VarastoHome: () => import('./pages/VarastoHome'),
  JaaPage: () => import('./pages/JaaPage'),
  TyokalutPage: () => import('./pages/TyokalutPage'),
  VarastohakuPage: () => import('./pages/VarastohakuPage'),
  ArkistoPage: () => import('./pages/ArkistoPage'),
  TyomaakansioPage: () => import('./pages/TyomaakansioPage'),
  JohtajaHome: () => import('./pages/JohtajaHome'),
  AjopaivakirjaPage: () => import('./pages/AjopaivakirjaPage'),
  KalenteriPage: () => import('./pages/KalenteriPage'),
  PalkkakatkoPage: () => import('./pages/PalkkakatkoPage'),
  IlmoituksetPage: () => import('./pages/IlmoituksetPage'),
  PaivakirjausPage: () => import('./pages/PaivakirjausPage'),
  KayttajatPage: () => import('./pages/KayttajatPage'),
  LisaaPage: () => import('./pages/LisaaPage'),
  AsetuksetPage: () => import('./pages/AsetuksetPage'),
}

const AsentajaHome = lazy(pageLoaders.AsentajaHome)
const WorksitePage = lazy(pageLoaders.WorksitePage)
const LaskinPage = lazy(pageLoaders.LaskinPage)
const RaporttiPage = lazy(pageLoaders.RaporttiPage)
const MittausPage = lazy(pageLoaders.MittausPage)
const HyvaksyPage = lazy(pageLoaders.HyvaksyPage)
const VarmennaPage = lazy(pageLoaders.VarmennaPage)
const TyonjohtajaHome = lazy(pageLoaders.TyonjohtajaHome)
const VarastoHome = lazy(pageLoaders.VarastoHome)
const JaaPage = lazy(pageLoaders.JaaPage)
const TyokalutPage = lazy(pageLoaders.TyokalutPage)
const VarastohakuPage = lazy(pageLoaders.VarastohakuPage)
const ArkistoPage = lazy(pageLoaders.ArkistoPage)
const TyomaakansioPage = lazy(pageLoaders.TyomaakansioPage)
const JohtajaHome = lazy(pageLoaders.JohtajaHome)
const AjopaivakirjaPage = lazy(pageLoaders.AjopaivakirjaPage)
const KalenteriPage = lazy(pageLoaders.KalenteriPage)
const PalkkakatkoPage = lazy(pageLoaders.PalkkakatkoPage)
const IlmoituksetPage = lazy(pageLoaders.IlmoituksetPage)
const PaivakirjausPage = lazy(pageLoaders.PaivakirjausPage)
const KayttajatPage = lazy(pageLoaders.KayttajatPage)
const LisaaPage = lazy(pageLoaders.LisaaPage)
const AsetuksetPage = lazy(pageLoaders.AsetuksetPage)

// Offline-ilmaisin + jonossa olevien kirjausten automaattilähetys
function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [queued, setQueued] = useState(outboxCount())

  useEffect(() => {
    const up = () => { setOnline(navigator.onLine); setQueued(outboxCount()) }
    window.addEventListener('online', up)
    window.addEventListener('offline', up)
    const iv = setInterval(() => setQueued(outboxCount()), 10000)
    const stop = startOutboxAutoFlush(() => setQueued(outboxCount()))
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); clearInterval(iv); stop() }
  }, [])

  if (online && queued === 0) return null
  return (
    <div className={`fixed top-0 inset-x-0 z-50 text-center text-xs font-semibold py-1.5 ${online ? 'bg-blue-600 text-white' : 'bg-amber-500 text-gray-950'}`}>
      {online
        ? `Lähetetään ${queued} jonossa olevaa kirjausta…`
        : <span className="inline-flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5" /> Ei verkkoa — kirjaukset tallentuvat ja lähtevät kun yhteys palaa{queued > 0 ? ` (${queued} jonossa)` : ''}</span>}
    </div>
  )
}

function Loader() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-base animate-pulse">Ladataan…</p>
    </div>
  )
}

function AppContent() {
  const { user, profile, loading, signOut } = useAuth()

  // Esilataus: haetaan kaikki sivupaketit taustalla pian avauksen jälkeen,
  // jotta ne ovat service workerin välimuistissa offline-käyttöä varten.
  useEffect(() => {
    if (!navigator.onLine) return
    const t = setTimeout(() => {
      Object.values(pageLoaders).forEach((load) => { load().catch(() => { /* verkko katkesi — yritetään seuraavalla käynnistyksellä */ }) })
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  // Julkiset sivut: mestarin hyväksyntä ja aitousvarmennus toimivat ilman kirjautumista
  const path = window.location.pathname
  if (path === '/hyvaksy') return <HyvaksyPage />
  if (path === '/varmenna') return <VarmennaPage />

  if (loading) {
    return <Loader />
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

  // Hyväksyntäportti: uusi tili ei pääse mihinkään ennen työnjohdon hyväksyntää
  if (!profile.approved) {
    return <OdottaaPage />
  }

  if (profile.role === 'asentaja') {
    return (
      <Routes>
        <Route path="/" element={<AsentajaHome />} />
        <Route path="/tyomaa/:id" element={<WorksitePage />} />
        <Route path="/laskin" element={<LaskinPage />} />
        <Route path="/raportti" element={<RaporttiPage />} />
        <Route path="/mittaus" element={<MittausPage />} />
        <Route path="/jaa" element={<JaaPage />} />
        <Route path="/tyokalut" element={<TyokalutPage />} />
        <Route path="/varastohaku" element={<VarastohakuPage />} />
        <Route path="/ajot" element={<AjopaivakirjaPage />} />
        <Route path="/arkisto" element={<ArkistoPage />} />
        <Route path="/ilmoitukset" element={<IlmoituksetPage />} />
        <Route path="/paivakirjaus" element={<PaivakirjausPage />} />
        <Route path="/kansio" element={<TyomaakansioPage />} />
        <Route path="/lisaa" element={<LisaaPage />} />
        <Route path="/asetukset" element={<AsetuksetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'tyonjohtaja' || profile.role === 'johtaja') {
    return (
      <Routes>
        <Route path="/" element={profile.role === 'johtaja' ? <JohtajaHome /> : <TyonjohtajaHome />} />
        <Route path="/tyonjohto" element={<TyonjohtajaHome />} />
        <Route path="/tyomaa/:id" element={<WorksitePage />} />
        <Route path="/laskin" element={<LaskinPage />} />
        <Route path="/raportti" element={<RaporttiPage />} />
        <Route path="/mittaus" element={<MittausPage />} />
        <Route path="/jaa" element={<JaaPage />} />
        <Route path="/tyokalut" element={<TyokalutPage />} />
        <Route path="/varastohaku" element={<VarastohakuPage />} />
        <Route path="/ajot" element={<AjopaivakirjaPage />} />
        <Route path="/arkisto" element={<ArkistoPage />} />
        <Route path="/ilmoitukset" element={<IlmoituksetPage />} />
        <Route path="/paivakirjaus" element={<PaivakirjausPage />} />
        <Route path="/kansio" element={<TyomaakansioPage />} />
        <Route path="/kalenteri" element={<KalenteriPage />} />
        <Route path="/palkkakatko" element={<PalkkakatkoPage />} />
        <Route path="/kayttajat" element={<KayttajatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'varasto') {
    return (
      <Routes>
        <Route path="/" element={<VarastoHome />} />
        <Route path="/tyokalut" element={<TyokalutPage />} />
        <Route path="/varastohaku" element={<VarastohakuPage />} />
        <Route path="/ajot" element={<AjopaivakirjaPage />} />
        <Route path="/arkisto" element={<ArkistoPage />} />
        <Route path="/ilmoitukset" element={<IlmoituksetPage />} />
        <Route path="/paivakirjaus" element={<PaivakirjausPage />} />
        <Route path="/kansio" element={<TyomaakansioPage />} />
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
        <OfflineBanner />
        <Suspense fallback={<Loader />}>
          <AppContent />
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
