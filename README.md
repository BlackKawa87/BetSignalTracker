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

1. Acesse https://supabase.com/dashboard/project/azptefnlubhhaafcnddz
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo de `supabase/schema.sql`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Edite .env com suas chaves do Supabase
npm install
npm run dev
```

Variáveis necessárias no `.env`:
```
VITE_SUPABASE_URL=https://azptefnlubhhaafcnddz.supabase.co
VITE_SUPABASE_ANON_KEY=<sua anon key do Supabase>
```

### 3. Backend (para integração Telegram)

```bash
cd backend
cp .env.example .env
# Edite .env com suas chaves
npm install
npm run dev
```

Variáveis necessárias no `.env`:
```
PORT=3001
TELEGRAM_BOT_TOKEN=<token do seu bot>
SUPABASE_URL=https://azptefnlubhhaafcnddz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key do Supabase>
```

---

## Configurando o Telegram Bot

### Criar o bot
1. Abra o Telegram e busque **@BotFather**
2. Envie `/newbot` e siga as instruções
3. Copie o token gerado

### Configurar webhook (backend rodando em produção)

```bash
# Substitua pela URL pública do seu backend (ex: Railway, Render, etc.)
curl -X POST http://localhost:3001/api/telegram/set-webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://seu-backend.railway.app"}'
```

### Fluxo de uso
1. Você recebe um sinal em um canal/grupo do Telegram
2. **Encaminha** a mensagem para o seu bot privado
3. O bot processa e salva automaticamente no dashboard

> ⚠️ O bot **não** acessa canais onde você não é admin. O fluxo correto é encaminhar o sinal manualmente para o seu bot.

---

## Funcionalidades

| Feature | Status |
|---------|--------|
| Dashboard com métricas | ✅ |
| Gestão de banca automática | ✅ |
| Parser de sinais (múltiplos formatos) | ✅ |
| Cadastro manual de sinais | ✅ |
| Marcar Green / Red / Void | ✅ |
| Histórico com filtros | ✅ |
| Estatísticas + gráficos | ✅ |
| Webhook Telegram | ✅ |
| Configurações de banca e stake | ✅ |

---

## Cálculo Financeiro

**Green**: `lucro = stake × (odd - 1)` → banca aumenta

**Red**: `prejuízo = stake` → banca diminui

**Stake automática**: `(banca_atual × percentual_stake) / 100`

---

## Estrutura do projeto

```
BetSignalTracker/
├── frontend/          # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── types/
│   │   └── utils/
│   └── .env.example
├── backend/           # Node.js + Express
│   ├── src/
│   │   ├── routes/
│   │   └── utils/
│   └── .env.example
└── supabase/
    └── schema.sql     # Execute no SQL Editor do Supabase
```
