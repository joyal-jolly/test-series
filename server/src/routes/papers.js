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

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, caLevel, subjectId, paperType, status } = req.query;
    const [allPapers, subjects] = await Promise.all([
      dbService.getQuestionPapers(),
      dbService.getSubjects(),
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

    papers = papers
      .map((p) => withSubject(p, subjects))
      .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));

    res.json({ papers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const [paper, subjects] = await Promise.all([
      dbService.getQuestionPaperById(req.params.id),
      dbService.getSubjects(),
    ]);

    if (!paper) return res.status(404).json({ error: 'Question paper not found' });

    const isAdmin = req.user?.role === 'admin';
    if (paper.status !== 'published' && !isAdmin) {
      return res.status(404).json({ error: 'Question paper not found' });
    }

    res.json({ paper: withSubject(paper, subjects) });
  } catch (err) {
    next(err);
  }
});

export default router;
