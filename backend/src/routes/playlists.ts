import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

// Get all playlists for a user (with song counts)
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params
  const { data: playlists, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  if (!playlists?.length) return res.json([])

  // Get song counts for all playlists
  const playlistIds = playlists.map(p => p.id)
  const { data: counts } = await supabase
    .from('playlist_songs')
    .select('playlist_id')
    .in('playlist_id', playlistIds)

  const countMap = new Map<string, number>()
  counts?.forEach(c => countMap.set(c.playlist_id, (countMap.get(c.playlist_id) || 0) + 1))

  res.json(playlists.map(p => ({ ...p, song_count: countMap.get(p.id) || 0 })))
})

// Get playlist by ID with songs
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('*, users(username)')
    .eq('id', id)
    .single()

  if (playlistError) return res.status(404).json({ error: 'Playlist not found' })

  const { data: songs, error: songsError } = await supabase
    .from('playlist_songs')
    .select(`
      id,
      added_at,
      songs (
        id,
        title,
        bpm,
        genre,
        year_released
      )
    `)
    .eq('playlist_id', id)
    .order('added_at', { ascending: false })

  if (songsError) return res.status(500).json({ error: songsError.message })

  res.json({
    ...playlist,
    songs: songs?.map(s => ({ ...s.songs, added_at: s.added_at })) || []
  })
})

// Get playlists that contain a specific song (for current user)
router.get('/song/:songId', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { songId } = req.params

  const { data: playlists, error: playlistsError } = await supabase
    .from('playlists')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (playlistsError) return res.status(500).json({ error: playlistsError.message })

  const { data: playlistSongs, error: songsError } = await supabase
    .from('playlist_songs')
    .select('playlist_id')
    .eq('song_id', songId)

  if (songsError) return res.status(500).json({ error: songsError.message })

  const containingSongIds = new Set(playlistSongs?.map(ps => ps.playlist_id) || [])

  res.json(playlists?.map(p => ({
    ...p,
    hasSong: containingSongIds.has(p.id)
  })) || [])
})

// Create playlist
router.post('/', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

  const { data, error } = await supabase
    .from('playlists')
    .insert({ user_id: userId, name: name.trim() })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// Rename playlist
router.patch('/:id', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const { name } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
  if (playlist.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  const { data, error } = await supabase
    .from('playlists')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Delete playlist
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params

  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
  if (playlist.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Playlist deleted' })
})

// Add song to playlist
router.post('/:id/songs', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const { songId } = req.body

  if (!songId) return res.status(400).json({ error: 'songId is required' })

  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
  if (playlist.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  const { data, error } = await supabase
    .from('playlist_songs')
    .insert({ playlist_id: id, song_id: songId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Song already in playlist' })
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(data)
})

// Remove song from playlist
router.delete('/:id/songs/:songId', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id, songId } = req.params

  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
  if (playlist.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabase
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', id)
    .eq('song_id', songId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Song removed from playlist' })
})

export default router
