-- Migration: add needs_review to signals status constraint
-- Run this in the Supabase SQL Editor

ALTER TABLE public.signals
  DROP CONSTRAINT IF EXISTS signals_status_check;

ALTER TABLE public.signals
  ADD CONSTRAINT signals_status_check
  CHECK (status IN ('pending', 'green', 'red', 'void', 'needs_review'));
