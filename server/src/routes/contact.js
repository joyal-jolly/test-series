import { Router } from 'express';
import { optionalAuth } from '../middleware.js';
import { sendContactEmails } from '../email.js';

const router = Router();

router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { name, email, message, subject } = req.body || {};
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubject = subject?.trim() || 'General enquiry';
    const cleanMessage = message.trim();

    // Dispatch emails (admin notification to mentauraca.testseries@gmail.com + sender acknowledgment)
    await sendContactEmails({
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
    });

    res.status(200).json({
      message: 'Thanks! Your message has been sent. We will get back to you soon.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
