-- Migration: add confidence_score to signals table
-- Run this in the Supabase SQL Editor

alter table public.signals
  add column if not exists confidence_score integer default null;

comment on column public.signals.confidence_score is
  'AI confidence score 0-100. < 80 = needs_review. NULL = pre-AI legacy signal.';

-- Index for review page queries (filter by status + sort by confidence)
create index if not exists signals_needs_review_idx
  on public.signals (status, confidence_score)
  where status = 'needs_review';
