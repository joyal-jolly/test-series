-- =============================================================================
-- Mentaura CA Residential Campus - Assessment & Evaluation Portal
-- Supabase PostgreSQL Schema & Initial Seed Data
-- =============================================================================
-- Run this complete script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student', 'reviewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- -----------------------------------------------------------------------------
-- 2. SUBJECTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "caLevel" TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_calevel ON public.subjects("caLevel");
CREATE INDEX IF NOT EXISTS idx_subjects_status ON public.subjects(status);

-- -----------------------------------------------------------------------------
-- 3. QUESTION PAPERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  "subjectId" TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  "caLevel" TEXT NOT NULL,
  "paperType" TEXT NOT NULL,
  chapter TEXT DEFAULT '',
  description TEXT DEFAULT '',
  "totalMarks" INTEGER NOT NULL DEFAULT 100,
  "durationMinutes" INTEGER NOT NULL DEFAULT 180,
  "pdfUrl" TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  "publishedAt" TIMESTAMPTZ,
  "createdBy" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_papers_status ON public.question_papers(status);
CREATE INDEX IF NOT EXISTS idx_question_papers_subject ON public.question_papers("subjectId");
CREATE INDEX IF NOT EXISTS idx_question_papers_calevel ON public.question_papers("caLevel");
CREATE INDEX IF NOT EXISTS idx_question_papers_type ON public.question_papers("paperType");

-- -----------------------------------------------------------------------------
-- 4. ATTEMPTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attempts (
  id TEXT PRIMARY KEY,
  "questionPaperId" TEXT NOT NULL REFERENCES public.question_papers(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "submittedAt" TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'not_started', 'submitted', 'assigned', 'under_review', 'evaluated', 'abandoned')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON public.attempts("studentId");
CREATE INDEX IF NOT EXISTS idx_attempts_paper ON public.attempts("questionPaperId");
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.attempts(status);

-- -----------------------------------------------------------------------------
-- 5. SUBMISSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  "attemptId" TEXT NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "questionPaperId" TEXT NOT NULL REFERENCES public.question_papers(id) ON DELETE CASCADE,
  "answerFileUrl" TEXT NOT NULL,
  "originalName" TEXT,
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'assigned', 'under_review', 'evaluated')),
  "assignedReviewerId" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "assignedAt" TIMESTAMPTZ,
  "draftFeedback" TEXT DEFAULT '',
  "draftSavedAt" TIMESTAMPTZ,
  "draftAnnotations" JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_attempt ON public.submissions("attemptId");
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions("studentId");
CREATE INDEX IF NOT EXISTS idx_submissions_reviewer ON public.submissions("assignedReviewerId");
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);

