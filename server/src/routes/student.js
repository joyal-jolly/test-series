import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import { dbService } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'answers');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only PDF and image files are allowed'));
    }
    cb(null, true);
  },
});

const router = Router();

function enrichAttempt(attempt, papers, submissions, evaluations) {
  const paper = papers.find((p) => p.id === attempt.questionPaperId);
  const submission = submissions.find((s) => s.attemptId === attempt.id);
  const evaluation = submission
    ? evaluations.find((e) => e.submissionId === submission.id)
    : null;
  return {
    ...attempt,
    paperTitle: paper?.title,
    paperType: paper?.paperType,
    caLevel: paper?.caLevel,
    totalMarks: paper?.totalMarks,
    durationMinutes: paper?.durationMinutes,
    submission,
    evaluation: evaluation
      ? {
          id: evaluation.id,
          totalMarks: evaluation.totalMarks,
          feedback: evaluation.feedback,
          status: evaluation.status,
          evaluatedAt: evaluation.evaluatedAt,
        }
      : null,
  };
}

router.get('/mine', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const [attempts, papers, submissions, evaluations] = await Promise.all([
      dbService.getAttempts(),
      dbService.getQuestionPapers(),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);

    const myAttempts = attempts
      .filter(
        (a) =>
          a.studentId === req.user.id &&
          ['submitted', 'assigned', 'under_review', 'evaluated'].includes(a.status)
      )
      .map((a) => enrichAttempt(a, papers, submissions, evaluations))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ attempts: myAttempts });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const [attempts, papers, submissions, evaluations] = await Promise.all([
      dbService.getAttempts(),
      dbService.getQuestionPapers(),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);

    const submittedAttempts = attempts
      .filter(
        (a) =>
          a.studentId === req.user.id &&
          ['submitted', 'assigned', 'under_review', 'evaluated'].includes(a.status)
      )
      .map((a) => enrichAttempt(a, papers, submissions, evaluations))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      recentAttempts: submittedAttempts.slice(0, 5),
      totalSubmissions: submittedAttempts.length,
      pendingEvaluations: submittedAttempts.filter((a) =>
        ['submitted', 'assigned', 'under_review'].includes(a.status)
      ).length,
      completedEvaluations: submittedAttempts.filter((a) => a.status === 'evaluated').length,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/start', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const { questionPaperId } = req.body || {};
    if (!questionPaperId) return res.status(400).json({ error: 'questionPaperId is required' });

    const paper = await dbService.getQuestionPaperById(questionPaperId);
    if (!paper || paper.status !== 'published') {
      return res.status(404).json({ error: 'Published question paper not found' });
    }

    // Purge any previous incomplete/stale attempt for this paper by this student
    const allAttempts = await dbService.getAttempts();
    const staleIncomplete = allAttempts.filter(
      (a) =>
        a.studentId === req.user.id &&
        a.questionPaperId === questionPaperId &&
        ['in_progress', 'not_started', 'abandoned'].includes(a.status)
    );
    for (const stale of staleIncomplete) {
      await dbService.deleteAttempt(stale.id).catch(() => {});
    }

    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + (paper.durationMinutes || 180) * 60 * 1000).toISOString();
    const attempt = {
      id: uuid(),
      questionPaperId,
      studentId: req.user.id,
      startedAt: now,
      submittedAt: null,
      deadline,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
    };

    await dbService.createAttempt(attempt);

    const [papers, submissions, evaluations] = await Promise.all([
      dbService.getQuestionPapers(),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);

    res.status(201).json({ attempt: enrichAttempt(attempt, papers, submissions, evaluations) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/discard', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const attempt = await dbService.getAttemptById(req.params.id);
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (['in_progress', 'not_started'].includes(attempt.status)) {
      await dbService.deleteAttempt(attempt.id);
      return res.json({ ok: true, discarded: true });
    }
    return res.status(400).json({ error: 'Cannot discard an already submitted attempt' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const attempt = await dbService.getAttemptById(req.params.id);
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (['in_progress', 'not_started'].includes(attempt.status)) {
      await dbService.deleteAttempt(attempt.id);
      return res.json({ ok: true, deleted: true });
    }
    return res.status(400).json({ error: 'Cannot delete an already submitted attempt' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const attempt = await dbService.getAttemptById(req.params.id);
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const [papers, submissions, evaluations] = await Promise.all([
      dbService.getQuestionPapers(),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);

    res.json({ attempt: enrichAttempt(attempt, papers, submissions, evaluations) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', requireAuth, requireRole('student'), (req, res, next) => {
  upload.single('answerFile')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Answer PDF/image is required' });

    try {
      const attempt = await dbService.getAttemptById(req.params.id);
      if (!attempt || attempt.studentId !== req.user.id) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      if (!['in_progress', 'not_started'].includes(attempt.status)) {
        return res.status(400).json({ error: 'This attempt can no longer be submitted' });
      }

      const now = new Date().toISOString();
      const submission = {
        id: uuid(),
        attemptId: attempt.id,
        studentId: req.user.id,
        questionPaperId: attempt.questionPaperId,
        answerFileUrl: `/uploads/answers/${req.file.filename}`,
        originalName: req.file.originalname,
        submittedAt: now,
        status: 'submitted',
        assignedReviewerId: null,
        assignedAt: null,
        draftFeedback: '',
        draftSavedAt: null,
      };

      await dbService.createSubmission(submission, attempt.id);

      const [updatedAttempt, papers, submissions, evaluations] = await Promise.all([
        dbService.getAttemptById(attempt.id),
        dbService.getQuestionPapers(),
        dbService.getSubmissions(),
        dbService.getEvaluations(),
      ]);

      res.status(201).json({
        message: 'Submission received',
        attempt: enrichAttempt(updatedAttempt, papers, submissions, evaluations),
      });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

router.get('/:id/result', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const attempt = await dbService.getAttemptById(req.params.id);
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (attempt.status !== 'evaluated') {
      return res.status(400).json({ error: 'Evaluation not available yet' });
    }

    const [paper, submissions, evaluations] = await Promise.all([
      dbService.getQuestionPaperById(attempt.questionPaperId),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);

    const submission = submissions.find((s) => s.attemptId === attempt.id);
    const evaluation = evaluations.find((e) => e.submissionId === submission?.id);
    const [questionEvals, reviewer] = await Promise.all([
      evaluation ? dbService.getQuestionEvaluations(evaluation.id) : [],
      evaluation ? dbService.getUserById(evaluation.reviewerId) : null,
    ]);

    res.json({
      attempt: enrichAttempt(attempt, [paper], submissions, evaluations),
      paper,
      submission,
      evaluation: evaluation
        ? {
            ...evaluation,
            reviewerName: reviewer?.name,
            questionEvaluations: questionEvals,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
