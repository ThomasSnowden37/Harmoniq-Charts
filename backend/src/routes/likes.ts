import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

/**
 * likes.ts
 *
 * Description:
 * Backend routes for liking/unliking songs and fetching liked songs.
 *
 * Author: Tristan Sze
 */

const router = Router()

function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

/**
 * GET /api/likes/:songId/status
 * Returns whether the current user liked this song and the total like count.
 */
router.get('/:songId/status', async (req, res) => {
  const userId = getUserId(req)
  const { songId } = req.params

  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('song_id', songId)

  if (!userId) {
    return res.json({ liked: false, count: count ?? 0 })
  }

  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('song_id', songId)
    .eq('user_id', userId)
    .maybeSingle()

  res.json({ liked: !!data, count: count ?? 0 })
})

/**
 * POST /api/likes/:songId
 * Like a song.
 */
router.post('/:songId', async (req, res) => {
  const userId = getUserId(req)
  const { songId } = req.params

  if (!userId) return res.status(401).json({ error: 'Must be logged in to like a song' })

  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('song_id', songId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'Already liked' })

  const { data, error } = await supabase
    .from('likes')
    .insert({ user_id: userId, song_id: songId })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  const { data: trend, error: trend_error } = await supabase.rpc('get_trending_songs');
  res.status(201).json(data)
})

/**
 * DELETE /api/likes/:songId
 * Unlike a song.
 */
router.delete('/:songId', async (req, res) => {
  const userId = getUserId(req)
  const { songId } = req.params

  if (!userId) return res.status(401).json({ error: 'Must be logged in to unlike a song' })

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('song_id', songId)
    .eq('user_id', userId)

  if (error) return res.status(500).json({ error: error.message })
  const { data: trend, error: trend_error } = await supabase.rpc('get_trending_songs');
  res.json({ message: 'Unliked successfully' })
})

/**
 * GET /api/likes/user/:userId
 * Get all songs liked by a user, with song metadata.
 */
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params

  const { data, error } = await supabase
    .from('likes')
    .select('song_id, created_at, songs(id, title, genre, year_released, bpm)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const songs = data.map((row: any) => ({ ...row.songs, liked_at: row.created_at }))
  res.json(songs)
})

export default router
