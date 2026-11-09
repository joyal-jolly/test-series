/**
 * Cloudflare Workers entry point.
 *
 * The R2 bucket binding (env.R2_BUCKET) is stored on the Express app instance
 * so every route handler can retrieve it with `req.app.get('r2')`.
 */

import app from './app.js';          // shared Express app (see index.js / app.js split)
import { getFile, normalizeStorageKey } from './storage.js';

export default {
  async fetch(request, env, _ctx) {
    // ── Inject R2 bucket binding into the Express app ──────────────────────
    if (env.R2_BUCKET) {
      app.set('r2', env.R2_BUCKET);
    }

    // ── Inject Supabase / JWT secrets from Worker env ───────────────────────
    if (typeof process !== 'undefined' && process.env) {
      if (env.SUPABASE_URL)              process.env.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.JWT_SECRET)                process.env.JWT_SECRET = env.JWT_SECRET;
    }

    const url = new URL(request.url);

    // ── Health check ────────────────────────────────────────────────────────
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({ ok: true, runtime: 'Cloudflare Workers', r2Bound: Boolean(env.R2_BUCKET) }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Delegate to Express ─────────────────────────────────────────────────
    return new Promise((resolve) => {
      const req = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      });

      // Minimal Node-compatible shim – Workers adapter handles the bridge
      app.handle(req, {
        end: (body) => resolve(new Response(body)),
        setHeader: () => {},
        getHeader: () => null,
      });
    });
  },
};