-- -----------------------------------------------------------------------------
-- 6. EVALUATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluations (
  id TEXT PRIMARY KEY,
  "submissionId" TEXT NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  "reviewerId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "totalMarks" NUMERIC NOT NULL DEFAULT 0,
  feedback TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed')),
  "evaluatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON public.evaluations("submissionId");
CREATE INDEX IF NOT EXISTS idx_evaluations_reviewer ON public.evaluations("reviewerId");

-- -----------------------------------------------------------------------------
-- 7. QUESTION EVALUATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_evaluations (
  id TEXT PRIMARY KEY,
  "evaluationId" TEXT NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  "questionId" TEXT NOT NULL,
  "marksAwarded" NUMERIC NOT NULL DEFAULT 0,
  "maximumMarks" NUMERIC NOT NULL DEFAULT 0,
  feedback TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_qe_evaluation ON public.question_evaluations("evaluationId");

-- -----------------------------------------------------------------------------
-- 8. CONTACT MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT DEFAULT 'General enquiry',
  message TEXT NOT NULL,
  "userId" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. SUPABASE STORAGE BUCKETS (OPTIONAL FOR CLOUD PDF STORAGE)
-- -----------------------------------------------------------------------------
-- Create storage buckets for question paper PDFs and student answers
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('papers', 'papers', true),
  ('answers', 'answers', false)
ON CONFLICT (id) DO NOTHING;

-- Public can view question papers
CREATE POLICY "Public Access to Papers"
ON storage.objects FOR SELECT
USING (bucket_id = 'papers');

-- Authenticated service role can manage answers
CREATE POLICY "Allow All for Answers"
ON storage.objects FOR ALL
USING (bucket_id = 'answers');

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
-- The Express backend uses SUPABASE_SERVICE_ROLE_KEY which automatically
-- bypasses RLS for trusted server operations.
-- We enable RLS on all tables and grant full access to service_role.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (used by Express backend)
DO $$
BEGIN
  CREATE POLICY "service_role_all_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_subjects" ON public.subjects FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_papers" ON public.question_papers FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_attempts" ON public.attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_submissions" ON public.submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_evaluations" ON public.evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_qe" ON public.question_evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all_contact" ON public.contact_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow public read access to active subjects and published papers
DO $$
BEGIN
  CREATE POLICY "anon_read_subjects" ON public.subjects FOR SELECT TO anon, authenticated USING (status = 'active');
  CREATE POLICY "anon_read_papers" ON public.question_papers FOR SELECT TO anon, authenticated USING (status = 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 11. INITIAL SEED DATA
-- =============================================================================

-- Seed Subjects
INSERT INTO public.subjects (id, name, "caLevel", description, status)
VALUES
  ('sub-adv-acc', 'Advanced Accounting', 'Intermediate', 'Corporate accounting, amalgamation, and consolidation.', 'active'),
  ('sub-tax', 'Taxation', 'Intermediate', 'Income tax and GST fundamentals.', 'active'),
  ('sub-cost', 'Cost & Management Accounting', 'Intermediate', 'Costing methods and decision making.', 'active'),
  ('sub-audit', 'Auditing & Assurance', 'Final', 'Standards on auditing and assurance.', 'active'),
  ('sub-fm', 'Financial Management', 'Final', 'Capital budgeting, working capital, and valuation.', 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "caLevel" = EXCLUDED."caLevel",
  description = EXCLUDED.description;

-- Seed Default Demo Users (passwords: admin123, student123, reviewer123)
INSERT INTO public.users (id, name, email, "passwordHash", role, status, profile)
VALUES
  (
    'user-admin',
    'Academy Admin',
    'admin@caacademy.com',
    '$2a$10$clicrhlGfcub/SP6IoRrpuvZfj4CYjXwax3GVW.foO0KbzZCZa8sm',
    'admin',
    'active',
    '{}'::jsonb
  ),
  (
    'user-student',
    'Rahul Sharma',
    'student@caacademy.com',
    '$2a$10$6PJYZPgT8oFyoftHpfRJpe887m9SqyEMphrb1WU4XOQkQdIrS7eri',
    'student',
    'active',
    '{"studentId": "CA-INT-1001", "caLevel": "Intermediate", "batch": "May 2027", "phone": "9876543210"}'::jsonb
  ),
  (
    'user-student-2',
    'Anu Nair',
    'anu@caacademy.com',
    '$2a$10$1g6Jk.kpAACY9AIdUqP3YOhuR01SI/Vz8Z939yd3GH55I3GhDCN86',
    'student',
    'active',
    '{"studentId": "CA-INT-1002", "caLevel": "Intermediate", "batch": "May 2027", "phone": "9876543211"}'::jsonb
  ),
  (
    'user-reviewer',
    'CA Anil Kumar',
    'reviewer@caacademy.com',
    '$2a$10$uSGfMpYGAKqGtvwoxOHOS.UIsIisnmks0mgi1seDIdonm0KhZkpXO',
    'reviewer',
    'active',
    '{"qualification": "CA", "specialization": "Accounting & Taxation"}'::jsonb
  ),
  (
    'user-reviewer-2',
    'CA Priya Menon',
    'priya@caacademy.com',
    '$2a$10$nRtcnXNcoMLC66HgH9yYUeTz/1qv/EswznPb0JFBKt6mZ4qQMBF9m',
    'reviewer',
    'active',
    '{"qualification": "CA", "specialization": "Costing & FM"}'::jsonb
  )
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  "passwordHash" = EXCLUDED."passwordHash",
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  profile = EXCLUDED.profile;

-- Seed Sample Question Papers
INSERT INTO public.question_papers (
  id, title, "subjectId", "caLevel", "paperType", chapter, description,
  "totalMarks", "durationMinutes", "pdfUrl", status, "publishedAt", "createdBy", questions
)
VALUES
  (
    'qp-acc-01',
    'Advanced Accounting - Test 01',
    'sub-adv-acc',
    'Intermediate',
    'Chapter Test',
    'Amalgamation',
    'Chapter test covering amalgamation of companies and related working notes.',
    100,
    180,
    NULL,
    'published',
    NOW(),
    'user-admin',
    '[
      {"id": "q1", "number": 1, "maxMarks": 20, "prompt": "Explain the accounting treatment for amalgamation in the nature of merger."},
      {"id": "q2", "number": 2, "maxMarks": 30, "prompt": "Prepare journal entries for purchase consideration and related adjustments."},
      {"id": "q3", "number": 3, "maxMarks": 25, "prompt": "Prepare a balance sheet after amalgamation with working notes."},
      {"id": "q4", "number": 4, "maxMarks": 25, "prompt": "Discuss disclosure requirements under the relevant accounting standard."}
    ]'::jsonb
  ),
  (
    'qp-tax-01',
    'Taxation - Mock Test 01',
    'sub-tax',
    'Intermediate',
    'Mock Test',
    'Income from Business',
    'Full mock covering computation of business income and deductions.',
    100,
    180,
    NULL,
    'published',
    NOW(),
    'user-admin',
    '[
      {"id": "q1", "number": 1, "maxMarks": 25, "prompt": "Compute taxable business income from the given trial balance."},
      {"id": "q2", "number": 2, "maxMarks": 25, "prompt": "Explain allowability of the listed expenditures under the Income Tax Act."},
      {"id": "q3", "number": 3, "maxMarks": 25, "prompt": "Compute GST liability for the sample transactions."},
      {"id": "q4", "number": 4, "maxMarks": 25, "prompt": "Advise on advance tax and interest under sections 234A/B/C."}
    ]'::jsonb
  ),
  (
    'qp-cost-01',
    'Costing - Revision Test 01',
    'sub-cost',
    'Intermediate',
    'Revision Test',
    'Marginal Costing',
    'Revision problems on CVP analysis and decision making.',
    50,
    90,
    NULL,
    'published',
    NOW(),
    'user-admin',
    '[
      {"id": "q1", "number": 1, "maxMarks": 15, "prompt": "Compute BEP and margin of safety from the given data."},
      {"id": "q2", "number": 2, "maxMarks": 20, "prompt": "Advise make-or-buy decision with supporting computations."},
      {"id": "q3", "number": 3, "maxMarks": 15, "prompt": "Prepare a marginal cost statement and interpret results."}
    ]'::jsonb
  ),
  (
    'qp-audit-01',
    'Auditing - Model Exam',
    'sub-audit',
    'Final',
    'Model Exam',
    'SA Overview',
    'Model exam style questions on standards on auditing.',
    100,
    180,
    NULL,
    'draft',
    NULL,
    'user-admin',
    '[
      {"id": "q1", "number": 1, "maxMarks": 20, "prompt": "Discuss SA 200 and the overall objectives of the independent auditor."},
      {"id": "q2", "number": 2, "maxMarks": 30, "prompt": "Explain risk assessment procedures under SA 315."},
      {"id": "q3", "number": 3, "maxMarks": 25, "prompt": "Draft an unmodified audit report with required elements."},
      {"id": "q4", "number": 4, "maxMarks": 25, "prompt": "Explain auditor responsibilities relating to fraud under SA 240."}
    ]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
