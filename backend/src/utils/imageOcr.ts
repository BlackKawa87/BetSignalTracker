import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `Você é um extrator especializado em sinais de apostas esportivas do Telegram.

Estas imagens são screenshots de canais de apostas. Elas mostram um bet slip (cupom de aposta) montado na plataforma.

INSTRUÇÕES:
1. Foque no CUPOM DE APOSTA (o card/box branco ou destacado que mostra o resumo da aposta).
2. O cupom geralmente contém: seleção (Sim/Não), mercado, times e odd final.
3. Ignore tabelas de odds gerais — extraia apenas a aposta SELECIONADA (marcada/destacada).
4. Procure por "X% - Pegue Aqui" — esse é o percentual de stake recomendado pelo tipster.
5. Se for múltipla, use o mercado "Múltipla" e a odd total mostrada.

Retorne APENAS um JSON com esta estrutura (null para não encontrado):
{
  "home_team": "time da casa ou null (use o primeiro time listado no cupom)",
  "away_team": "time visitante ou null (segundo time no cupom)",
  "market": "mercado selecionado completo (ex: Ambos Times Recebem Cartão Vermelho - Sim, 00:00-04:59 Lateral, Múltipla de 9)",
  "selection": "Sim, Não, 1, X, 2 ou null",
  "odd": número_decimal_ou_null,
  "match_time": "horário do jogo (ex: 13:00) ou null",
  "match_date": "data do jogo (ex: 15 Jun) ou null",
  "competition": "competição/campeonato ou null",
  "bookmaker": "casa de apostas visível ou null",
  "recommended_stake_pct": número_percentual_ou_null (extraia de '0.1%' → 0.1, '0.15%' → 0.15),
  "is_multiple": true se for múltipla/acumulador, false se for simples,
  "raw_text": "todo texto visível na imagem concatenado"
}

Retorne SOMENTE o JSON, sem explicações nem markdown.`

export interface OcrResult {
  home_team: string | null
  away_team: string | null
  market: string | null
  selection: string | null
  odd: number | null
  match_time: string | null
  match_date: string | null
  competition: string | null
  bookmaker: string | null
  recommended_stake_pct: number | null
  is_multiple: boolean
  raw_text: string
}

export async function extractSignalFromImage(imageBase64: string, mediaType: string): Promise<OcrResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const clean = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(clean) as OcrResult

  // Normalize odd — sometimes Claude returns string
  if (parsed.odd !== null) {
    parsed.odd = Math.round(Number(parsed.odd) * 100) / 100
    if (isNaN(parsed.odd) || parsed.odd < 1.01) parsed.odd = null
  }

  // Normalize recommended_stake_pct
  if (parsed.recommended_stake_pct !== null) {
    parsed.recommended_stake_pct = Number(parsed.recommended_stake_pct)
    if (isNaN(parsed.recommended_stake_pct)) parsed.recommended_stake_pct = null
  }

  return parsed
}
