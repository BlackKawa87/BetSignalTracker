-- ============================================================
-- BetSignalTracker — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Settings table (single row per user)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  initial_bankroll numeric(12, 2) not null default 1000.00,
  current_bankroll numeric(12, 2) not null default 1000.00,
  stake_percentage numeric(5, 2) not null default 2.00,
  preferred_bookmaker text not null default 'Bet365',
  main_strategy text not null default 'Ambas Marcam',
  telegram_bot_token text,
  updated_at timestamptz not null default now()
);

-- Signals table
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  home_team text,
  away_team text,
  market text,
  odd numeric(8, 2),
  competition text,
  bookmaker text,
  match_time text,
  stake numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'green', 'red', 'void')),
  profit_loss numeric(12, 2),
  raw_text text not null,
  telegram_message_id bigint,
  notes text
);

-- Bankroll history table
create table if not exists public.bankroll_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bankroll numeric(12, 2) not null,
  change numeric(12, 2) not null,
  reason text not null,
  signal_id uuid references public.signals(id) on delete set null
);

-- Indexes
create index if not exists signals_status_idx on public.signals(status);
create index if not exists signals_created_at_idx on public.signals(created_at desc);
create index if not exists bankroll_history_created_at_idx on public.bankroll_history(created_at desc);

-- Enable Row Level Security (disable for now — single user app)
alter table public.settings enable row level security;
alter table public.signals enable row level security;
alter table public.bankroll_history enable row level security;

-- Allow all access (anon key) for single-user setup
-- Replace with auth policies if you add authentication later
create policy "Allow all settings" on public.settings for all using (true) with check (true);
create policy "Allow all signals" on public.signals for all using (true) with check (true);
create policy "Allow all bankroll_history" on public.bankroll_history for all using (true) with check (true);
