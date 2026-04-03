import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

/**
 * reviews.ts
 *
 * Description:
 * Backend routes for submitting, deleting, and fetching song reviews.
 *
 * Author: Tristan Sze
 */

const router = Router()

const MAX_REVIEW_LENGTH = 500

function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

/**
 * GET /api/reviews/song/:songId
 * Get all reviews for a song, with reviewer username.
 */
router.get('/song/:songId', async (req, res) => {
  const { songId } = req.params

  const { data, error } = await supabase
    .from('reviews')
    .select('id, content, created_at, user_id, users(username)')
    .eq('song_id', songId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/**
 * GET /api/reviews/user/:userId
 * Get all reviews by a user, with song title.
 */
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params

  const { data, error } = await supabase
    .from('reviews')
    .select('id, content, created_at, song_id, songs(id, title, genre, year_released)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/**
 * POST /api/reviews/:songId
 * Submit a review for a song. One review per user per song.
 */
router.post('/:songId', async (req, res) => {
  const userId = getUserId(req)
  const { songId } = req.params
  const { content } = req.body

  if (!userId) return res.status(401).json({ error: 'Must be logged in to leave a review' })
  if (!content || !content.trim()) return res.status(400).json({ error: 'Review content cannot be empty' })
  if (content.trim().length > MAX_REVIEW_LENGTH) {
    return res.status(400).json({ error: `Review cannot exceed ${MAX_REVIEW_LENGTH} characters` })
  }

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('song_id', songId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'You have already reviewed this song' })

  const { data, error } = await supabase
    .from('reviews')
    .insert({ user_id: userId, song_id: songId, content: content.trim() })
    .select('id, content, created_at, user_id, users(username)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  const { data: trend, error: trend_error } = await supabase.rpc('get_trending_songs');
  res.status(201).json(data)
})

/**
 * DELETE /api/reviews/:reviewId
 * Delete a review. Only the author can delete their own review.
 */
router.delete('/:reviewId', async (req, res) => {
  const userId = getUserId(req)
  const { reviewId } = req.params

  if (!userId) return res.status(401).json({ error: 'Must be logged in to delete a review' })

  const { data: existing } = await supabase
    .from('reviews')
    .select('user_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (!existing) return res.status(404).json({ error: 'Review not found' })
  if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only delete your own reviews' })

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
  if (error) return res.status(500).json({ error: error.message })
  const { data: trend, error: trend_error } = await supabase.rpc('get_trending_songs');
  res.json({ message: 'Review deleted' })
})

export default router
