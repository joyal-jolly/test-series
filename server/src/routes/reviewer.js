import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbService } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANSWERS_DIR = path.join(__dirname, '..', '..', 'uploads', 'answers');
const DRAFTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'drafts');
if (!fs.existsSync(DRAFTS_DIR)) {
  try { fs.mkdirSync(DRAFTS_DIR, { recursive: true }); } catch { /* ignore */ }
}

// Temporary multer storage – we rename the file to overwrite the original answer
const tmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ANSWERS_DIR),
  filename: (_req, _file, cb) => cb(null, `_tmp_${uuid()}.pdf`),
});
const uploadAnnotated = multer({ storage: tmpStorage, limits: { fileSize: 50 * 1024 * 1024 } });

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

    // If draftAnnotations is not present on the submission record, load from local fallback if available
    if (assignment.draftAnnotations === undefined || assignment.draftAnnotations === null) {
      const draftPath = path.join(DRAFTS_DIR, `${submission.id}.json`);
      if (fs.existsSync(draftPath)) {
        try {
          assignment.draftAnnotations = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
        } catch { /* ignore */ }
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
      // If Supabase schema does not have draftAnnotations column yet, fallback to saving draft annotations on disk
      if (dbErr.message && dbErr.message.includes('draftAnnotations')) {
        console.warn(`[draft] Supabase submissions table missing draftAnnotations column. Saving annotations to local fallback.`);
        delete update.draftAnnotations;
        // Save feedback + draftSavedAt to Supabase without the missing column
        await dbService.updateSubmission(submission.id, update);
        // Persist draft annotations on local disk as fallback
        const draftPath = path.join(DRAFTS_DIR, `${submission.id}.json`);
        fs.writeFileSync(draftPath, JSON.stringify(draftAnnotations || null), 'utf8');
      } else {
        throw dbErr;
      }
    }

    res.json({ ok: true, savedAt: now });
  } catch (err) {
    next(err);
  }
});

// Upload reviewed PDF – overwrites the original student answer file in-place
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

      // Derive the original answer file path from the stored URL
      // answerFileUrl is like /uploads/answers/<filename>
      const originalFilename = path.basename(submission.answerFileUrl || '');
      if (!originalFilename) {
        // No original file on record – just keep the uploaded file as-is
        const url = `/uploads/answers/${req.file.filename}`;
        return res.json({ url });
      }

      const originalPath = path.join(ANSWERS_DIR, originalFilename);

      // Overwrite the original with the reviewed PDF
      fs.rename(req.file.path, originalPath, (renameErr) => {
        if (renameErr) {
          // Fallback: copy then remove if cross-device rename fails
          const rs = fs.createReadStream(req.file.path);
          const ws = fs.createWriteStream(originalPath);
          rs.pipe(ws);
          ws.on('finish', () => {
            fs.unlink(req.file.path, () => {});
            res.json({ url: submission.answerFileUrl });
          });
          ws.on('error', (copyErr) => next(copyErr));
        } else {
          // Return the same original URL – the file has been overwritten
          res.json({ url: submission.answerFileUrl });
        }
      });
    } catch (err2) {
      next(err2);
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

    const paper = await dbService.getQuestionPaperById(submission.questionPaperId);

    const questionMarks = Array.isArray(rawMarks) && rawMarks.length > 0
      ? rawMarks
      : (paper?.questions || []).map((q) => ({ questionId: q.id, marksAwarded: 0, feedback: '' }));

    const now = new Date().toISOString();
    // Use totalMarksOverride if the reviewer entered a direct total; otherwise sum per-question
    const totalMarks = totalMarksOverride != null
      ? Number(totalMarksOverride)
      : questionMarks.reduce((sum, qm) => sum + Number(qm.marksAwarded || 0), 0);

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
