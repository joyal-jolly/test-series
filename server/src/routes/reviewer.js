import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbService } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANNOTATED_DIR = path.join(__dirname, '..', '..', 'uploads', 'annotated');
fs.mkdirSync(ANNOTATED_DIR, { recursive: true });

const annotatedStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ANNOTATED_DIR),
  filename: (_req, _file, cb) => cb(null, `${uuid()}.pdf`),
});
const uploadAnnotated = multer({ storage: annotatedStorage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth, requireRole('reviewer'));

function enrichSubmission(submission, users, papers, evaluations) {
  const student = users.find((u) => u.id === submission.studentId);
  const paper = papers.find((p) => p.id === submission.questionPaperId);
  const evaluation = evaluations.find((e) => e.submissionId === submission.id);
  return {
    ...submission,
    studentName: student?.name,
    studentEmail: student?.email,
    paperTitle: paper?.title,
    paperType: paper?.paperType,
    caLevel: paper?.caLevel,
    totalMarks: paper?.totalMarks,
    pdfUrl: paper?.pdfUrl || null,
    questions: paper?.questions || [],
    evaluation,
  };
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const [submissions, users, papers, evaluations] = await Promise.all([
      dbService.getSubmissions(),
      dbService.getUsers(),
      dbService.getQuestionPapers(),
      dbService.getEvaluations(),
    ]);

    const mine = submissions.filter((s) => s.assignedReviewerId === req.user.id);
    const pending = mine.filter((s) => ['assigned', 'under_review'].includes(s.status));
    const completed = mine.filter((s) => s.status === 'evaluated');

    res.json({
      pendingCount: pending.length,
      completedCount: completed.length,
      recentAssignments: mine
        .map((s) => enrichSubmission(s, users, papers, evaluations))
        .sort((a, b) => new Date(b.assignedAt || b.submittedAt) - new Date(a.assignedAt || a.submittedAt))
        .slice(0, 8),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/assignments', async (req, res, next) => {
  try {
    const { status } = req.query;
    const [submissions, users, papers, evaluations] = await Promise.all([
      dbService.getSubmissions(),
      dbService.getUsers(),
      dbService.getQuestionPapers(),
      dbService.getEvaluations(),
    ]);

    let mine = submissions.filter((s) => s.assignedReviewerId === req.user.id);
    if (status === 'pending') {
      mine = mine.filter((s) => ['assigned', 'under_review'].includes(s.status));
    } else if (status === 'completed') {
      mine = mine.filter((s) => s.status === 'evaluated');
    }

    res.json({
      assignments: mine
        .map((s) => enrichSubmission(s, users, papers, evaluations))
        .sort((a, b) => new Date(b.assignedAt || b.submittedAt) - new Date(a.assignedAt || a.submittedAt)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/assignments/:id', async (req, res, next) => {
  try {
    const submission = await dbService.getSubmissionById(req.params.id);
    if (!submission || submission.assignedReviewerId !== req.user.id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (submission.status === 'assigned') {
      const now = new Date().toISOString();
      await Promise.all([
        dbService.updateSubmission(submission.id, { status: 'under_review' }),
        dbService.updateAttempt(submission.attemptId, { status: 'under_review' }),
      ]);
      submission.status = 'under_review';
    }

    const [users, papers, evaluations] = await Promise.all([
      dbService.getUsers(),
      dbService.getQuestionPapers(),
      dbService.getEvaluations(),
    ]);

    const evaluation = evaluations.find((e) => e.submissionId === submission.id);
    const questionEvals = evaluation
      ? await dbService.getQuestionEvaluations(evaluation.id)
      : [];

    res.json({
      assignment: enrichSubmission(submission, users, papers, evaluations),
      evaluation,
      questionEvaluations: questionEvals,
    });
  } catch (err) {
    next(err);
  }
});

// Save draft
router.patch('/assignments/:id/draft', async (req, res, next) => {
  try {
    const { feedback } = req.body || {};
    const submission = await dbService.getSubmissionById(req.params.id);
    if (!submission || submission.assignedReviewerId !== req.user.id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (submission.status === 'evaluated') {
      return res.status(400).json({ error: 'Already evaluated – cannot save draft' });
    }

    const now = new Date().toISOString();
    await dbService.updateSubmission(submission.id, {
      draftFeedback: feedback ?? '',
      draftSavedAt: now,
    });

    res.json({ ok: true, savedAt: now });
  } catch (err) {
    next(err);
  }
});

// Upload annotated PDF (called before /evaluate)
router.post('/assignments/:id/upload-annotated', (req, res, next) => {
  uploadAnnotated.single('annotatedPdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const submission = await dbService.getSubmissionById(req.params.id);
      if (!submission || submission.assignedReviewerId !== req.user.id) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Assignment not found' });
      }
      const url = `/uploads/annotated/${req.file.filename}`;
      res.json({ url });
    } catch (err2) {
      next(err2);
    }
  });
});

router.post('/assignments/:id/evaluate', async (req, res, next) => {
  try {
    const { feedback, questionMarks: rawMarks } = req.body || {};
    const submission = await dbService.getSubmissionById(req.params.id);
    if (!submission || submission.assignedReviewerId !== req.user.id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (submission.status === 'evaluated') {
      return res.status(400).json({ error: 'Already evaluated' });
    }

    const paper = await dbService.getQuestionPaperById(submission.questionPaperId);

    const questionMarks = Array.isArray(rawMarks) && rawMarks.length > 0
      ? rawMarks
      : (paper?.questions || []).map((q) => ({ questionId: q.id, marksAwarded: 0, feedback: '' }));

    const { annotatedPdfUrl } = req.body || {};
    const now = new Date().toISOString();
    const totalMarks = questionMarks.reduce((sum, qm) => sum + Number(qm.marksAwarded || 0), 0);

    const evaluationId = uuid();
    const evaluation = {
      id: evaluationId,
      submissionId: submission.id,
      reviewerId: req.user.id,
      totalMarks,
      feedback: feedback || '',
      annotatedPdfUrl: annotatedPdfUrl || null,
      status: 'completed',
      evaluatedAt: now,
      updatedAt: now,
    };

    const qEvals = questionMarks.map((qm) => {
      const question = (paper?.questions || []).find((q) => q.id === qm.questionId);
      return {
        id: uuid(),
        evaluationId,
        questionId: qm.questionId,
        marksAwarded: Number(qm.marksAwarded) || 0,
        maximumMarks: question?.maxMarks || Number(qm.maximumMarks) || 0,
        feedback: qm.feedback || '',
      };
    });

    await dbService.submitEvaluation({
      evaluation,
      questionEvaluations: qEvals,
      submissionId: submission.id,
      attemptId: submission.attemptId,
    });

    res.status(201).json({
      evaluation,
      questionEvaluations: qEvals,
      message: 'Evaluation submitted',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
