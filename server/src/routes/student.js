import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import { dbService } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';
import { supabase } from '../supabase.js';

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
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Only PDF files are allowed for answer submission'));
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

// ─── Enrollment endpoints ─────────────────────────────────────────────────────

// GET /api/student/enrollments
router.get('/enrollments', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_enrollments')
      .select('"groupId"')
      .eq('"studentId"', req.user.id);
    if (error) return res.json({ enrolledGroupIds: [] });
    res.json({ enrolledGroupIds: (data || []).map((r) => r.groupId) });
  } catch {
    res.json({ enrolledGroupIds: [] });
  }
});

// POST /api/student/enroll/:groupId
router.post('/enroll/:groupId', requireAuth, requireRole('student'), async (req, res) => {
  const { groupId } = req.params;
  try {
    const group = await dbService.getQuestionPaperGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await supabase.from('group_enrollments').upsert(
      { id: `${req.user.id}-${groupId}`, studentId: req.user.id, groupId, enrolledAt: new Date().toISOString() },
      { onConflict: 'id' }
    );
    res.json({ ok: true, groupId });
  } catch {
    res.json({ ok: true, groupId }); // non-fatal — client uses localStorage
  }
});

// ─── Exemption endpoints ──────────────────────────────────────────────────────

// GET /api/student/exemptions/:groupId
router.get('/exemptions/:groupId', requireAuth, requireRole('student'), async (req, res) => {
  const { groupId } = req.params;
  try {
    const { data, error } = await supabase
      .from('student_exemptions')
      .select('"subjectId"')
      .eq('studentId', req.user.id)
      .eq('groupId', groupId);
    if (error) return res.json({ subjectIds: [] });
    res.json({ subjectIds: (data || []).map((r) => r.subjectId) });
  } catch {
    res.json({ subjectIds: [] });
  }
});

// POST /api/student/exemptions/:groupId
router.post('/exemptions/:groupId', requireAuth, requireRole('student'), async (req, res) => {
  const { groupId } = req.params;
  const { subjectIds = [] } = req.body || {};
  try {
    await supabase
      .from('student_exemptions')
      .delete()
      .eq('studentId', req.user.id)
      .eq('groupId', groupId);
    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      const records = subjectIds.map((sid) => ({
        id: `${req.user.id}-${groupId}-${sid}`,
        studentId: req.user.id,
        groupId,
        subjectId: sid,
        createdAt: new Date().toISOString(),
      }));
      await supabase.from('student_exemptions').insert(records);
    }
    res.json({ ok: true, subjectIds });
  } catch {
    res.json({ ok: true, subjectIds });
  }
});

