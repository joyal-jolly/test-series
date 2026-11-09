/**
 * Cloudflare Workers entry point.
 *
 * Runs the shared Express app (app.js) using Cloudflare's Node HTTP server
 * support. The R2 bucket binding is stored on the app so route handlers can
 * use `req.app.get('r2')`.
 *
 * Secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ...) are
 * available on process.env thanks to the `nodejs_compat_populate_process_env`
 * compatibility flag in wrangler.jsonc.
 */

import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import app from './app.js';

for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string') process.env[key] = value;
}
// Make the R2 bucket available to every route: req.app.get('r2')
app.set('r2', env.R2_BUCKET);

// Start the Express app on a virtual port inside the Worker.
// (Health check is already handled by /api/health in app.js.)
app.listen(8787);

export default httpServerHandler({ port: 8787 });
