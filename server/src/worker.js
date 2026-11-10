/**
 * Cloudflare Workers entry point.
 *
 * Runs the shared Express app (app.js) using Cloudflare's Node HTTP server
 * support. The R2 bucket binding is stored on the app so route handlers can
 * use `req.app.get('r2')`.
 */

import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import app from './app.js';

// Copy string environment variables and secrets to process.env
try {
  if (env && typeof env === 'object') {
    for (const key of Object.keys(env)) {
      const value = env[key];
      if (typeof value === 'string') {
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.warn('[Worker] Could not enumerate env properties:', e);
}

// Make the R2 bucket and Worker env available to routes
if (env?.R2_BUCKET) {
  app.set('r2', env.R2_BUCKET);
}
app.set('cfEnv', env);

// Start the Express app and bind the server to httpServerHandler
const server = app.listen(8787);

export default httpServerHandler(server);
