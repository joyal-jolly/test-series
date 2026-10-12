import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { testSupabaseConnection } from './supabase.js';
import authRoutes from './routes/auth.js';
import papersRoutes from './routes/papers.js';
import studentRoutes from './routes/student.js';
import adminRoutes from './routes/admin.js';
import reviewerRoutes from './routes/reviewer.js';
import contactRoutes from './routes/contact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const UPLOADS = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(path.join(UPLOADS, 'answers'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS, 'papers'), { recursive: true });

async function initializeDatabase() {
  const conn = await testSupabaseConnection();
  if (conn.connected) {
    console.log(`[Database] Connected to Supabase PostgreSQL successfully! (Users: ${conn.userCount})`);
  } else {
    console.error(`[Database] FATAL: Supabase connection failed — ${conn.error}`);
    process.exit(1);
  }
}

await initializeDatabase();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Mentaura CA Assessment API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/papers', papersRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviewer', reviewerRoutes);
app.use('/api/contact', contactRoutes);

const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
