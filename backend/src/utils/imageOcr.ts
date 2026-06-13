import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `Você é um extrator de sinais de apostas esportivas.
Analise esta imagem e extraia APENAS as informações do sinal de aposta.
Retorne um JSON com esta estrutura exata (use null para campos não encontrados):

{
  "home_team": "nome do time da casa ou null",
  "away_team": "nome do time visitante ou null",
  "market": "mercado da aposta (ex: Ambas Marcam - Sim, Over 2.5, Resultado Final) ou null",
  "odd": número_decimal_ou_null,
  "competition": "nome do campeonato ou null",
  "bookmaker": "casa de apostas ou null",
  "match_time": "horário do jogo ou null",
  "raw_text": "todo o texto visível na imagem"
}

Retorne SOMENTE o JSON, sem explicações.`

export async function extractSignalFromImage(imageBase64: string, mediaType: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
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
  return content.text
}

export function parseClaudeResponse(jsonText: string): Record<string, unknown> {
  // Strip markdown code blocks if present
  const clean = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}
