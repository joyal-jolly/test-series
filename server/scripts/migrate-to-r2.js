import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { dbService } from '../src/db.js';
import { storageService, normalizeStorageKey } from '../src/storage.js';

const LOCAL_UPLOADS = path.resolve(__dirname, '../uploads');
const isDryRun = process.argv.includes('--dry-run');

console.log('='.repeat(70));
console.log(`Cloudflare R2 PDF Migration Utility ${isDryRun ? '[DRY RUN MODE]' : '[LIVE MODE]'}`);
console.log('='.repeat(70));
console.log(`R2 Active: ${storageService.isR2Active() ? 'YES (Uploading to R2)' : 'NO (R2 credentials not set in .env)'}`);
console.log(`Uploads Directory: ${LOCAL_UPLOADS}\n`);

async function runMigration() {
  const stats = {
    papers: { total: 0, found: 0, missing: 0, uploaded: 0, skipped: 0, failed: 0 },
    submissions: { total: 0, found: 0, missing: 0, uploaded: 0, skipped: 0, failed: 0 },
    drafts: { total: 0, uploaded: 0, skipped: 0, failed: 0 },
  };

  // ─── 1. Migrate Question Papers ─────────────────────────────────────────────
  console.log('--- Scanning Question Papers ---');
  try {
    const papers = await dbService.getQuestionPapers();
    stats.papers.total = papers.length;

    for (const paper of papers) {
      if (!paper.pdfUrl) continue;

      const filename = path.basename(paper.pdfUrl.split('?')[0]);
      const targetKey = `papers/${filename}`;
      const localPath = path.join(LOCAL_UPLOADS, 'papers', filename);

      const existsLocally = fs.existsSync(localPath);
      if (existsLocally) {
        stats.papers.found++;
      } else {
        stats.papers.missing++;
      }

      // Check if already in R2 and already updated in DB
      const alreadyUpdatedInDb = paper.pdfUrl.startsWith('/api/files/papers/');
      let alreadyInStorage = false;
      try {
        alreadyInStorage = await storageService.fileExists(targetKey);
      } catch {
        alreadyInStorage = false;
      }

      if (alreadyUpdatedInDb && alreadyInStorage) {
        stats.papers.skipped++;
        console.log(`  [SKIP] Paper "${paper.title}" already migrated (${targetKey})`);
        continue;
      }

      if (!existsLocally && !alreadyInStorage) {
        console.warn(`  [WARN] Local file missing for Paper "${paper.title}" (${filename})`);
        continue;
      }

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would migrate "${paper.title}": ${paper.pdfUrl} -> /api/files/${targetKey}`);
        stats.papers.uploaded++;
      } else {
        try {
          if (!alreadyInStorage && existsLocally) {
            const buffer = fs.readFileSync(localPath);
            await storageService.uploadFile({
              key: targetKey,
              buffer,
              contentType: 'application/pdf',
              metadata: { paperId: paper.id, title: paper.title },
            });
            console.log(`  [UPLOADED] "${paper.title}" -> ${targetKey}`);
          }
          await dbService.updateQuestionPaper(paper.id, {
            pdfUrl: `/api/files/${targetKey}`,
          });
          stats.papers.uploaded++;
          console.log(`  [UPDATED DB] Paper "${paper.title}" -> /api/files/${targetKey}`);
        } catch (err) {
          stats.papers.failed++;
          console.error(`  [ERROR] Failed to migrate paper "${paper.title}":`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error scanning question papers:', err.message);
  }

  // ─── 2. Migrate Student & Reviewer Submissions ─────────────────────────────
  console.log('\n--- Scanning Submissions ---');
  try {
    const submissions = await dbService.getSubmissions();
    stats.submissions.total = submissions.length;

    for (const sub of submissions) {
      if (!sub.answerFileUrl) continue;

      const filename = path.basename(sub.answerFileUrl.split('?')[0]);
      const targetKey = `answers/${filename}`;
      const localPath = path.join(LOCAL_UPLOADS, 'answers', filename);

      const existsLocally = fs.existsSync(localPath);
      if (existsLocally) {
        stats.submissions.found++;
      } else {
        stats.submissions.missing++;
      }

      const alreadyUpdatedInDb = sub.answerFileUrl.startsWith('/api/files/answers/');
      let alreadyInStorage = false;
      try {
        alreadyInStorage = await storageService.fileExists(targetKey);
      } catch {
        alreadyInStorage = false;
      }

      if (alreadyUpdatedInDb && alreadyInStorage) {
        stats.submissions.skipped++;
        console.log(`  [SKIP] Submission ${sub.id} already migrated (${targetKey})`);
        continue;
      }

      if (!existsLocally && !alreadyInStorage) {
        console.warn(`  [WARN] Local file missing for submission ${sub.id} (${filename})`);
        continue;
      }

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would migrate submission ${sub.id}: ${sub.answerFileUrl} -> /api/files/${targetKey}`);
        stats.submissions.uploaded++;
      } else {
        try {
          if (!alreadyInStorage && existsLocally) {
            const buffer = fs.readFileSync(localPath);
            const ext = path.extname(filename).toLowerCase();
            const contentType = ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'application/pdf';
            await storageService.uploadFile({
              key: targetKey,
              buffer,
              contentType,
              metadata: { submissionId: sub.id, originalName: sub.originalName || '' },
            });
            console.log(`  [UPLOADED] Submission ${sub.id} -> ${targetKey}`);
          }
          await dbService.updateSubmission(sub.id, {
            answerFileUrl: `/api/files/${targetKey}`,
          });
          stats.submissions.uploaded++;
          console.log(`  [UPDATED DB] Submission ${sub.id} -> /api/files/${targetKey}`);
        } catch (err) {
          stats.submissions.failed++;
          console.error(`  [ERROR] Failed to migrate submission ${sub.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error scanning submissions:', err.message);
  }

  // ─── 3. Migrate Local Draft Annotations ────────────────────────────────────
  console.log('\n--- Scanning Draft Annotations ---');
  const draftsDir = path.join(LOCAL_UPLOADS, 'drafts');
  if (fs.existsSync(draftsDir)) {
    const files = fs.readdirSync(draftsDir).filter((f) => f.endsWith('.json'));
    stats.drafts.total = files.length;

    for (const file of files) {
      const targetKey = `drafts/${file}`;
      const filePath = path.join(draftsDir, file);

      let alreadyInStorage = false;
      try {
        alreadyInStorage = await storageService.fileExists(targetKey);
      } catch {
        alreadyInStorage = false;
      }

      if (alreadyInStorage) {
        stats.drafts.skipped++;
        console.log(`  [SKIP] Draft ${file} already in storage`);
        continue;
      }

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would upload draft ${file} -> ${targetKey}`);
        stats.drafts.uploaded++;
      } else {
        try {
          const buffer = fs.readFileSync(filePath);
          await storageService.uploadFile({
            key: targetKey,
            buffer,
            contentType: 'application/json',
          });
          stats.drafts.uploaded++;
          console.log(`  [UPLOADED] Draft ${file} -> ${targetKey}`);
        } catch (err) {
          stats.drafts.failed++;
          console.error(`  [ERROR] Failed to upload draft ${file}:`, err.message);
        }
      }
    }
  } else {
    console.log('  No local drafts directory found.');
  }

  // ─── Final Summary Report ──────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION REPORT SUMMARY');
  console.log('='.repeat(70));
  console.table({
    'Question Papers': {
      'Total Inspected': stats.papers.total,
      'Files Found': stats.papers.found,
      'Files Missing': stats.papers.missing,
      'Uploaded / Updated': stats.papers.uploaded,
      'Already Migrated': stats.papers.skipped,
      'Failed': stats.papers.failed,
    },
    'Submissions': {
      'Total Inspected': stats.submissions.total,
      'Files Found': stats.submissions.found,
      'Files Missing': stats.submissions.missing,
      'Uploaded / Updated': stats.submissions.uploaded,
      'Already Migrated': stats.submissions.skipped,
      'Failed': stats.submissions.failed,
    },
    'Draft JSONs': {
      'Total Inspected': stats.drafts.total,
      'Files Found': stats.drafts.total,
      'Files Missing': 0,
      'Uploaded / Updated': stats.drafts.uploaded,
      'Already Migrated': stats.drafts.skipped,
      'Failed': stats.drafts.failed,
    },
  });
  console.log('Note: Local filesystem backups were PRESERVED and not deleted.');
  console.log('='.repeat(70) + '\n');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  });
