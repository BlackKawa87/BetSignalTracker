import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' })

  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url is required' })

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `${url}/api/telegram/webhook` }),
  })
  const data = await response.json()
  return res.json(data)
}
