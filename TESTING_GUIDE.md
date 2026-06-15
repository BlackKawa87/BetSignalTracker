# BetSignalTracker — Testing Guide

## Quick Start

### Automated CLI suite

```bash
cd backend
npm run test:flow          # runs against http://localhost:3001

# Against production (requires ALLOW_TEST_ENDPOINTS=true in Vercel)
TEST_BASE_URL=https://your-app.vercel.app npm run test:flow
```

### Visual Test Lab (browser)

1. Start the dev servers:
   ```bash
   cd backend  && npm run dev   # port 3001
   cd frontend && npm run dev   # port 5173
   ```
2. Open `http://localhost:5173/test-lab`
3. Click **"Executar Todos"** or run individual tests

---

## Test Endpoints

> Guard: `NODE_ENV !== 'production'` OR `ALLOW_TEST_ENDPOINTS=true`
> All paths are relative to the backend (Vercel strips `/api` prefix).

| Endpoint | Method | Description |
|---|---|---|
| `/test/telegram-update` | POST | Simulate Telegram text update → parse + insert [TEST] signal |
| `/test/full-flow` | POST | E2E: parse → insert → mark green → verify → cleanup |
| `/test/parser` | POST | Quick parser test, no DB write |
| `/test/supabase` | GET | Connectivity: signal count + settings exist |
| `/test/presets` | GET | Returns all preset signal texts |

### POST /test/telegram-update

```json
// Request
{ "text": "Arsenal x Chelsea | BTTS SIM | odd 1.72 | Premier League" }
// or use a preset:
{ "preset": "btts" }  // btts | over25 | dupla | result | under | real

// Response
{
  "ok": true,
  "elapsed_ms": 1234,
  "signal_id": "uuid",
  "stake": 20.00,
  "stakePct": 2,
  "parsed": {
    "home_team": "Arsenal",
    "away_team": "Chelsea",
    "market": "Ambas Marcam - Sim",
    "odd": 1.72,
    "competition": "Premier League",
    "confidence_score": 92,
    "status": "pending",
    "missing_fields": [],
    "reasoning": ""
  }
}
```

Signal is saved with `notes = "[TEST]"`. Delete from Dashboard when done.

### POST /test/full-flow

```json
// Request
{ "text": "BTTS SIM | Flamengo x Vasco | Odd 1.82 | Brasileirao" }

// Response
{
  "ok": true,
  "total_elapsed_ms": 3450,
  "steps_passed": 9,
  "steps_failed": 0,
  "report": [
    { "step": "Load settings",     "ok": true, "elapsed": 45,  "detail": "bankroll=1000 stake=2%" },
    { "step": "AI Parser",         "ok": true, "elapsed": 1200,"detail": "conf=91% Flamengo x Vasco | BTTS @ 1.82" },
    { "step": "Stake calculation", "ok": true, "elapsed": 1,   "detail": "R$20 (2% of R$1000)" },
    { "step": "Insert signal",     "ok": true, "elapsed": 120, "detail": "id=uuid-here" },
    { "step": "Mark green",        "ok": true, "elapsed": 85,  "detail": "profit=+R$16.40 | new_bankroll=R$1016.40" },
    { "step": "Update bankroll",   "ok": true, "elapsed": 80,  "detail": "R$1000 → R$1016.40" },
    { "step": "Bankroll history",  "ok": true, "elapsed": 90,  "detail": null },
    { "step": "Verify DB records", "ok": true, "elapsed": 75,  "detail": "status=green profit=16.4 confidence=91%" },
    { "step": "Cleanup",           "ok": true, "elapsed": 150, "detail": "Signal deleted, bankroll restored to R$1000" }
  ]
}
```

---

## Test Coverage

### Infrastructure
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] Supabase: signals table accessible + settings row exists

### AI Parser
- [ ] BTTS SIM parsed correctly (teams, market, odd)
- [ ] Over 2.5 parsed correctly
- [ ] Dupla Hipótese 1X parsed correctly
- [ ] Custom free-form text parsed
- [ ] Low-confidence text triggers `status=needs_review` (confidence < 80%)

### Signal Pipeline
- [ ] Stake = bankroll × stake_percentage / 100 (rounded to 2 decimal places)
- [ ] `[TEST]` tag in notes of simulated signal
- [ ] Signal appears in Dashboard after simulation

### Security
- [ ] Webhook without `X-Telegram-Bot-Api-Secret-Token` → 401 (if secret configured)
- [ ] Webhook with wrong secret → 401
- [ ] Test endpoints return 403 in production without `ALLOW_TEST_ENDPOINTS=true`

### E2E Full Flow
- [ ] Signal parsed, inserted, marked green
- [ ] Bankroll history row created
- [ ] DB record verified (status=green, profit_loss correct)
- [ ] Test signal deleted after test (bankroll restored)

---

## Manual Test Checklist

### Telegram Bot — Text Signal

1. Send to bot: `Flamengo x Palmeiras | Ambas Marcam - SIM | Odd 1.75 | Brasileirao`
2. Dashboard → signal appears with status `pending`
3. Confidence ≥ 80% → not in Revisão
4. Stake is correct (bankroll × %)

### Telegram Bot — Low Confidence Signal

1. Send: `Sinal favorito vencer hoje`
2. Dashboard → signal appears with `needs_review` status
3. Revisão page → signal listed with confidence < 80%
4. Can re-parse, approve, or delete

### Telegram Bot — Image/Screenshot

1. Forward a screenshot from a tipster channel
2. Dashboard → signal extracted via OCR
3. Confidence shown correctly

### Green / Red resolution

1. Create a signal (via Test Lab)
2. Mark green → bankroll increases, P&L shows profit
3. Create another signal → mark red → bankroll decreases
4. Stats page reflects updated W/L ratio and ROI

### Auto-Close

```bash
curl -X POST http://localhost:3001/autoclose/run \
  -H "x-cron-secret: your_secret"
```

Expected: JSON with `{ checked, green, red, void, error }` counts.

---

## Preset Signals Reference

| Key | Text |
|---|---|
| `btts` | `SINAL: Ambas Marcam SIM - Flamengo x Palmeiras - Odd 1.75` |
| `over25` | `Over 2.5 gols \| PSG x Lyon \| Odd 1.90 \| Ligue 1` |
| `dupla` | `Dupla Hipótese 1X \| Arsenal x Chelsea \| Odd 1.55 \| Premier League` |
| `result` | `Resultado Final - 1 \| Bayern Munich x Dortmund \| odd 1.65 \| Bundesliga` |
| `under` | `Under 2.5 gols \| Atletico Madrid x Sevilla \| Odd 1.80` |
| `real` | `BTTS SIM \| Real Madrid x Barcelona \| odd 1.82 \| La Liga` |

---

## Running in Production

Set in Vercel Dashboard → Settings → Environment Variables:

```
ALLOW_TEST_ENDPOINTS=true
```

Then run the CLI suite against your production URL:

```bash
TEST_BASE_URL=https://your-app.vercel.app npm run test:flow
```

Remove `ALLOW_TEST_ENDPOINTS` after testing to lock down the endpoints.
