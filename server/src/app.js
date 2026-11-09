import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import papersRoutes from './routes/papers.js';
import studentRoutes from './routes/student.js';
import adminRoutes from './routes/admin.js';
import reviewerRoutes from './routes/reviewer.js';
import contactRoutes from './routes/contact.js';
import filesRoutes from './routes/files.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/files', filesRoutes);
app.use('/uploads', filesRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Mentaura CA Assessment API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/papers', papersRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviewer', reviewerRoutes);
app.use('/api/contact', contactRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

export default app;