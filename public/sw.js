// FloorData service worker: kotinäyttöasennus + offline-käynnistys.
// - Sovelluksen runko (index.html, js, css, kuvat) välimuistitetaan → äppi aukeaa ilman verkkoa
// - Supabase-kutsuja EI välimuistiteta (data on aina tuoretta; offline-jono hoitaa kirjaukset)
// - index.html haetaan aina ensin verkosta → uudet versiot käyttöön heti deployn jälkeen
const CACHE = 'profloor-v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

// Push-ilmoitukset: kiiretarpeet ja ajastettu päiväsaldo
self.addEventListener('push', (event) => {
  let data = { title: 'FloorData', body: '' }
  try { data = event.data.json() } catch { /* pidä oletus */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'FloorData', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'fi',
      data: { url: data.url || '/' },
    })
  )
})

// Napautus avaa ilmoituksen osoittaman näkymän (esim. päiväkirjaus)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c && 'navigate' in c)
      if (open) { open.navigate(url); return open.focus() }
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase yms. ohi

  // Navigointi (sivun avaus): verkko ensin, offline-tilassa välimuistista
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/__index', copy))
          return res
        })
        .catch(() => caches.match('/__index'))
    )
    return
  }

  // Buildatut assetit (hash nimessä): välimuisti ensin, ne eivät koskaan muutu
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      }))
    )
    return
  }

  // Muu staattinen (ikonit, manifest, pohjat): välimuistista heti, päivitys taustalla
  event.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      }).catch(() => hit)
      return hit ?? refresh
    })
  )
})
