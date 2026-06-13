-- ============================================================
-- Migration: Add processing_logs table
-- Run this in the Supabase SQL Editor
-- ============================================================

create table if not exists public.processing_logs (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  signal_id  uuid        references public.signals(id) on delete cascade,
  action     text        not null,
  details    jsonb       not null default '{}',
  result     text
);

create index if not exists processing_logs_signal_id_idx  on public.processing_logs(signal_id);
create index if not exists processing_logs_created_at_idx on public.processing_logs(created_at desc);
create index if not exists processing_logs_action_idx     on public.processing_logs(action);

alter table public.processing_logs enable row level security;

drop policy if exists "Allow all processing_logs" on public.processing_logs;
create policy "Allow all processing_logs"
  on public.processing_logs for all using (true) with check (true);
