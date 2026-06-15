const BASE = 'https://api.telegram.org'

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return t
}

async function downloadFileById(
  fileId: string,
): Promise<{ base64: string; mediaType: string; bytes: number }> {
  const tk = token()

  // Resolve file_path from Telegram
  const fileRes  = await fetch(`${BASE}/bot${tk}/getFile?file_id=${fileId}`)
  const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } }
  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(`Telegram getFile failed for file_id=${fileId}`)
  }

  const filePath  = fileData.result.file_path
  const ext       = filePath.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mediaType =
    ext === 'png'  ? 'image/png'  :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif'  ? 'image/gif'  : 'image/jpeg'

  const dlRes = await fetch(`https://api.telegram.org/file/bot${tk}/${filePath}`)
  if (!dlRes.ok) throw new Error(`Failed to download file from Telegram (HTTP ${dlRes.status})`)

  const arrayBuffer = await dlRes.arrayBuffer()
  const bytes       = arrayBuffer.byteLength
  const base64      = Buffer.from(arrayBuffer).toString('base64')

  return { base64, mediaType, bytes }
}

export async function downloadPhotoAsBase64(
  fileId: string,
): Promise<{ base64: string; mediaType: string; bytes: number }> {
  return downloadFileById(fileId)
}

export async function downloadDocumentAsBase64(
  fileId: string,
): Promise<{ base64: string; mediaType: string; bytes: number }> {
  return downloadFileById(fileId)
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
      // include channel_post so forwarded signals from channels also work
      allowed_updates: ['message', 'channel_post'],
      drop_pending_updates: true,
    }),
  })
  return res.json()
}

export async function getWebhookInfo(): Promise<unknown> {
  const res = await fetch(`${BASE}/bot${token()}/getWebhookInfo`)
  return res.json()
}
