-- =============================================================================
-- Migration: Add price to Question Paper Groups
-- =============================================================================
-- Run this in your Supabase Dashboard SQL Editor.
-- =============================================================================

ALTER TABLE public.question_paper_groups 
  ADD COLUMN IF NOT EXISTS price NUMERIC NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
