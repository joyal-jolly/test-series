import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

if (args[0] === '-v' || args[0] === '--version') {
  console.log('10.8.2');
  process.exit(0);
}

// Check if running root "npm run dev"
const isDev = args.includes('dev') && !args.includes('--prefix');

if (isDev) {
  console.log('\x1b[36m%s\x1b[0m', '>>> Starting Mentaura CA Assessment Full-Stack Development Environment...');
  console.log('\x1b[34m[server]\x1b[0m Starting Express API on http://localhost:4000...');
  console.log('\x1b[32m[client]\x1b[0m Starting Vite Dev Server on http://localhost:5173...\n');

  // Start Server
  const server = spawn(process.execPath, ['--watch-path=server/src', 'server/src/index.js'], {
    cwd: __dirname,
    env: process.env,
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => {
    process.stdout.write(`\x1b[34m[server]\x1b[0m ${d.toString()}`);
  });
  server.stderr.on('data', (d) => {
    process.stderr.write(`\x1b[34m[server]\x1b[0m ${d.toString()}`);
  });

  // Start Client (Vite)
  const viteBin = path.join(__dirname, 'client/node_modules/vite/bin/vite.js');
  const client = spawn(process.execPath, [viteBin], {
    cwd: path.join(__dirname, 'client'),
    env: process.env,
    stdio: 'pipe',
  });

  client.stdout.on('data', (d) => {
    process.stdout.write(`\x1b[32m[client]\x1b[0m ${d.toString()}`);
  });
  client.stderr.on('data', (d) => {
    process.stderr.write(`\x1b[32m[client]\x1b[0m ${d.toString()}`);
  });

  const cleanup = () => {
    try { server.kill(); } catch {}
    try { client.kill(); } catch {}
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
} else {
  // Handle other commands
  console.log('[runner]', args.join(' '));
}
