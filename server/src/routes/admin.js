import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import { hashPassword } from '../auth.js';
import { dbService } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QP_DIR = path.join(__dirname, '..', '..', 'uploads', 'papers');
fs.mkdirSync(QP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, QP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Only PDF files are allowed for question papers'));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [users, papers, submissions, evaluations] = await Promise.all([
      dbService.getUsers(),
      dbService.getQuestionPapers(),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    res.json({
      students: users.filter((u) => u.role === 'student').length,
      reviewers: users.filter((u) => u.role === 'reviewer').length,
      questionPapers: papers.length,
      publishedPapers: papers.filter((p) => p.status === 'published').length,
      totalSubmissions: submissions.length,
      pendingReviews: submissions.filter((s) =>
        ['submitted', 'assigned', 'under_review'].includes(s.status)
      ).length,
      completedReviews: evaluations.filter((e) => e.status === 'completed').length,
      todaysSubmissions: submissions.filter((s) => s.submittedAt?.startsWith(today)).length,
      pendingAssignments: submissions.filter((s) => s.status === 'submitted').length,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { role } = req.query;
    const users = await dbService.getUsers(role);
    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        profile: u.profile,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const { name, email, password, role, profile } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }
    if (!['student', 'reviewer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const normalized = email.trim().toLowerCase();
    const existing = await dbService.getUserByEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const now = new Date().toISOString();
    const user = {
      id: uuid(),
      name: name.trim(),
      email: normalized,
      passwordHash: hashPassword(password),
      role,
      status: 'active',
      profile: profile || {},
      createdAt: now,
      updatedAt: now,
    };

    await dbService.createUser(user);
    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        profile: user.profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'status must be active or inactive' });
    }

    const updated = await dbService.updateUserStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: updated.id, status: updated.status } });
  } catch (err) {
    next(err);
  }
});

router.post('/papers', (req, res, next) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const {
        title,
        subjectId,
        caLevel,
        paperType,
        chapter,
        description,
        totalMarks,
        durationMinutes,
        questionsJson,
        status,
      } = req.body || {};

      if (!title || !subjectId || !caLevel || !paperType) {
        return res.status(400).json({ error: 'title, subjectId, caLevel, and paperType are required' });
      }

      let questions = [];
      if (questionsJson) {
        try {
          questions = JSON.parse(questionsJson);
        } catch {
          return res.status(400).json({ error: 'Invalid questionsJson' });
        }
      }
      if (!questions.length) {
        const marks = Number(totalMarks) || 100;
        const marksPerQ = Math.floor(marks / 4);
        const remainder = marks - marksPerQ * 3;
        questions = [
          { number: 1, maxMarks: marksPerQ, prompt: 'Question 1' },
          { number: 2, maxMarks: marksPerQ, prompt: 'Question 2' },
          { number: 3, maxMarks: marksPerQ, prompt: 'Question 3' },
          { number: 4, maxMarks: remainder, prompt: 'Question 4' },
        ];
      }

      const now = new Date().toISOString();
      const paperStatus = status === 'published' ? 'published' : 'draft';
      const paper = {
        id: uuid(),
        title: title.trim(),
        subjectId,
        caLevel,
        paperType,
        chapter: chapter || '',
        description: description || '',
        totalMarks: Number(totalMarks) || 100,
        durationMinutes: Number(durationMinutes) || 180,
        pdfUrl: req.file ? `/uploads/papers/${req.file.filename}` : null,
        status: paperStatus,
        publishedAt: paperStatus === 'published' ? now : null,
        createdBy: req.user.id,
        createdAt: now,
        updatedAt: now,
        questions: questions.map((q, i) => ({
          id: q.id || uuid(),
          number: q.number || i + 1,
          maxMarks: Number(q.maxMarks) || 0,
          prompt: q.prompt || '',
        })),
      };

      await dbService.createQuestionPaper(paper);
      res.status(201).json({ paper });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

router.patch('/papers/:id', (req, res, next) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const existing = await dbService.getQuestionPaperById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Paper not found' });

      const updates = {};
      const fields = [
        'title',
        'subjectId',
        'caLevel',
        'paperType',
        'chapter',
        'description',
      ];
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      if (req.body.totalMarks !== undefined) {
        updates.totalMarks = Number(req.body.totalMarks) || existing.totalMarks;
      }
      if (req.body.durationMinutes !== undefined) {
        updates.durationMinutes = Number(req.body.durationMinutes) || existing.durationMinutes;
      }
      if (req.body.questionsJson) {
        try {
          const qs = JSON.parse(req.body.questionsJson);
          updates.questions = qs.map((q, i) => ({
            id: q.id || uuid(),
            number: q.number || i + 1,
            maxMarks: Number(q.maxMarks) || 0,
            prompt: q.prompt || '',
          }));
        } catch { }
      } else if (req.body.questions) {
        updates.questions = req.body.questions;
      }

      if (req.file) {
        if (existing.pdfUrl) {
          const oldFile = path.join(QP_DIR, path.basename(existing.pdfUrl));
          if (fs.existsSync(oldFile)) {
            try {
              fs.unlinkSync(oldFile);
            } catch { }
          }
        }
        updates.pdfUrl = `/uploads/papers/${req.file.filename}`;
      }

      if (req.body.status) {
        updates.status = req.body.status;
        if (req.body.status === 'published' && !existing.publishedAt) {
          updates.publishedAt = new Date().toISOString();
        }
      }

      const updated = await dbService.updateQuestionPaper(req.params.id, updates);
      res.json({ paper: updated });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

router.delete('/papers/:id', async (req, res, next) => {
  try {
    const paper = await dbService.getQuestionPaperById(req.params.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    if (paper.pdfUrl) {
      const filePath = path.join(QP_DIR, path.basename(paper.pdfUrl));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch { }
      }
    }

    await dbService.deleteQuestionPaper(req.params.id);
    res.json({ ok: true, message: 'Question paper deleted successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/submissions', async (_req, res, next) => {
  try {
    const [submissions, users, papers, evaluations] = await Promise.all([
      dbService.getSubmissions(),
      dbService.getUsers(),
      dbService.getQuestionPapers(),
      dbService.getEvaluations(),
    ]);

    const items = submissions
      .map((s) => {
        const student = users.find((u) => u.id === s.studentId);
        const paper = papers.find((p) => p.id === s.questionPaperId);
        const reviewer = s.assignedReviewerId
          ? users.find((u) => u.id === s.assignedReviewerId)
          : null;
        const evaluation = evaluations.find((e) => e.submissionId === s.id);
        return {
          ...s,
          studentName: student?.name,
          studentEmail: student?.email,
          paperTitle: paper?.title,
          reviewerName: reviewer?.name,
          evaluationStatus: evaluation?.status || null,
          totalMarksAwarded: evaluation?.totalMarks ?? null,
        };
      })
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json({ submissions: items });
  } catch (err) {
    next(err);
  }
});

router.post('/assign', async (req, res, next) => {
  try {
    const { submissionIds, reviewerId } = req.body || {};
    if (!Array.isArray(submissionIds) || !submissionIds.length || !reviewerId) {
      return res.status(400).json({ error: 'submissionIds[] and reviewerId are required' });
    }

    const reviewer = await dbService.getUserById(reviewerId);
    if (!reviewer || reviewer.role !== 'reviewer') {
      return res.status(404).json({ error: 'Reviewer not found' });
    }

    const assigned = await dbService.assignReviewer(submissionIds, reviewerId);
    res.json({ assignedCount: assigned.length, assigned });
  } catch (err) {
    next(err);
  }
});

export default router;
