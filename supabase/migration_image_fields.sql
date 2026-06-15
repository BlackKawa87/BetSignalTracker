-- ============================================================
-- Migration: add structured image-parse fields to signals
-- Run in Supabase SQL Editor
-- ============================================================

-- Market category (e.g. Corners, Cards, Bet Builder, Over Under, etc.)
alter table public.signals
  add column if not exists market_category text;

-- Bet selection (Over, Under, Yes, No, Home, Away, Draw, 1, X, 2)
alter table public.signals
  add column if not exists selection text;

-- Time period (Full Time, 1st Half, 1st 10 min, etc.)
alter table public.signals
  add column if not exists period text;

-- Numeric line/threshold as text (e.g. "9.5", "-1.5")
alter table public.signals
  add column if not exists line text;

-- Team for team-specific markets (Team Total Goals, Corners, etc.)
alter table public.signals
  add column if not exists team text;

-- Player name for player-prop markets (shots, shots on target)
alter table public.signals
  add column if not exists player text;

-- Whether this is a Bet Builder / Same Game Multi
alter table public.signals
  add column if not exists is_bet_builder boolean not null default false;

-- Bet Builder legs: [{market: string, selection: string, line: string|null}]
alter table public.signals
  add column if not exists legs jsonb;

-- Full AI JSON response stored for audit and re-parse
alter table public.signals
  add column if not exists ai_raw_json text;

-- URL of the source betting slip image (Supabase Storage or external URL)
alter table public.signals
  add column if not exists image_url text;

-- Indexes for common filter queries
create index if not exists signals_market_category_idx on public.signals(market_category);
create index if not exists signals_is_bet_builder_idx  on public.signals(is_bet_builder);
