import { Router, Request, Response } from 'express'
import { parseSignalWithAI } from '../services/aiSignalParser'
import { parseImageWithAI } from '../services/imageSignalParser'

const router = Router()

// POST /parse/text — AI parse of a raw text signal (used by review screen)
router.post('/text', async (req: Request, res: Response) => {
  const { text } = req.body
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    res.status(400).json({ error: 'text field required (min 3 chars)' })
    return
  }
  try {
    const result = await parseSignalWithAI(text.trim())
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /parse/image — GPT-4o Vision structured parse of a betting slip image
// Body: { image_base64: string, mime_type?: string }
// Returns: ImageParseResult { picks[], raw_ai_json }
router.post('/image', async (req: Request, res: Response) => {
  const { image_base64, mime_type } = req.body

  if (!image_base64 || typeof image_base64 !== 'string' || image_base64.length < 100) {
    res.status(400).json({ error: 'image_base64 field required' })
    return
  }

  // ~4MB base64 limit
  if (image_base64.length > 5_500_000) {
    res.status(400).json({ error: 'Image too large (max ~4MB)' })
    return
  }

  const mime = typeof mime_type === 'string' && mime_type.startsWith('image/')
    ? mime_type
    : 'image/jpeg'

  try {
    const result = await parseImageWithAI(image_base64, mime)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
