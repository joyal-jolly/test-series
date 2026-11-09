/**
 * Cloudflare Workers Entry Point
 *
 * This entrypoint is used when deploying the backend to Cloudflare Workers.
 * It binds the native Cloudflare R2 bucket (env.R2_BUCKET) into storageService.
 */

import { storageService } from './storage.js';

export default {
  async fetch(request, env, ctx) {
    // 1. Bind native R2 bucket if available
    if (env.R2_BUCKET) {
      storageService.setWorkersBinding(env.R2_BUCKET);
    }

    // Populate process.env fallbacks from Worker env vars if running in nodejs_compat
    if (typeof process !== 'undefined' && process.env) {
      if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.JWT_SECRET) process.env.JWT_SECRET = env.JWT_SECRET;
    }

    const url = new URL(request.url);

    // Direct R2 file retrieval route handler for Cloudflare Workers runtime
    if (url.pathname.startsWith('/api/files/') || url.pathname.startsWith('/uploads/')) {
      const isPaper = url.pathname.includes('/papers/');
      const isAnswer = url.pathname.includes('/answers/');
      const keyPart = url.pathname.split('/').slice(-1)[0];

      if (keyPart) {
        const prefix = isPaper ? 'papers/' : isAnswer ? 'answers/' : '';
        const key = `${prefix}${keyPart}`;

        const rangeHeader = request.headers.get('Range');
        const file = await storageService.getFile(key, { range: rangeHeader });

        if (file) {
          const headers = new Headers();
          headers.set('Content-Type', file.contentType || 'application/pdf');
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'private, max-age=3600');
          if (file.contentLength) headers.set('Content-Length', String(file.contentLength));
          if (file.contentRange) headers.set('Content-Range', file.contentRange);

          return new Response(file.stream || file.buffer, {
            status: file.contentRange ? 206 : 200,
            headers,
          });
        }
      }
    }

    // Health check
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({ ok: true, runtime: 'Cloudflare Workers', r2Bound: Boolean(env.R2_BUCKET) }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Mentaura CA Test Series API on Cloudflare Workers',
        path: url.pathname,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
