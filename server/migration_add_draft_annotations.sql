-- =============================================================================
-- Migration: Add draftAnnotations column to submissions table
-- Run this query in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- =============================================================================

ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS "draftAnnotations" JSONB DEFAULT NULL;
