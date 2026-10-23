import { Router } from 'express';
import { dbService } from '../db.js';
import { optionalAuth } from '../middleware.js';

const router = Router();

function withSubject(paper, subjects) {
  const subject = subjects.find((s) => s.id === paper.subjectId);
  return {
    ...paper,
    subjectName: subject?.name || 'Unknown',
  };
}

router.get('/subjects', async (_req, res, next) => {
  try {
    const subjects = await dbService.getSubjects();
    res.json({ subjects: subjects.filter((s) => s.status === 'active') });
  } catch (err) {
    next(err);
  }
});

// ─── Groups listing (public) ──────────────────────────────────────────
router.get('/groups', optionalAuth, async (_req, res, next) => {
  try {
    const [groups, allPapers, subjects, allSchedules] = await Promise.all([
      dbService.getQuestionPaperGroups(),
      dbService.getQuestionPapers(),
      dbService.getSubjects(),
      dbService.getAllSchedules(),
    ]);

    const now = new Date();

    const enrichedGroups = groups.map((g) => {
      const maxSubjects = g.numSubjectsPerSchedule || 3;
      const papers = allPapers.filter((p) => p.groupId === g.id && p.status === 'published');
      const groupSchedules = allSchedules.filter((s) => s.groupId === g.id);

      const schedules = [];
      for (let i = 1; i <= g.numSchedules; i++) {
        const schedRecord = groupSchedules.find((s) => s.scheduleNumber === i);
        const schedPapers = papers.filter((p) => p.scheduleNumber === i);
        const availableAt = schedRecord?.availableAt || schedPapers[0]?.availableAt || null;
        const isAvailable = availableAt ? new Date(availableAt) <= now : true;

        const enrichedPapers = schedPapers.map((paper) => {
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
            availableAt,
            isAvailable,
          };
        });

        schedules.push({
          scheduleNumber: i,
          availableAt,
          isAvailable,
          numSubjectsExpected: maxSubjects,
          papers: enrichedPapers,
          status: enrichedPapers.length >= maxSubjects ? 'uploaded' : enrichedPapers.length > 0 ? 'in_progress' : 'pending',
        });
      }

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        numSchedules: g.numSchedules,
        numSubjectsPerSchedule: maxSubjects,
        schedules,
        availableSchedulesCount: schedules.filter((s) => s.isAvailable).length,
        totalSchedules: schedules.length,
      };
    });

    res.json({ groups: enrichedGroups });
  } catch (err) {
    next(err);
  }
});

// ─── Single Group details (public) ────────────────────────────────────
router.get('/groups/:groupId', optionalAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const [group, allPapers, subjects, groupSchedules] = await Promise.all([
      dbService.getQuestionPaperGroupById(groupId),
      dbService.getQuestionPapers(),
      dbService.getSubjects(),
      dbService.getSchedulesByGroup(groupId),
    ]);

    if (!group) return res.status(404).json({ error: 'Question paper group not found' });

    const now = new Date();
    const maxSubjects = group.numSubjectsPerSchedule || 3;
    const papers = allPapers.filter((p) => p.groupId === group.id && p.status === 'published');

    const schedules = [];
    for (let i = 1; i <= group.numSchedules; i++) {
      const schedRecord = groupSchedules.find((s) => s.scheduleNumber === i);
      const schedPapers = papers.filter((p) => p.scheduleNumber === i);
      const availableAt = schedRecord?.availableAt || schedPapers[0]?.availableAt || null;
      const isAvailable = availableAt ? new Date(availableAt) <= now : true;

      const enrichedPapers = schedPapers.map((paper) => {
        const subject = subjects.find((s) => s.id === paper.subjectId);
        return {
          id: paper.id,
          title: paper.title,
          description: paper.description,
          subjectId: paper.subjectId,
          subjectName: subject?.name || 'Unknown',
          caLevel: paper.caLevel,
          paperType: paper.paperType,
          chapter: paper.chapter || '',
          totalMarks: paper.totalMarks,
          durationMinutes: paper.durationMinutes,
          availableAt,
          isAvailable,
        };
      });

      schedules.push({
        scheduleNumber: i,
        availableAt,
        isAvailable,
        numSubjectsExpected: maxSubjects,
        papers: enrichedPapers,
        status: enrichedPapers.length >= maxSubjects ? 'uploaded' : enrichedPapers.length > 0 ? 'in_progress' : 'pending',
      });
    }

    res.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        numSchedules: group.numSchedules,
        numSubjectsPerSchedule: maxSubjects,
        schedules,
        availableSchedulesCount: schedules.filter((s) => s.isAvailable).length,
        totalSchedules: schedules.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, caLevel, subjectId, paperType, status } = req.query;
    const [allPapers, subjects, groups] = await Promise.all([
      dbService.getQuestionPapers(),
      dbService.getSubjects(),
      dbService.getQuestionPaperGroups(),
    ]);

    let papers = allPapers;
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin) {
      papers = papers.filter((p) => p.status === 'published');
    } else if (status) {
      papers = papers.filter((p) => p.status === status);
    }

    if (caLevel) papers = papers.filter((p) => p.caLevel === caLevel);
    if (subjectId) papers = papers.filter((p) => p.subjectId === subjectId);
    if (paperType) papers = papers.filter((p) => p.paperType === paperType);
    if (q) {
      const term = String(q).toLowerCase();
      papers = papers.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          (p.description || '').toLowerCase().includes(term) ||
          (p.chapter || '').toLowerCase().includes(term)
      );
    }

    const now = new Date();
    papers = papers
      .map((p) => {
        const subject = subjects.find((s) => s.id === p.subjectId);
        const group = p.groupId ? groups.find((g) => g.id === p.groupId) : null;
        const isAvailable = p.availableAt ? new Date(p.availableAt) <= now : true;
        return {
          ...p,
          subjectName: subject?.name || 'Unknown',
          groupName: group?.name || null,
          isAvailable,
        };
      })
      .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));

    res.json({ papers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const [paper, subjects, groups] = await Promise.all([
      dbService.getQuestionPaperById(req.params.id),
      dbService.getSubjects(),
      dbService.getQuestionPaperGroups(),
    ]);

    if (!paper) return res.status(404).json({ error: 'Question paper not found' });

    const isAdmin = req.user?.role === 'admin';
    if (paper.status !== 'published' && !isAdmin) {
      return res.status(404).json({ error: 'Question paper not found' });
    }

    const group = paper.groupId ? groups.find((g) => g.id === paper.groupId) : null;
    const enriched = {
      ...withSubject(paper, subjects),
      groupName: group?.name || null,
      groupDescription: group?.description || null,
    };

    // Scheduled access control
    const now = new Date();
    const isScheduledFuture = paper.availableAt && new Date(paper.availableAt) > now;

    if (!isAdmin && isScheduledFuture) {
      const availDate = new Date(paper.availableAt);
      // Return safe metadata only: STRIP pdfUrl and questions so student cannot view/download
      const { pdfUrl, questions, ...safePaper } = enriched;
      return res.json({
        paper: {
          ...safePaper,
          pdfUrl: null,
          questions: [],
          isAvailable: false,
          availableAt: paper.availableAt,
          availableMessage: `Available on ${availDate.toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })} at ${availDate.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        },
      });
    }

    res.json({
      paper: {
        ...enriched,
        isAvailable: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
