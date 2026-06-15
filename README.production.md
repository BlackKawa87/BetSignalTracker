# BetSignalTracker — Production Setup Guide

## Stack Overview

| Layer       | Technology                    |
|-------------|-------------------------------|
| Frontend    | React 18 + Vite + TypeScript  |
| Backend     | Express + TypeScript (Vercel) |
| Database    | Supabase (PostgreSQL + RLS)   |
| Bot         | Telegram Bot API              |
| AI Parser   | OpenAI gpt-4o-mini / gpt-4o   |
| Sports Data | api-sports.io (RapidAPI)      |
| Deploy      | Vercel (monorepo)             |

---

## 1. Supabase Setup

### 1.1 Create project
1. Go to https://supabase.com → New Project
2. Note your **Project URL** and both API keys (anon + service_role)

### 1.2 Run migrations (in order, via SQL Editor)
```
supabase/schema.sql                       ← Full schema (run first)
supabase/migration_processing_logs.sql    ← Processing logs table
supabase/migration_confidence_score.sql   ← AI confidence column
```

### 1.3 Key tables
- `settings` — bankroll config, Telegram token, strategy
- `signals` — all betting signals with status, P&L, confidence
- `bankroll_history` — running bankroll log for charts
- `processing_logs` — auto-close job audit trail

### 1.4 Row Level Security
All tables have RLS enabled with allow-all policies for single-user setup.
For multi-user, replace policies with `auth.uid()` checks.

---

## 2. Telegram Bot Setup

### 2.1 Create the bot
1. Open Telegram → search `@BotFather` → `/newbot`
2. Follow prompts → copy the **HTTP API token**

### 2.2 Configure
1. Set `TELEGRAM_BOT_TOKEN` in Vercel env vars
2. Generate a webhook secret: `openssl rand -hex 32`
3. Set `TELEGRAM_WEBHOOK_SECRET` in Vercel env vars
4. After deploy, configure webhook via Settings page or:
   ```
   GET https://your-project.vercel.app/api/telegram/set-webhook?url=https://your-project.vercel.app
   ```

### 2.3 Enable Webhook Secret (recommended)
When calling `setWebhook`, include the `secret_token` parameter:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-project.vercel.app/api/telegram/webhook","secret_token":"your_secret","allowed_updates":["message"]}'
```

### 2.4 Sending signals
- Send text messages directly to the bot
- Send screenshot images — OCR will extract the signal
- Forward messages from tipster channels to the bot

---

## 3. Vercel Deployment

### 3.1 Project structure
```
/
├── frontend/          ← Vite SPA (routePrefix: /)
├── backend/           ← Express API (routePrefix: /api)
├── vercel.json        ← Monorepo config + cron jobs
└── supabase/          ← SQL migrations
```

### 3.2 Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (first time)
vercel --prod

# Set env vars
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_WEBHOOK_SECRET production
vercel env add OPENAI_API_KEY production
vercel env add SPORTS_API_KEY production
vercel env add CRON_SECRET production
```

### 3.3 Vercel routing (important)
`experimentalServices` in `vercel.json` strips `/api` before Express.
Express routes are WITHOUT `/api` prefix:
- `/api/health` → Express `/health`
- `/api/telegram/webhook` → Express `/telegram/webhook`
- `/api/autoclose/run` → Express `/autoclose/run`

### 3.4 Cron job
Requires **Vercel Pro**. Defined in `vercel.json`:
```json
{ "path": "/api/cron/autoclose", "schedule": "*/15 * * * *" }
```
Runs every 15 minutes to auto-close pending signals.

---

## 4. OpenAI Configuration

Used for two purposes:
- **Signal AI Parser** (`gpt-4o-mini`) — parse text signals, compute confidence score
- **Image OCR** (`gpt-4o`) — extract signals from screenshot images

Set `OPENAI_API_KEY` in Vercel. Without it, the system falls back to the regex parser
with lower confidence scores.

**Cost estimate**: ~$0.01–0.05/day for personal use (100–500 signals/month).

---

## 5. Sports API (Auto-Close)

Used to automatically resolve pending signals by fetching match results.

1. Sign up at https://rapidapi.com/api-sports/api/api-football
2. Free tier: 100 requests/day (enough for personal use)
3. Set `SPORTS_API_KEY` in Vercel

Signals are checked every 15 minutes (Vercel cron). Only signals older than 110 minutes
are processed. Supports: BTTS, Over/Under, 1X2, Handicap, Corners, Cards.

---

## 6. End-to-End Testing

### 6.1 Test the API health
```bash
curl https://your-project.vercel.app/api/health
```
Expected: `{"status":"ok",...}`

### 6.2 Test Telegram webhook
1. Send a message to your bot: `Arsenal x Chelsea | Ambas Marcam - Sim | odd 1.72`
2. Check dashboard — signal should appear with status `pending` and confidence ≥ 80%

### 6.3 Test with demo data
1. Go to Settings → Demo Mode → "Inserir dados demo"
2. Check Dashboard — 30 signals with analytics
3. Check Analytics tab for charts
4. Go to Revisão — 2 needs_review signals will be there
5. Clean up: Settings → "Limpar dados demo"

### 6.4 Test auto-close
```bash
curl -X POST https://your-project.vercel.app/api/autoclose/run \
  -H "x-cron-secret: your_cron_secret"
```

---

## 7. Rate Limits

| Endpoint         | Limit (per instance) |
|------------------|----------------------|
| All endpoints    | 120 req/min          |
| /telegram/*      | 30 req/min           |
| /autoclose/*     | 20 req/min           |
| /parse/*         | 15 req/min           |

Note: Vercel serverless functions are stateless. Rate limits apply per instance.
For global rate limiting, configure Vercel's built-in DDoS protection or use Upstash Redis.

---

## 8. Security Checklist

- [ ] `TELEGRAM_WEBHOOK_SECRET` set and webhook configured with `secret_token`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in backend env vars (never `VITE_` prefix)
- [ ] `VITE_SUPABASE_ANON_KEY` is the public key (safe to expose)
- [ ] `.env` files are in `.gitignore`
- [ ] Supabase RLS is enabled on all tables
- [ ] `CRON_SECRET` protects manual autoclose trigger

---

## 9. Monitoring

- **Health check**: `GET /api/health` — checks Supabase, env vars, latency
- **System Status page**: `/system-status` in the frontend
- **Processing logs**: stored in `processing_logs` table, visible in Auto-Close page
- **Vercel logs**: Dashboard → Functions → `/api/*`
