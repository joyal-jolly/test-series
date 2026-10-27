-- =============================================================================
-- Migration: Add Question Paper Groups & Schedules
-- =============================================================================
-- Run this in your Supabase SQL Editor.
-- =============================================================================

-- 1. QUESTION PAPER GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.question_paper_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  "caLevel" TEXT NOT NULL DEFAULT 'Intermediate',
  "numSchedules" INTEGER NOT NULL DEFAULT 1,
  "numSubjectsPerSchedule" INTEGER NOT NULL DEFAULT 3,
  "createdBy" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure numSubjectsPerSchedule and caLevel columns exist if table was already created
ALTER TABLE public.question_paper_groups ADD COLUMN IF NOT EXISTS "caLevel" TEXT NOT NULL DEFAULT 'Intermediate';
ALTER TABLE public.question_paper_groups ADD COLUMN IF NOT EXISTS "numSubjectsPerSchedule" INTEGER NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_qp_groups_created ON public.question_paper_groups("createdAt");

-- 2. QUESTION PAPER SCHEDULES TABLE (Stores schedule-level settings like shared availableAt)
CREATE TABLE IF NOT EXISTS public.question_paper_schedules (
  id TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES public.question_paper_groups(id) ON DELETE CASCADE,
  "scheduleNumber" INTEGER NOT NULL,
  "availableAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("groupId", "scheduleNumber")
);

CREATE INDEX IF NOT EXISTS idx_qp_schedules_group ON public.question_paper_schedules("groupId");

-- 3. Add group/schedule columns to question_papers
-- groupId links a paper to a group
ALTER TABLE public.question_papers ADD COLUMN IF NOT EXISTS "groupId" TEXT REFERENCES public.question_paper_groups(id) ON DELETE SET NULL;
-- scheduleNumber is the schedule slot within the group (1-based)
ALTER TABLE public.question_papers ADD COLUMN IF NOT EXISTS "scheduleNumber" INTEGER;
-- availableAt is when the paper becomes accessible to students (synchronized from schedule)
ALTER TABLE public.question_papers ADD COLUMN IF NOT EXISTS "availableAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_question_papers_group ON public.question_papers("groupId");
CREATE INDEX IF NOT EXISTS idx_question_papers_sched ON public.question_papers("groupId", "scheduleNumber");

-- 4. RLS for groups table
ALTER TABLE public.question_paper_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_all_groups" ON public.question_paper_groups FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_read_groups" ON public.question_paper_groups FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. RLS for schedules table
ALTER TABLE public.question_paper_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_all_schedules" ON public.question_paper_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_read_schedules" ON public.question_paper_schedules FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
