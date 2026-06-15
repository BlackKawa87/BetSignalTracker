-- ============================================================
-- Migration: telegram_fields
-- Adds structured Telegram source metadata to signals table.
-- Run in Supabase SQL Editor (idempotent).
-- ============================================================

-- caption_text: text typed by the tipster alongside the image
alter table public.signals
  add column if not exists caption_text text;

-- telegram_file_id: Telegram file_id for re-downloading the original image
alter table public.signals
  add column if not exists telegram_file_id text;

-- source_type: how the signal arrived
--   values: text | image | image_with_caption | document_image | unknown
alter table public.signals
  add column if not exists source_type text;

-- forwarded_from: channel/user the message was forwarded from
alter table public.signals
  add column if not exists forwarded_from text;

-- stake_percentage_from_signal: tipster recommended stake % extracted by AI
--   (distinct from the user's banca stake_percentage setting)
alter table public.signals
  add column if not exists stake_percentage_from_signal numeric(6,2);

-- Index to filter by source type quickly
create index if not exists signals_source_type_idx
  on public.signals(source_type);
