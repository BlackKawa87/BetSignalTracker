# BetSignalTracker — Deploy Checklist

## Pre-deploy (local)

- [ ] `cd frontend && npm run build` — zero errors
- [ ] `cd backend && npx tsc --noEmit` — zero errors
- [ ] `.env` files are in `.gitignore` — verify with `git status`
- [ ] No hardcoded tokens, URLs or secrets in source code
- [ ] `supabase/schema.sql` is the canonical schema (idempotent)

## Supabase

- [ ] Project created and region chosen
- [ ] **Run** `supabase/schema.sql` in SQL Editor
- [ ] **Run** `supabase/migration_processing_logs.sql`
- [ ] **Run** `supabase/migration_confidence_score.sql`
- [ ] Verify tables: `settings`, `signals`, `bankroll_history`, `processing_logs`
- [ ] RLS is **enabled** on all tables
- [ ] Initial settings row exists (app creates it on first load if missing)
- [ ] Note down: **Project URL**, **anon key**, **service_role key**

## Vercel Environment Variables

Set in: Vercel Dashboard → Project → Settings → Environment Variables → Production

### Backend (no VITE_ prefix)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `TELEGRAM_WEBHOOK_SECRET`
- [ ] `PUBLIC_WEBHOOK_URL` (your Vercel deployment URL)
- [ ] `OPENAI_API_KEY`
- [ ] `SPORTS_API_KEY`
- [ ] `CRON_SECRET`

### Frontend (VITE_ prefix required)
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`

## Deploy

- [ ] `vercel --prod` or push to main (if GitHub integration enabled)
- [ ] Deployment succeeds with no build errors
- [ ] Vercel Function logs show no runtime errors

## Telegram

- [ ] Bot created via @BotFather
- [ ] Webhook configured with `secret_token` (see README.production.md §2.3)
- [ ] Test via Settings page → "Testar conexão" → ✅
- [ ] Test via Settings page → "Configurar Webhook" → ✅
- [ ] Send a test signal → appears in dashboard within 5 seconds

## Functionality Verification

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Dashboard loads with correct bankroll stats
- [ ] Send text signal → parses with AI, confidence ≥ 80%, status = pending
- [ ] Send image signal → OCR extracts fields, saved to Supabase
- [ ] Mark signal green → bankroll updates, chart updates
- [ ] Mark signal red → bankroll decreases, stats update
- [ ] Analytics page loads with charts
- [ ] Review page shows `needs_review` signals
- [ ] Auto-close: `POST /api/autoclose/run` returns stats
- [ ] System Status page: all services show green

## Demo Mode Test

- [ ] Settings → "Inserir dados demo" → 30 signals added
- [ ] Analytics shows 3 months of data
- [ ] Review shows 2 needs_review signals
- [ ] Settings → "Limpar dados demo" → signals removed

## Security

- [ ] Webhook secret validated (try sending request without header → 401)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `VITE_`
- [ ] Telegram token is not visible in browser DevTools → Network
- [ ] Rate limiter returns 429 after 120 req/min (test locally)
- [ ] `/api/demo/*` is not publicly documented (internal use only)

## Cron Job (Vercel Pro only)

- [ ] `vercel.json` has `crons` array configured
- [ ] Vercel Dashboard → Project → Cron Jobs shows the job
- [ ] First cron run visible in Function logs after 15 minutes
- [ ] Processing logs table shows entries after cron runs

## Post-Deploy

- [ ] Monitor for 24h — check Vercel Function logs for errors
- [ ] Verify at least one signal auto-closed correctly
- [ ] Set up Vercel alerts for function errors (optional)
- [ ] Bookmark: `https://your-project.vercel.app/system-status`
