import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

/**
 * users.ts
 *
 * Description:
 * Backend routes for anything relates to user information. 
 *
 * Author: Tristan Sze
 *
 */

const router = Router()

// Get a user by ID
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, privacy, created_at')
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'User not found' })
  res.json(data)
})

export default router
