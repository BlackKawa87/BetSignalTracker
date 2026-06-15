# CLAUDE.md — BetSignalTracker

Guia para o Claude Code trabalhar neste repositório.

## Estrutura do projeto

```
BetSignalTracker/
├── backend/          Express.js API (TypeScript)
│   └── src/
│       ├── index.ts              Servidor principal, monta rotas
│       ├── routes/
│       │   ├── parse.ts          POST /parse/text  POST /parse/image
│       │   ├── telegram.ts       Webhook do Telegram
│       │   ├── signals.ts        CRUD de sinais
│       │   ├── autoclose.ts      Fechamento automático
│       │   ├── health.ts         Health check
│       │   ├── demo.ts           Dados de demonstração
│       │   └── test.ts           Endpoints de teste
│       ├── services/
│       │   ├── imageSignalParser.ts   GPT-4o Vision — parser principal de imagens
│       │   ├── aiSignalParser.ts      GPT-4o-mini — parser de texto
│       │   ├── signalAutoClose.ts     Auto-fechamento via Sports API
│       │   ├── marketEvaluator.ts     Avaliação de mercados
│       │   └── sportsApi.ts           Integração API esportes
│       ├── utils/
│       │   ├── imageOcr.ts       OCR legado (não usar como fluxo principal)
│       │   ├── supabase.ts       Cliente Supabase
│       │   ├── telegram.ts       Bot API helpers
│       │   ├── signalParser.ts   Parser regex (fallback)
│       │   └── logger.ts         Logger colorido
│       └── middleware/
│           └── rateLimiter.ts    Rate limiting por IP
├── frontend/         React 18 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── App.tsx               Roteamento principal
│       ├── types/index.ts        Todos os tipos TypeScript
│       ├── pages/
│       │   ├── Dashboard.tsx     Painel principal
│       │   ├── Review.tsx        Revisão de sinais com baixa confiança
│       │   ├── Analytics.tsx     Análises e gráficos
│       │   ├── Settings.tsx      Configurações de banca
│       │   ├── SystemStatus.tsx  Status do sistema
│       │   └── TestLab.tsx       Laboratório de testes
│       ├── contexts/AppContext.tsx  Estado global via React Context
│       └── components/
│           ├── ui/               Card, Badge, Toast
│           ├── dashboard/        SignalTable, SignalRow, EditSignalModal, StatCard
│           └── layout/           Sidebar
├── supabase/         Migrações SQL (rodar no Supabase SQL Editor)
│   ├── schema.sql                             Schema canônico completo
│   ├── migration_add_needs_review.sql
│   ├── migration_confidence_score.sql
│   ├── migration_processing_logs.sql
│   └── migration_image_fields.sql             ← rodar antes de usar o novo parser
├── api/              Vercel Functions (Telegram webhook legado)
└── vercel.json       Deploy config
```

## Comandos

```bash
# Backend
cd backend && npm run dev       # tsx watch (hot reload)
cd backend && npm run build     # tsc (verificação de tipos)

# Frontend
cd frontend && npm run dev      # Vite dev server
cd frontend && npm run build    # tsc + Vite build

# Deploy
vercel --prod                   # Deploy completo para produção
```

## Stack

- **Backend**: Express.js 4, TypeScript, OpenAI SDK, Supabase JS, node-telegram-bot-api
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, lucide-react, recharts
- **DB**: Supabase (PostgreSQL) — RLS habilitado com políticas permissivas (single-user)
- **Deploy**: Vercel — frontend SPA + backend Node em `/api/*`
- **IA**: OpenAI gpt-4o (imagens via Vision), gpt-4o-mini (texto)

## Variáveis de ambiente obrigatórias

```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SPORTS_API_KEY=
```

## Arquitetura de parsing de imagens

Fluxo principal (NÃO usar OCR+Regex como primário):

```
Imagem (Telegram ou POST /api/parse/image)
  ↓
GPT-4o Vision  →  backend/src/services/imageSignalParser.ts
  ↓
ImageParseResult { picks[] }
  ↓
Validation (normalizePick, clampOdd, clampConf)
  ↓
DB: signals (ai_raw_json sempre salvo para auditoria)
```

### Endpoint POST /api/parse/image

```
Body:    { image_base64: string, mime_type?: string }
Returns: { picks: ImagePick[], raw_ai_json: string, parse_error?: string }
```

### Schema de um ImagePick

```typescript
{
  market_category: MarketCategory | null  // "Corners", "Bet Builder", etc.
  market_name:     string | null          // "Escanteios - Over 9.5"
  match:           string | null          // "Arsenal vs Chelsea"
  competition:     string | null
  team:            string | null
  player:          string | null
  line:            string | null          // "9.5", "-1.5"
  period:          string | null          // "1st Half", "Full Time"
  selection:       string | null          // "Over", "Yes", "Home"
  odd:             number | null
  is_bet_builder:  boolean
  legs:            { market, selection, line }[]
  confidence_score: number                // 0–100
  raw_description: string | null
}
```

### Categorias de mercado suportadas

`Result` | `Both Teams To Score` | `Over Under` | `Handicap` | `Double Chance` |
`Team Total Goals` | `Corners` | `Race to Corners` | `Cards` | `Player Shots` |
`Player Shots On Target` | `Bet Builder` | `Time Window` | `Other`

## Campos novos na tabela `signals`

Adicionados por `supabase/migration_image_fields.sql`:

| Coluna           | Tipo    | Descrição                          |
|------------------|---------|------------------------------------|
| market_category  | text    | Categoria do mercado               |
| selection        | text    | Seleção (Over, Yes, Home...)       |
| period           | text    | Período (Full Time, 1st Half...)   |
| line             | text    | Linha numérica (9.5, -1.5...)      |
| team             | text    | Time específico do mercado         |
| player           | text    | Jogador (mercados de jogador)      |
| is_bet_builder   | boolean | É Bet Builder / Same Game Multi    |
| legs             | jsonb   | Legs do Bet Builder                |
| ai_raw_json      | text    | JSON bruto da IA (sempre salvar)   |
| image_url        | text    | URL da imagem para visualizador    |

## Tela de Revisão (Review.tsx)

Sinais com `confidence_score < 80` recebem status `needs_review`. A tela exibe:
- Visualizador de imagem com zoom modal (quando `signal.image_url` preenchido)
- Legs do Bet Builder (quando `is_bet_builder = true`)
- Campos estruturados: `selection`, `period`, `line`, `team`, `player`, `market_category`
- JSON bruto da IA em seção colapsável
- Botão "Re-processar IA" (chama `/api/parse/text`)

## Regras importantes

- `imageOcr.ts` existe mas NÃO é o fluxo principal — foi substituído por `imageSignalParser.ts`
- Parser de texto (`aiSignalParser.ts`) permanece ativo para sinais de texto do Telegram
- Sempre salvar `ai_raw_json` no DB para auditoria
- `noUnusedLocals` e `noUnusedParameters` habilitados — imports não usados quebram o build
- Antes de nova migração SQL, verificar `schema.sql` para manter idempotência
