-- =============================================================================
-- Migration: Create group_result_publications table
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.group_result_publications (
  id TEXT PRIMARY KEY,                          -- composite: studentId_groupId
  "studentId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "groupId" TEXT NOT NULL REFERENCES public.question_paper_groups(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  feedback TEXT DEFAULT NULL,
  "isPassed" BOOLEAN NOT NULL DEFAULT FALSE,
  "totalMarksAwarded" NUMERIC NOT NULL DEFAULT 0,
  "totalMaxMarks" NUMERIC NOT NULL DEFAULT 0,
  "overallPct" NUMERIC DEFAULT NULL,
  "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "publishedBy" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("studentId", "groupId")
);

CREATE INDEX IF NOT EXISTS idx_grp_results_student ON public.group_result_publications("studentId");
CREATE INDEX IF NOT EXISTS idx_grp_results_group ON public.group_result_publications("groupId");

-- RLS
ALTER TABLE public.group_result_publications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_all_grp_results"
    ON public.group_result_publications FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
