// Web Push -tilaus: laite tilaa ilmoitukset ja tilaus tallennetaan kantaan.
// Lähetys tapahtuu palvelimella (Supabase Edge Function) — toimii vaikka äppi on kiinni.
// iPhone-huomio: iOS vaatii että äppi on asennettu kotinäytölle ennen kuin push toimii.
import { supabase } from './supabase'

export const VAPID_PUBLIC = 'BAhddeDrnHVpYss2QZSrwoi8wmEuE2YGJtn_EPWJPHg2vBPRIC8jEOubujBY86U1VpTPDCifPNcOHp4qxwMR3Dw'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Tilaa push + tallenna kantaan. Palauttaa endpointin tai null jos estetty. */
export async function subscribePush(userId: string, userName: string, orgId: string): Promise<string | null> {
  if (!pushSupported()) return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
  })
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    organization_id: orgId, user_id: userId, user_name: userName,
    endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) return null
  return sub.endpoint
}

export async function unsubscribePush(): Promise<void> {
  const sub = await getCurrentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
