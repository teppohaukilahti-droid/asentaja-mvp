// Offline-jono: kirjaus tallentuu puhelimeen kun verkkoa ei ole,
// ja lähtee automaattisesti kun yhteys palaa (tai kun äppi avataan verkossa).
import { supabase } from './supabase'

const KEY = 'profloor_outbox_v1'

type OutboxItem = { table: string; row: Record<string, unknown>; queuedAt: string }

function readOutbox(): OutboxItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function writeOutbox(items: OutboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function outboxCount(): number {
  return readOutbox().length
}

/** Yritä tallentaa heti; jos ei onnistu (ei verkkoa), laita jonoon. Palauttaa 'saved' | 'queued'. */
export async function insertOrQueue(table: string, row: Record<string, unknown>): Promise<'saved' | 'queued'> {
  if (navigator.onLine) {
    const { error } = await supabase.from(table).insert(row)
    if (!error) return 'saved'
    // Verkkovirhe → jonoon; datavirhe (esim. RLS) → myös jonoon on väärin, mutta
    // emme voi erottaa niitä luotettavasti offline-tilanteessa. Merkitään jonoon.
  }
  const items = readOutbox()
  items.push({ table, row, queuedAt: new Date().toISOString() })
  writeOutbox(items)
  return 'queued'
}

/** Lähetä jonossa olevat. Palauttaa lähetettyjen määrän. Epäonnistuneet jäävät jonoon. */
export async function flushOutbox(): Promise<number> {
  const items = readOutbox()
  if (items.length === 0 || !navigator.onLine) return 0
  const remaining: OutboxItem[] = []
  let sent = 0
  for (const item of items) {
    const { error } = await supabase.from(item.table).insert(item.row)
    if (error) remaining.push(item)
    else sent++
  }
  writeOutbox(remaining)
  return sent
}

/** Kytke automaattinen lähetys: heti, verkon palatessa ja parin minuutin välein. */
export function startOutboxAutoFlush(onFlushed?: (sent: number) => void) {
  const run = async () => {
    const sent = await flushOutbox()
    if (sent > 0 && onFlushed) onFlushed(sent)
  }
  run()
  window.addEventListener('online', run)
  const iv = setInterval(run, 120000)
  return () => { window.removeEventListener('online', run); clearInterval(iv) }
}
