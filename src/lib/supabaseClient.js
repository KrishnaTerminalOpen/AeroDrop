import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://vajubgvrkeqxqfcibxzo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Hh7uigoNI1U5eZTP_WliHg_3rFdIZ1h';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseFrontendConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseFrontendConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
