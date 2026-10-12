import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { dbService } from '../db.js';
import { optionalAuth } from '../middleware.js';

const router = Router();

router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { name, email, message, subject } = req.body || {};
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const entry = {
      id: uuid(),
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim() || 'General enquiry',
      message: message.trim(),
      userId: req.user?.id || null,
      createdAt: new Date().toISOString(),
    };

    await dbService.createContactMessage(entry);
    res.status(201).json({ message: 'Thanks! We will get back to you soon.', id: entry.id });
  } catch (err) {
    next(err);
  }
});

export default router;