// GET /api/student/paper-attempts — { [paperId]: { attemptId, status, evaluated } }
router.get('/paper-attempts', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const [attempts, submissions, evaluations] = await Promise.all([
      dbService.getAttempts(),
      dbService.getSubmissions(),
      dbService.getEvaluations(),
    ]);
    const mine = attempts.filter((a) => a.studentId === req.user.id);

    // Priority: evaluated > under_review > assigned > submitted > in_progress
    const pri = { evaluated: 5, under_review: 4, assigned: 3, submitted: 2, in_progress: 1 };
    const sorted = [...mine].sort((a, b) => (pri[a.status] || 0) - (pri[b.status] || 0));

    const result = {};
    for (const a of sorted) {
      const sub = submissions.find((s) => s.attemptId === a.id);
      const ev = sub ? evaluations.find((e) => e.submissionId === sub.id) : null;
      result[a.questionPaperId] = { attemptId: a.id, status: a.status, evaluated: !!ev };
    }
    res.json({ paperAttempts: result });
  } catch (err) {
    next(err);
  }
});

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

    // Enforce scheduled access — block if paper has a future availableAt
    if (paper.availableAt) {
      const now = new Date();
      const availableDate = new Date(paper.availableAt);
      if (now < availableDate) {
        return res.status(403).json({
          error: 'This question paper is not yet available',
          availableAt: paper.availableAt,
          message: `Available on ${availableDate.toLocaleDateString()} at ${availableDate.toLocaleTimeString()}`,
        });
      }
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
      await dbService.deleteAttempt(stale.id).catch(() => { });
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

// ─── Published Results endpoints (must be BEFORE /:id to avoid shadowing) ─────

// GET /api/student/published-results
router.get('/published-results', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const [publications, groups] = await Promise.all([
      dbService.getPublishedResultsForStudent(studentId),
      dbService.getQuestionPaperGroups(),
    ]);
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const results = publications.map((pub) => {
      const group = groupMap.get(pub.groupId);
      return {
        groupId: pub.groupId,
        groupName: group?.name || 'Unknown',
        groupDescription: group?.description || null,
        caLevel: group?.caLevel || null,
        result: pub.result,
        isPassed: pub.isPassed,
        totalMarksAwarded: pub.totalMarksAwarded,
        totalMaxMarks: pub.totalMaxMarks,
        overallPct: pub.overallPct,
        feedback: pub.feedback || null,
        publishedAt: pub.publishedAt,
      };
    });
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// GET /api/student/published-results/:groupId
router.get('/published-results/:groupId', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { groupId } = req.params;

    // Verify ownership: only the student whose result is published can access it
    const publication = await dbService.getGroupResultPublication(studentId, groupId);
    if (!publication) {
      return res.status(404).json({ error: 'No published result found for this group' });
    }

    const [group, groupPapers, subjects, groupSchedules, studentSubs, evaluations] = await Promise.all([
      dbService.getQuestionPaperGroupById(groupId),
      dbService.getQuestionPapersByGroup(groupId),
      dbService.getSubjects(),
      dbService.getSchedulesByGroup(groupId),
      dbService.getSubmissionsByStudent(studentId),
      dbService.getEvaluations(),
    ]);

    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Fetch exemptions for this student+group
    const { data: exemptionRows } = await supabase
      .from('student_exemptions')
      .select('*')
      .eq('studentId', studentId)
      .eq('groupId', groupId);
    const exemptedSubjectIds = new Set((exemptionRows || []).map((e) => e.subjectId));

    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const evalMap = new Map(evaluations.map((e) => [e.submissionId, e]));
    const subByPaperId = new Map(studentSubs.map((s) => [s.questionPaperId, s]));
    const schedMap = new Map(groupSchedules.map((s) => [s.scheduleNumber, s]));

    const scheduleList = [];
    for (let sn = 1; sn <= group.numSchedules; sn++) {
      const schedPapers = groupPapers.filter((p) => p.scheduleNumber === sn);
      if (schedPapers.length === 0) continue;
      const schedRecord = schedMap.get(sn);
      const availAt = schedRecord?.availableAt || schedPapers[0]?.availableAt || null;

      const paperData = schedPapers.map((paper) => {
        const isExempted = exemptedSubjectIds.has(paper.subjectId);
        const subject = subjectMap.get(paper.subjectId);
        const sub = subByPaperId.get(paper.id);
        const evaluation = sub ? evalMap.get(sub.id) : null;
        return {
          paperId: paper.id,
          title: paper.title,
          subjectName: subject?.name || 'Unknown',
          totalMarks: paper.totalMarks,
          isExempted,
          marksAwarded: isExempted ? null : (evaluation?.totalMarks ?? null),
          status: isExempted ? 'exempted' : (sub?.status || 'not_attempted'),
        };
      });

      scheduleList.push({ scheduleNumber: sn, availableAt: availAt, papers: paperData });
    }

    res.json({
      publication: {
        result: publication.result,
        isPassed: publication.isPassed,
        totalMarksAwarded: publication.totalMarksAwarded,
        totalMaxMarks: publication.totalMaxMarks,
        overallPct: publication.overallPct,
        feedback: publication.feedback,
        publishedAt: publication.publishedAt,
      },
      group: { id: group.id, name: group.name, caLevel: group.caLevel },
      schedules: scheduleList,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Attempt endpoints (/:id MUST come after all specific named routes) ────────

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
    if (!req.file) return res.status(400).json({ error: 'Answer PDF is required' });

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

    // Fetch group name if the paper belongs to a group
    let groupName = null;
    if (paper?.groupId) {
      const group = await dbService.getQuestionPaperGroupById(paper.groupId);
      groupName = group?.name || null;
    }

    const submission = submissions.find((s) => s.attemptId === attempt.id);
    const evaluation = evaluations.find((e) => e.submissionId === submission?.id);
    const [questionEvals, reviewer] = await Promise.all([
      evaluation ? dbService.getQuestionEvaluations(evaluation.id) : [],
      evaluation ? dbService.getUserById(evaluation.reviewerId) : null,
    ]);

    res.json({
      attempt: enrichAttempt(attempt, [paper], submissions, evaluations),
      paper: { ...paper, groupName },
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
