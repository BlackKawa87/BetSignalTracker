import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { data, error } = await supabase.from('signals').update(req.body).eq('id', id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { error } = await supabase.from('signals').delete().eq('id', id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

export default router
