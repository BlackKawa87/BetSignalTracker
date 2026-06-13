const BASE = 'https://api.telegram.org'

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return t
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  await fetch(`${BASE}/bot${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function setWebhook(webhookUrl: string): Promise<unknown> {
  const res = await fetch(`${BASE}/bot${token()}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  })
  return res.json()
}

export async function getWebhookInfo(): Promise<unknown> {
  const res = await fetch(`${BASE}/bot${token()}/getWebhookInfo`)
  return res.json()
}
