import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

// Get a user's favorite songs (with song metadata)
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params

  const { data, error } = await supabase
    .from('favorite_songs')
    // include nested artists for each song via song_artists -> artists
    .select('*, songs(id, title, bpm, genre, year_released, song_artists(artists(id, name)))')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// Add a song to favorites
router.post('/', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { song_id, position } = req.body

  if (!song_id) return res.status(400).json({ error: 'song_id is required' })
  if (typeof position !== 'number' || position < 0 || position > 4) {
    return res.status(400).json({ error: 'position must be between 0 and 4' })
  }

  // Check if user already has 5 favorites
  const { count } = await supabase
    .from('favorite_songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if ((count ?? 0) >= 5) {
    return res.status(400).json({ error: 'You can only have up to 5 favorite songs' })
  }

  const { data, error } = await supabase
    .from('favorite_songs')
    .insert({ user_id: userId, song_id, position })
    .select('*, songs(id, title, bpm, genre, year_released, song_artists(artists(id, name)))')
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Song already in favorites or position taken' })
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(data)
})

// Remove a song from favorites
router.delete('/:songId', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { songId } = req.params

  const { error } = await supabase
    .from('favorite_songs')
    .delete()
    .eq('user_id', userId)
    .eq('song_id', songId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Favorite removed' })
})

// Reorder favorite songs
router.put('/reorder', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { songIds } = req.body // array of song IDs in desired order (max 5)

  if (!Array.isArray(songIds) || songIds.length === 0 || songIds.length > 5) {
    return res.status(400).json({ error: 'songIds must be an array of 1-5 song IDs' })
  }
  try {
    // Validate that provided songIds match the user's existing favorites
    const { data: existing, error: fetchErr } = await supabase
      .from('favorite_songs')
      .select('song_id')
      .eq('user_id', userId)

    if (fetchErr) throw fetchErr

    const existingIds = new Set((existing || []).map((r: any) => r.song_id))
    if (existingIds.size !== songIds.length || !songIds.every((id: string) => existingIds.has(id))) {
      return res.status(400).json({ error: 'songIds must exactly match the current favorite songs for the user' })
    }

    // Delete existing favorites for the user then re-insert in the requested order.
    // This avoids unique constraint conflicts and respects the CHECK(position BETWEEN 0 AND 4).
    const { error: delErr } = await supabase
      .from('favorite_songs')
      .delete()
      .eq('user_id', userId)

    if (delErr) throw delErr

    const inserts = songIds.map((songId: string, index: number) => ({
      user_id: userId,
      song_id: songId,
      position: index,
    }))

    const { error: insertErr } = await supabase
      .from('favorite_songs')
      .insert(inserts)

    if (insertErr) throw insertErr

    res.json({ message: 'Favorites reordered' })
  } catch (err: any) {
    console.error('Failed to reorder favorites:', err)
    return res.status(500).json({ error: err.message || 'Failed to reorder favorites' })
  }
})

export default router
