import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import { dbService } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';
import { uploadFile, deleteFile, getFile, isValidPdf, normalizeStorageKey } from '../storage.js';

// Memory storage for annotated PDF uploads (up to 50MB)
const uploadAnnotated = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

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

    const assignment = enrichSubmission(submission, users, papers, evaluations);

    // If draftAnnotations is not present on the submission record, load from storage if available
    if (assignment.draftAnnotations === undefined || assignment.draftAnnotations === null) {
      try {
        const bucket = req.app.get('r2');
        const draftFile = await getFile(bucket, `drafts/${submission.id}.json`);
        if (draftFile) {
          const chunks = [];
          for await (const chunk of draftFile.stream) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          if (raw) assignment.draftAnnotations = JSON.parse(raw);
        }
      } catch {
        /* ignore draft parse errors */
      }
    }

    res.json({
      assignment,
      evaluation,
      questionEvaluations: questionEvals,
    });
  } catch (err) {
    next(err);
  }
});

// Save draft (feedback text + annotation marks)
router.patch('/assignments/:id/draft', async (req, res, next) => {
  try {
    const { feedback, draftAnnotations } = req.body || {};
    const submission = await dbService.getSubmissionById(req.params.id);
    if (!submission || submission.assignedReviewerId !== req.user.id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (submission.status === 'evaluated') {
      return res.status(400).json({ error: 'Already evaluated – cannot save draft' });
    }

    const now = new Date().toISOString();
    const update = {
      draftFeedback: feedback ?? '',
      draftSavedAt: now,
    };
    // Save annotation JSON if provided (can be null to clear)
    if (draftAnnotations !== undefined) {
      update.draftAnnotations = draftAnnotations;
    }

    try {
      await dbService.updateSubmission(submission.id, update);
    } catch (dbErr) {
      // If Supabase schema does not have draftAnnotations column yet, fallback to saving draft annotations in storage
      if (dbErr.message && dbErr.message.includes('draftAnnotations')) {
        console.warn(`[draft] Supabase submissions table missing draftAnnotations column. Saving annotations to storage fallback.`);
        delete update.draftAnnotations;
        // Save feedback + draftSavedAt to Supabase without the missing column
        await dbService.updateSubmission(submission.id, update);
        // Persist draft annotations to storage
        await uploadFile(
          req.app.get('r2'),
          `drafts/${submission.id}.json`,
          Buffer.from(JSON.stringify(draftAnnotations || null)),
          'application/json',
        );
      } else {
        throw dbErr;
      }
    }

    res.json({ ok: true, savedAt: now });
  } catch (err) {
    next(err);
  }
});

// Upload reviewed PDF – uploads annotated PDF to R2 and updates submission record
router.post('/assignments/:id/upload-annotated', (req, res, next) => {
  uploadAnnotated.single('annotatedPdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let annotatedKey = null;
    try {
      const submission = await dbService.getSubmissionById(req.params.id);
      if (!submission || submission.assignedReviewerId !== req.user.id) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      if (!isValidPdf(req.file.buffer)) {
        return res.status(400).json({ error: 'Uploaded file is not a valid PDF document' });
      }

      annotatedKey = `answers/${submission.id}-annotated.pdf`;
      await uploadFile(
        req.app.get('r2'),
        annotatedKey,
        req.file.buffer,
        'application/pdf',
        {
          submissionId: submission.id,
          reviewerId: req.user.id,
          annotatedAt: new Date().toISOString(),
        },
      );

      const newUrl = `/api/files/${annotatedKey}`;
      await dbService.updateSubmission(submission.id, {
        answerFileUrl: newUrl,
      });

      res.json({ url: newUrl });
    } catch (uploadErr) {
      if (annotatedKey) {
        await deleteFile(req.app.get('r2'), annotatedKey).catch(() => {});
      }
      next(uploadErr);
    }
  });
});

router.post('/assignments/:id/evaluate', async (req, res, next) => {
  try {
    const { feedback, questionMarks: rawMarks, totalMarksOverride } = req.body || {};
    const submission = await dbService.getSubmissionById(req.params.id);
    if (!submission || submission.assignedReviewerId !== req.user.id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (submission.status === 'evaluated') {
      return res.status(400).json({ error: 'Already evaluated' });
    }

    if (totalMarksOverride == null || totalMarksOverride === '' || isNaN(Number(totalMarksOverride))) {
      return res.status(400).json({ error: 'Marks input is compulsory before submitting the result' });
    }

    const totalMarks = Number(totalMarksOverride);
    if (totalMarks < 0) {
      return res.status(400).json({ error: 'Marks awarded cannot be negative' });
    }

    const paper = await dbService.getQuestionPaperById(submission.questionPaperId);
    if (paper?.totalMarks && totalMarks > paper.totalMarks) {
      return res.status(400).json({ error: `Marks awarded cannot exceed maximum marks (${paper.totalMarks})` });
    }

    const questionMarks = Array.isArray(rawMarks) && rawMarks.length > 0
      ? rawMarks
      : (paper?.questions || []).map((q) => ({ questionId: q.id, marksAwarded: 0, feedback: '' }));

    const now = new Date().toISOString();

    const evaluationId = uuid();
    const evaluation = {
      id: evaluationId,
      submissionId: submission.id,
      reviewerId: req.user.id,
      totalMarks,
      feedback: feedback || '',
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
