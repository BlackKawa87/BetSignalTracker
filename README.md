# BetSignalTracker

Plataforma pessoal para gestão de sinais de apostas esportivas recebidos pelo Telegram.

## Stack

- **Frontend**: React 18 + Vite + TailwindCSS + Recharts
- **Backend**: Node.js + Express + TypeScript
- **Banco de dados**: Supabase (PostgreSQL)
- **Integração**: Telegram Bot API via webhook

---

## Setup rápido

### 1. Banco de dados (Supabase)

1. Acesse o [SQL Editor](https://supabase.com/dashboard/project/azptefnlubhhaafcnddz/sql/new)
2. Execute `supabase/schema.sql` para criar as tabelas
3. Execute `supabase/migration_add_needs_review.sql` para adicionar o status `needs_review`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 3. Backend (local)

```bash
cd backend
cp .env.example .env
# Preencha todas as variáveis
npm install
npm run dev
```

---

## Criando o bot no Telegram

### Passo 1 — Criar o bot
1. Abra o Telegram e busque **@BotFather**
2. Envie `/newbot`
3. Escolha um nome (ex: `BetSignalTracker`)
4. Escolha um username (deve terminar em `bot`, ex: `meus_sinais_bot`)
5. Copie o **token** que o BotFather enviar

### Passo 2 — Configurar o .env
```env
TELEGRAM_BOT_TOKEN=1234567890:AAHdqTcvCH1vGWJxfSeofSs0K67lz5Mjr-o
PUBLIC_WEBHOOK_URL=https://betsignaltracker.vercel.app
SUPABASE_URL=https://azptefnlubhhaafcnddz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

### Passo 3 — Configurar o webhook

**Via browser** (mais fácil):
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://betsignaltracker.vercel.app/api/telegram/webhook
```

**Via endpoint do próprio app** (após deploy):
```
https://betsignaltracker.vercel.app/api/telegram/set-webhook?url=https://betsignaltracker.vercel.app
```

**Verificar se está configurado:**
```
https://betsignaltracker.vercel.app/api/telegram/info
```

### Passo 4 — Testar

Encaminhe uma mensagem para o seu bot:
```
SINAL: Ambas Marcam SIM - Flamengo x Palmeiras - Odd 1.75
```

O bot deve responder confirmando o registro e o sinal aparece no dashboard.

---

## Variáveis de ambiente (Vercel)

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública do Supabase (frontend) |
| `SUPABASE_URL` | URL do projeto Supabase (backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do Supabase (backend) |
| `TELEGRAM_BOT_TOKEN` | Token do bot criado no @BotFather |
| `PUBLIC_WEBHOOK_URL` | URL pública do app (ex: https://betsignaltracker.vercel.app) |

---

## Fluxo de uso

```
Canal/grupo do Telegram
        ↓
  Você encaminha manualmente
        ↓
  Seu bot privado recebe
        ↓
  Webhook processa e salva no Supabase
        ↓
  Bot confirma: "✅ Sinal registrado!"
        ↓
  Dashboard atualiza automaticamente
```

> ⚠️ O sistema **nunca** tenta acessar canais privados automaticamente.
> O encaminhamento é sempre manual, pelo usuário.

---

## Status dos sinais

| Status | Descrição |
|---|---|
| `pending` | Sinal completo aguardando resultado |
| `needs_review` | Sinal incompleto (faltou odd/times/mercado) — editar no dashboard |
| `green` | Aposta ganha |
| `red` | Aposta perdida |
| `void` | Aposta anulada |

---

## Cálculo financeiro

- **Green**: `lucro = stake × (odd - 1)` → banca sobe
- **Red**: `prejuízo = stake` → banca desce
- **Stake automática**: `banca_atual × percentual / 100`

---

## Estrutura

```
BetSignalTracker/
├── frontend/              React + Vite + Tailwind
├── backend/               Node.js + Express
│   └── src/
│       ├── routes/        telegram.ts, signals.ts
│       └── utils/         supabase.ts, telegram.ts, signalParser.ts
├── supabase/
│   ├── schema.sql
│   └── migration_add_needs_review.sql
└── vercel.json
```
