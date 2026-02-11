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

function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

// Get a user by ID (enforces privacy restrictions)
router.get('/:id', async (req, res) => {
  const viewerId = getUserId(req)
  const profileId = req.params.id

  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, privacy, created_at')
    .eq('id', profileId)
    .single()

  if (error) return res.status(404).json({ error: 'User not found' })

  // Public profiles, own profile, or no viewer — return full data
  if (data.privacy === 'public' || viewerId === profileId) {
    return res.json(data)
  }

  // Private profile — check if the viewer is friends with this user
  if (viewerId) {
    const { data: friendship } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(requester_id.eq.${viewerId},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${viewerId})`)
      .maybeSingle()

    if (friendship) {
      return res.json(data)
    }
  }

  // Not friends with a private user — return restricted profile
  res.json({ id: data.id, username: data.username, privacy: data.privacy, restricted: true })
})

// Update own profile (privacy setting)
router.patch('/:id', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })
  if (userId !== req.params.id) return res.status(403).json({ error: 'You can only update your own profile' })

  const { privacy } = req.body
  if (!privacy || !['public', 'private'].includes(privacy)) {
    return res.status(400).json({ error: 'privacy must be "public" or "private"' })
  }

  const { data, error } = await supabase
    .from('users')
    .update({ privacy })
    .eq('id', userId)
    .select('id, username, email, privacy, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
