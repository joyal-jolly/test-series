import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket for Node.js 20 local environment if not natively present.
// In Cloudflare Workers, globalThis.WebSocket is already provided natively.
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    const wsModule = await import('ws');
    globalThis.WebSocket = wsModule.default || wsModule;
  } catch {}
}

let client = null;

function getClient() {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('[Supabase] SUPABASE_URL is missing or invalid');
  }
  if (!supabaseKey) {
    throw new Error('[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Lazy proxy: the client is only created on first use (inside a request),
// so importing this file never throws at startup.
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const c = getClient();
      const value = c[prop];
      return typeof value === 'function' ? value.bind(c) : value;
    },
  }
);

export async function testSupabaseConnection() {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) return { connected: false, error: error.message };
    return { connected: true, userCount: count ?? 0 };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}