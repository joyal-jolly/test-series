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

    // Submissions assigned to a reviewer but not yet evaluated
    const assignedPending = submissions
      .filter((s) => ['assigned', 'under_review'].includes(s.status) && s.assignedReviewerId)
      .map((s) => {
        const student = users.find((u) => u.id === s.studentId);
        const paper = papers.find((p) => p.id === s.questionPaperId);
        const reviewer = users.find((u) => u.id === s.assignedReviewerId);
        return {
          id: s.id,
          studentName: student?.name || 'Unknown',
          studentEmail: student?.email || '',
          paperTitle: paper?.title || 'Unknown paper',
          reviewerName: reviewer?.name || 'Unknown',
          assignedAt: s.assignedAt,
          status: s.status,
        };
      })
      .sort((a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0));

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
      assignedPending,
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

router.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await dbService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent deleting the requesting admin's own account
    if (req.user && req.user.id === req.params.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const admins = await dbService.getUsers('admin');
      if (admins.length <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
      }
    }

    await dbService.deleteUser(req.params.id);
    res.json({ ok: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── Question Paper Groups ──────────────────────────────────────────────

router.get('/groups', async (_req, res, next) => {
  try {
    const [groups, allPapers, subjects, allSchedules] = await Promise.all([
      dbService.getQuestionPaperGroups(),
      dbService.getQuestionPapers(),
      dbService.getSubjects(),
      dbService.getAllSchedules(),
    ]);

    const enrichedGroups = groups.map((g) => {
      const papers = allPapers.filter((p) => p.groupId === g.id);
      const groupSchedules = allSchedules.filter((s) => s.groupId === g.id);
      const maxSubjects = g.numSubjectsPerSchedule || 3;

      const schedules = [];
      for (let i = 1; i <= g.numSchedules; i++) {
        const schedRecord = groupSchedules.find((s) => s.scheduleNumber === i);
        const schedPapers = papers
          .filter((p) => p.scheduleNumber === i)
          .map((paper) => {
            const subject = subjects.find((s) => s.id === paper.subjectId);
            return {
              id: paper.id,
              title: paper.title,
              subjectId: paper.subjectId,
              subjectName: subject?.name || 'Unknown',
              caLevel: paper.caLevel,
              paperType: paper.paperType,
              chapter: paper.chapter || '',
              totalMarks: paper.totalMarks,
              durationMinutes: paper.durationMinutes,
              pdfUrl: paper.pdfUrl,
              status: paper.status,
              availableAt: paper.availableAt,
              createdAt: paper.createdAt,
            };
          });

        const availableAt = schedRecord?.availableAt || schedPapers[0]?.availableAt || null;

        schedules.push({
          scheduleNumber: i,
          availableAt,
          numSubjectsExpected: maxSubjects,
          papers: schedPapers,
          uploadedCount: schedPapers.length,
          status: schedPapers.length >= maxSubjects ? 'uploaded' : schedPapers.length > 0 ? 'in_progress' : 'pending',
        });
      }

      const totalExpectedPapers = g.numSchedules * maxSubjects;
      const totalUploadedPapers = papers.length;

      return {
        ...g,
        numSubjectsPerSchedule: maxSubjects,
        schedules,
        totalExpectedPapers,
        totalUploadedPapers,
        completeSchedulesCount: schedules.filter((s) => s.status === 'uploaded').length,
        pendingSchedulesCount: schedules.filter((s) => s.status === 'pending').length,
      };
    });

    res.json({ groups: enrichedGroups });
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id', async (req, res, next) => {
  try {
    const [group, allPapers, subjects, groupSchedules] = await Promise.all([
      dbService.getQuestionPaperGroupById(req.params.id),
      dbService.getQuestionPapersByGroup(req.params.id),
      dbService.getSubjects(),
      dbService.getSchedulesByGroup(req.params.id),
    ]);

    if (!group) return res.status(404).json({ error: 'Group not found' });

    const maxSubjects = group.numSubjectsPerSchedule || 3;
    const schedules = [];
    for (let i = 1; i <= group.numSchedules; i++) {
      const schedRecord = groupSchedules.find((s) => s.scheduleNumber === i);
      const schedPapers = allPapers
        .filter((p) => p.scheduleNumber === i)
        .map((paper) => {
          const subject = subjects.find((s) => s.id === paper.subjectId);
          return {
            ...paper,
            subjectName: subject?.name || 'Unknown',
          };
        });

      const availableAt = schedRecord?.availableAt || schedPapers[0]?.availableAt || null;

      schedules.push({
        scheduleNumber: i,
        availableAt,
        numSubjectsExpected: maxSubjects,
        papers: schedPapers,
        status: schedPapers.length >= maxSubjects ? 'uploaded' : schedPapers.length > 0 ? 'in_progress' : 'pending',
      });
    }

    res.json({ group: { ...group, numSubjectsPerSchedule: maxSubjects, schedules } });
  } catch (err) {
    next(err);
  }
});

router.post('/groups', async (req, res, next) => {
  try {
    const { name, description, numSchedules, numSubjectsPerSchedule } = req.body || {};
    if (!name || !numSchedules || numSchedules < 1) {
      return res.status(400).json({ error: 'name and numSchedules (>= 1) are required' });
    }

    const subjectsCount = Number(numSubjectsPerSchedule) >= 1 ? Number(numSubjectsPerSchedule) : 3;
    const now = new Date().toISOString();
    const group = {
      id: uuid(),
      name: name.trim(),
      description: description || '',
      numSchedules: Number(numSchedules),
      numSubjectsPerSchedule: subjectsCount,
      createdBy: req.user.id,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.createQuestionPaperGroup(group);
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

router.patch('/groups/:id', async (req, res, next) => {
  try {
    const existing = await dbService.getQuestionPaperGroupById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Group not found' });

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.numSchedules !== undefined) {
      const num = Number(req.body.numSchedules);
      if (num < 1) return res.status(400).json({ error: 'numSchedules must be >= 1' });
      updates.numSchedules = num;
    }
    if (req.body.numSubjectsPerSchedule !== undefined) {
      const numSub = Number(req.body.numSubjectsPerSchedule);
      if (numSub < 1) return res.status(400).json({ error: 'numSubjectsPerSchedule must be >= 1' });
      updates.numSubjectsPerSchedule = numSub;
    }

    const updated = await dbService.updateQuestionPaperGroup(req.params.id, updates);
    res.json({ group: updated });
  } catch (err) {
    next(err);
  }
});

// Update the single scheduled date & time for a whole schedule
router.patch('/groups/:id/schedules/:scheduleNumber', async (req, res, next) => {
  try {
    const { availableAt } = req.body || {};
    const updated = await dbService.setScheduleAvailableAt(
      req.params.id,
      req.params.scheduleNumber,
      availableAt || null
    );
    res.json({ ok: true, schedule: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/groups/:id', async (req, res, next) => {
  try {
    const existing = await dbService.getQuestionPaperGroupById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Group not found' });

    await dbService.deleteQuestionPaperGroup(req.params.id);
    res.json({ ok: true, message: 'Group deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── Question Papers (with group/schedule support) ──────────────────────

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
        groupId,
        scheduleNumber,
        availableAt,
      } = req.body || {};

      if (!title || !subjectId || !caLevel || !paperType) {
        return res.status(400).json({ error: 'title, subjectId, caLevel, and paperType are required' });
      }

      let paperAvailableAt = availableAt || null;

      // If groupId + scheduleNumber provided, verify group exists and subject slot is open
      if (groupId && scheduleNumber) {
        const group = await dbService.getQuestionPaperGroupById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });
        const schedNum = Number(scheduleNumber);
        if (schedNum < 1 || schedNum > group.numSchedules) {
          return res.status(400).json({ error: `Schedule number must be between 1 and ${group.numSchedules}` });
        }
        const maxSubjects = group.numSubjectsPerSchedule || 3;
        const existing = await dbService.getQuestionPapersByGroup(groupId);
        const existingInSchedule = existing.filter((p) => p.scheduleNumber === schedNum);

        // Check if paper for this subject is already uploaded
        const duplicateSubject = existingInSchedule.find((p) => p.subjectId === subjectId);
        if (duplicateSubject) {
          return res.status(409).json({ error: `A question paper for this subject is already uploaded in Schedule ${schedNum}.` });
        }

        if (existingInSchedule.length >= maxSubjects) {
          return res.status(409).json({ error: `Schedule ${schedNum} already has all ${maxSubjects} subject question papers assigned.` });
        }

        // Inherit the schedule's existing availableAt if not provided
        if (!paperAvailableAt) {
          const groupSchedules = await dbService.getSchedulesByGroup(groupId);
          const schedRecord = groupSchedules.find((s) => s.scheduleNumber === schedNum);
          paperAvailableAt = schedRecord?.availableAt || existingInSchedule[0]?.availableAt || null;
        }
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
        groupId: groupId || null,
        scheduleNumber: scheduleNumber ? Number(scheduleNumber) : null,
        availableAt: paperAvailableAt || null,
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

      // Group/schedule fields
      if (req.body.availableAt !== undefined) {
        updates.availableAt = req.body.availableAt || null;
      }
      if (req.body.groupId !== undefined) {
        updates.groupId = req.body.groupId || null;
      }
      if (req.body.scheduleNumber !== undefined) {
        updates.scheduleNumber = req.body.scheduleNumber ? Number(req.body.scheduleNumber) : null;
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
