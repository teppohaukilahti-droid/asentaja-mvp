// Virheloki: nappaa käsittelemättömät virheet ja tallentaa ne kantaan.
// Kun pojan puhelimessa jokin kaatuu työmaalla, se näkyy app_errors-taulussa
// eikä jää "no se vaan lakkas toimimasta" -arvailuksi.
// Offline-turvallinen: virhe jonottuu ja lähtee verkon palatessa.
import { supabase } from './supabase'
import { insertOrQueue } from './offline'

let currentUser: { id: string; name: string; org: string } | null = null
const sentMessages = new Set<string>()

export function setErrorLogUser(id: string | null, name: string | null, org: string | null) {
  currentUser = id && org ? { id, name: name ?? '', org } : null
}

async function report(message: string, stack?: string) {
  // Sama virhe vain kerran per istunto — ei tulvaa
  const key = message.slice(0, 200)
  if (sentMessages.has(key) || sentMessages.size > 20) return
  sentMessages.add(key)
  try {
    await insertOrQueue('app_errors', {
      organization_id: currentUser?.org ?? null,
      user_id: currentUser?.id ?? null,
      user_name: currentUser?.name ?? null,
      message: message.slice(0, 2000),
      stack: (stack ?? '').slice(0, 4000) || null,
      url: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 300),
    })
  } catch {
    // Virheloki ei saa koskaan itse kaataa mitään
  }
}

export function initErrorLog() {
  window.addEventListener('error', (e) => {
    report(String(e.message ?? 'Tuntematon virhe'), e.error?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    report(`Unhandled rejection: ${r?.message ?? String(r)}`, r?.stack)
  })
}

/** Viimeisimmät virheet (työnjohto/johtaja). */
export async function fetchRecentErrors(limit = 50) {
  return supabase.from('app_errors')
    .select('id, user_name, message, url, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
}
