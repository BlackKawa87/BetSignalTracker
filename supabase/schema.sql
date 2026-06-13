-- ============================================================
-- BetSignalTracker — Supabase Schema (canonical, idempotent)
-- Run this in the Supabase SQL Editor to set up or reset the DB
-- ============================================================

-- ── Settings ─────────────────────────────────────────────────
create table if not exists public.settings (
  id                  uuid          primary key default gen_random_uuid(),
  initial_bankroll    numeric(12,2) not null default 1000.00,
  current_bankroll    numeric(12,2) not null default 1000.00,
  stake_percentage    numeric(5,2)  not null default 2.00,
  preferred_bookmaker text          not null default 'Bet365',
  main_strategy       text          not null default 'Ambas Marcam',
  telegram_bot_token  text,
  updated_at          timestamptz   not null default now()
);

-- ── Signals ──────────────────────────────────────────────────
create table if not exists public.signals (
  id                  uuid          primary key default gen_random_uuid(),
  created_at          timestamptz   not null default now(),
  received_at         timestamptz   not null default now(),
  home_team           text,
  away_team           text,
  market              text,
  odd                 numeric(8,2),
  competition         text,
  bookmaker           text,
  match_time          text,
  stake               numeric(12,2) not null default 0,
  status              text          not null default 'pending',
  profit_loss         numeric(12,2),
  raw_text            text          not null default '',
  telegram_message_id bigint,
  notes               text,
  updated_at          timestamptz   not null default now()
);

-- Recreate status check so needs_review is always included
alter table public.signals drop constraint if exists signals_status_check;
alter table public.signals
  add constraint signals_status_check
  check (status in ('pending', 'needs_review', 'green', 'red', 'void'));

-- ── Bankroll History ─────────────────────────────────────────
create table if not exists public.bankroll_history (
  id         uuid          primary key default gen_random_uuid(),
  created_at timestamptz   not null default now(),
  bankroll   numeric(12,2) not null,
  change     numeric(12,2) not null,
  reason     text          not null,
  signal_id  uuid          references public.signals(id) on delete set null
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists signals_status_idx     on public.signals(status);
create index if not exists signals_created_at_idx on public.signals(created_at desc);
create index if not exists signals_received_at_idx on public.signals(received_at desc);
create index if not exists bh_created_at_idx      on public.bankroll_history(created_at desc);

-- ── Row Level Security ───────────────────────────────────────
alter table public.settings         enable row level security;
alter table public.signals          enable row level security;
alter table public.bankroll_history enable row level security;

drop policy if exists "Allow all settings"         on public.settings;
drop policy if exists "Allow all signals"          on public.signals;
drop policy if exists "Allow all bankroll_history" on public.bankroll_history;

create policy "Allow all settings"
  on public.settings for all using (true) with check (true);

create policy "Allow all signals"
  on public.signals for all using (true) with check (true);

create policy "Allow all bankroll_history"
  on public.bankroll_history for all using (true) with check (true);
