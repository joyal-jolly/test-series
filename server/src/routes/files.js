import { Router } from 'express';
import path from 'path';
import { dbService } from '../db.js';
import { optionalAuth } from '../middleware.js';
import { getFile, normalizeStorageKey } from '../storage.js';

const router = Router();

// Handle Range / Streaming responses from storage
async function streamFileToResponse(req, res, fileKey, fallbackFilename = 'document.pdf') {
  const bucket = req.app.get('r2');
  const range = req.headers.range;
  const file = await getFile(bucket, fileKey, { range });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filename = path.basename(fileKey) || fallbackFilename;
  const contentType = file.contentType || 'application/pdf';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  if (file.lastModified) {
    res.setHeader('Last-Modified', new Date(file.lastModified).toUTCString());
  }

  if (file.contentRange) {
    res.status(206);
    res.setHeader('Content-Range', file.contentRange);
    if (file.contentLength != null) {
      res.setHeader('Content-Length', file.contentLength);
    }
  } else {
    res.status(file.status || 200);
    if (file.contentLength != null) {
      res.setHeader('Content-Length', file.contentLength);
    }
  }

  if (req.method === 'HEAD') {
    return res.end();
  }

  if (file.stream) {
    // Check if it is a Web ReadableStream (Cloudflare Workers or newer SDK)
    if (typeof file.stream.getReader === 'function') {
      const reader = file.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Ensure chunk is delivered as Buffer for cross-environment compatibility
          const chunk = Buffer.isBuffer(value)
            ? value
            : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
          res.write(chunk);
        }
        return res.end();
      } catch (streamErr) {
        console.error(`[Files] Error streaming Web ReadableStream for "${fileKey}":`, streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream file' });
        }
        return res.end();
      }
    }

    // Node.js Stream
    file.stream.pipe(res);
    file.stream.on('error', (err) => {
      console.error(`[Files] Stream error for key "${fileKey}":`, err);
      if (!res.headersSent) res.status(500).end();
    });
  } else if (file.buffer) {
    res.end(file.buffer);
  } else {
    res.status(500).json({ error: 'Unable to stream file' });
  }
}

// ─── Question Papers Endpoint ───────────────────────────────────────────────
// Accessible via:
//   GET /api/files/papers/:ref
//   HEAD /api/files/papers/:ref
// Where :ref can be a paper ID, ID with .pdf, or filename
router.all('/papers/:ref', optionalAuth, async (req, res, next) => {
  try {
    const { ref } = req.params;
    let paper = null;
    let fileKey = null;
    const cleanRef = ref.replace(/\.pdf$/i, '');

    // Check if ref is a paper ID
    paper = (await dbService.getQuestionPaperById(ref)) || (await dbService.getQuestionPaperById(cleanRef));

    if (paper) {
      fileKey = normalizeStorageKey(paper.pdfUrl);
    } else {
      // ref might be a filename or key e.g. "uuid.pdf"
      fileKey = ref.startsWith('papers/') ? ref : `papers/${ref}`;
      const normalizedTarget = normalizeStorageKey(fileKey);
      const allPapers = await dbService.getQuestionPapers();
      paper = allPapers.find((p) => p.pdfUrl && normalizeStorageKey(p.pdfUrl) === normalizedTarget);
    }

    if (!fileKey) {
      return res.status(404).json({ error: 'Paper file not found' });
    }

    // Permission checks
    const user = req.user;
    if (user?.role === 'admin' || user?.role === 'reviewer') {
      // Admins and reviewers have full access to question papers
      return streamFileToResponse(req, res, fileKey, `${paper?.title || 'paper'}.pdf`);
    }

    // For students and unauthenticated users:
    if (paper) {
      // Check if scheduled
      if (paper.availableAt && new Date(paper.availableAt) > new Date()) {
        // If paper is scheduled for the future, only a student currently attempting it can view
        if (!user) {
          return res.status(401).json({ error: 'Authentication required for scheduled paper' });
        }
        const attempts = await dbService.getAttemptsByStudent(user.id);
        const activeAttempt = attempts.find(
          (a) => a.questionPaperId === paper.id && ['in_progress', 'evaluated', 'submitted'].includes(a.status)
        );
        if (!activeAttempt) {
          return res.status(403).json({ error: 'This paper is not available yet' });
        }
      }
    }

    // Deliver file
    return streamFileToResponse(req, res, fileKey, `${paper?.title || 'paper'}.pdf`);
  } catch (err) {
    next(err);
  }
});

// ─── Student Answers Endpoint ───────────────────────────────────────────────
// Accessible via:
//   GET /api/files/answers/:ref
//   HEAD /api/files/answers/:ref
// Where :ref can be a submission ID, submission ID with .pdf, attempt ID, or filename
router.all('/answers/:ref', optionalAuth, async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to view answer files' });
    }

    const { ref } = req.params;
    let submission = null;
    const cleanRef = ref.replace(/\.pdf$/i, '');

    // 1. Try finding submission by ID (with or without .pdf extension)
    submission = (await dbService.getSubmissionById(ref)) || (await dbService.getSubmissionById(cleanRef));

    // 2. Try finding by attempt ID
    if (!submission) {
      const allSubmissions = await dbService.getSubmissions();
      submission = allSubmissions.find((s) => s.attemptId === ref || s.attemptId === cleanRef);
    }

    // 3. Try finding by filename/key
    let fileKey = null;
    if (submission) {
      fileKey = normalizeStorageKey(submission.answerFileUrl);
    } else {
      fileKey = ref.startsWith('answers/') ? ref : `answers/${ref}`;
      const normalizedTarget = normalizeStorageKey(fileKey);
      const allSubmissions = await dbService.getSubmissions();
      submission = allSubmissions.find(
        (s) => s.answerFileUrl && normalizeStorageKey(s.answerFileUrl) === normalizedTarget
      );
    }

    if (!submission && user.role !== 'admin') {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Permission checks:
    // Admin: allowed
    // Reviewer: allowed if assigned to this submission
    // Student: allowed only if this submission belongs to them
    if (user.role === 'admin') {
      // Full access
    } else if (user.role === 'reviewer') {
      if (submission && submission.assignedReviewerId && submission.assignedReviewerId !== user.id) {
        return res.status(403).json({ error: 'You are not assigned to review this submission' });
      }
    } else if (user.role === 'student') {
      if (submission && submission.studentId !== user.id) {
        return res.status(403).json({ error: 'You are not authorized to view this submission' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    return streamFileToResponse(req, res, fileKey, submission?.originalName || 'answer.pdf');
  } catch (err) {
    next(err);
  }
});

export default router;
