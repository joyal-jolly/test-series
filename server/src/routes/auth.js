import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { hashPassword, signToken, verifyPassword } from '../auth.js';
import { dbService } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile: user.profile || {},
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, caLevel, batch, phone } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalized = email.trim().toLowerCase();
    const existing = await dbService.getUserByEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const now = new Date().toISOString();
    const user = {
      id: uuid(),
      name: name.trim(),
      email: normalized,
      passwordHash: hashPassword(password),
      role: 'student',
      status: 'active',
      profile: {
        studentId: `CA-${Date.now().toString().slice(-6)}`,
        caLevel: caLevel || 'Intermediate',
        batch: batch || '',
        phone: phone || '',
      },
      createdAt: now,
      updatedAt: now,
    };

    await dbService.createUser(user);

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await dbService.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await dbService.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
