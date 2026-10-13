import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error('[Supabase] SUPABASE_URL is missing or invalid in server/.env');
}
if (!supabaseKey) {
  throw new Error('[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing in server/.env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function testSupabaseConnection() {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { connected: false, error: error.message };
    }

    return { connected: true, userCount: count ?? 0 };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
