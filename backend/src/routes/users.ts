import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { isFriend } from './friends.js'

/**
 * users.ts
 *
 * Description:
 * Backend routes for anything relates to user information.
 *
 * Author: Tristan Sze
 * Edited by: Thomas Snowden
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
    const isFriendFlag = await isFriend(viewerId, profileId)
    if (isFriendFlag) {
      return res.json(data)
    }
  }

  // Not friends with a private user — return restricted profile
  res.json({ id: data.id, username: data.username, privacy: data.privacy, restricted: true })
})

// Update own profile (privacy or username)
router.patch('/:id', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })
  if (userId !== req.params.id) return res.status(403).json({ error: 'You can only update your own profile' })

  const { privacy, username } = req.body
  
  // Create an object with only the fields provided in the request
  const updates: any = {}
  if (privacy && ['public', 'private'].includes(privacy)) updates.privacy = privacy
  if (username && username.trim().length > 0) updates.username = username.trim()

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' })
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, username, email, privacy, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/**
 * Delete a user
 */
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Missing x-user-id header' })
    if (userId !== req.params.id) return res.status(403).json({ error: 'You can only delete your own profile' })
    try {
        //delete the song
        const { error : deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id',userId )
        if (deleteError) {
            return res.status(500).json({ error: deleteError.message }) 
        } 
        res.status(201).json({ message: 'User deleted successfully'})
    } catch (err: any) {
        return res.status(500).json({ error: err.message }) 
    }
})

/**
 * Get a user's Spotify connection info (for profile display)
 * Returns info only if: own profile, public profile, or viewer is friend
 */
router.get('/:id/spotify', async (req, res) => {
  const viewerId = getUserId(req)
  const profileId = req.params.id

  // Get profile user's privacy setting
  const { data: profileUser, error: userError } = await supabase
    .from('users')
    .select('privacy')
    .eq('id', profileId)
    .single()

  if (userError) return res.status(404).json({ error: 'User not found' })

  // Check if viewer can access this profile's Spotify info
  const isOwnProfile = viewerId === profileId
  const isPublic = profileUser.privacy === 'public'
  let canView = isOwnProfile || isPublic

  if (!canView && viewerId) {
    // Check if viewer is friend
    const isFriendFlag = await isFriend(viewerId, profileId)
    canView = isFriendFlag
  }

  if (!canView) {
    return res.status(403).json({ error: 'Not authorized to view Spotify info' })
  }

  // Get Spotify connection info
  const { data: spotifyData, error: spotifyError } = await supabase
    .from('user_spotify_tokens')
    .select('spotify_display_name, spotify_profile_url')
    .eq('user_id', profileId)
    .single()

  if (spotifyError || !spotifyData) {
    return res.json({ connected: false })
  }

  res.json({
    connected: true,
    displayName: spotifyData.spotify_display_name,
    profileUrl: spotifyData.spotify_profile_url,
  })
})

export default router
