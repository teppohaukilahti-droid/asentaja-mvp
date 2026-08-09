import { createClient } from '@supabase/supabase-js'

// Julkiset selainarvot: anon-avain on tarkoitettu selaimessa käytettäväksi,
// pääsy dataan rajataan Row Level Security -politiikoilla kannassa.
const FALLBACK_URL = 'https://ofkmmgcranlaigjsrgyv.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ma21tZ2NyYW5sYWlnanNyZ3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTE2NjAsImV4cCI6MjA5MzU4NzY2MH0.jegDYsFMDpUzSPftE4RGjXztHuOkhPtfQJloUIdSVck'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
