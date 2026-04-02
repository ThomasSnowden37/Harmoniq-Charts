import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { isFriend} from './friends.js'

const router = Router()

function getUserId(req: any): string | null {
  return req.headers['x-user-id'] as string || null
}

// Get number of playlists for a user
router.get('/user/:userId/count', async (req, res) => {
  const { userId } = req.params

  const { count } = await supabase
    .from('playlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  res.json({ playlists: count ?? 0 })
})

// Get all playlists for a user (with song counts and likes count)
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params
  const requesterId = req.headers['x-user-id'] as string | undefined
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

  // Get likes counts for all playlists
  const { data: likes } = await supabase
    .from('playlist_likes')
    .select('playlist_id')
    .in('playlist_id', playlistIds)

  const likesMap = new Map<string, number>()
  likes?.forEach(l => likesMap.set(l.playlist_id, (likesMap.get(l.playlist_id) || 0) + 1))

  // If there's a requester, fetch which playlists they have liked (so UI can show liked state)
  const likedSet = new Set<string>()
  if (requesterId) {
    const { data: userLikes } = await supabase
      .from('playlist_likes')
      .select('playlist_id')
      .eq('user_id', requesterId)
      .in('playlist_id', playlistIds)
    userLikes?.forEach(l => likedSet.add(l.playlist_id))
  }

  res.json(playlists.map(p => ({
    ...p,
    song_count: countMap.get(p.id) || 0,
    likes_count: likesMap.get(p.id) || 0,
    liked: likedSet.has(p.id) || false,
  })))
})

// Helper to check if a user can access a playlist (based on privacy)
async function canAccessPlaylist(playlistId: string, requesterId: string | undefined): Promise<{ allowed: boolean; playlist?: any }> {
  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id, users(privacy)')
    .eq('id', playlistId)
    .single()

  if (!playlist) return { allowed: false }

  const ownerPrivacy = (playlist.users as any)?.privacy
  if (ownerPrivacy !== 'private') return { allowed: true, playlist }

  const isOwner = requesterId === playlist.user_id
  if (isOwner) return { allowed: true, playlist }

  const isFriendFlag = requesterId ? await isFriend(requesterId, playlist.user_id) : false
  return { allowed: isFriendFlag, playlist }
}

// Get playlist by ID with songs
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const requesterId = req.headers['x-user-id'] as string | undefined

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('*, users(username, privacy)')
    .eq('id', id)
    .single()

  if (playlistError) return res.status(404).json({ error: 'Playlist not found' })

  // Privacy check: if owner is private, only owner or friends can view
  const ownerPrivacy = (playlist.users as any)?.privacy
  if (ownerPrivacy === 'private') {
    const isOwner = requesterId === playlist.user_id
    const isFriendFlag = requesterId ? await isFriend(requesterId, playlist.user_id) : false
    if (!isOwner && !isFriendFlag) {
      return res.status(403).json({ error: 'This playlist belongs to a private account' })
    }
  }

  const { data: songs, error: songsError } = await supabase
    .from('playlist_songs')
    .select(`
      id,
      added_at,
      position,
      songs (
        id,
        title,
        bpm,
        genre,
        year_released,
        song_artists(artists(id, name))
      )
    `)
    .eq('playlist_id', id)
    .order('position', { ascending: true })

  if (songsError) return res.status(500).json({ error: songsError.message })

  res.json({
    ...playlist,
    songs: songs?.map(s => ({ ...s.songs, added_at: s.added_at, position: s.position })) || []
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
  if (name.trim().length > 50) return res.status(400).json({ error: 'Name must be 50 characters or less' })

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
  if (name.trim().length > 50) return res.status(400).json({ error: 'Name must be 50 characters or less' })

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

// Pin/unpin a playlist
router.patch('/:id/pin', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const { is_pinned } = req.body

  if (typeof is_pinned !== 'boolean') return res.status(400).json({ error: 'is_pinned must be a boolean' })

  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
  if (playlist.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  const { data, error } = await supabase
    .from('playlists')
    .update({ is_pinned })
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

  // Get the next position
  const { data: existingSongs } = await supabase
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingSongs && existingSongs.length > 0 ? existingSongs[0].position + 1 : 0

  const { data, error } = await supabase
    .from('playlist_songs')
    .insert({ playlist_id: id, song_id: songId, position: nextPosition })
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

// Reorder songs in a playlist
router.put('/:id/reorder', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const { songIds } = req.body // array of song IDs in desired order

  if (!Array.isArray(songIds) || songIds.length === 0) {
    return res.status(400).json({ error: 'songIds array is required' })
  }

  const { data: playlist } = await supabase
    .from('playlists')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' })
  if (playlist.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  // Update each song's position
  const updates = songIds.map((songId: string, index: number) =>
    supabase
      .from('playlist_songs')
      .update({ position: index })
      .eq('playlist_id', id)
      .eq('song_id', songId)
  )

  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) return res.status(500).json({ error: failed.error.message })

  res.json({ message: 'Songs reordered' })
})

// ============ PLAYLIST LISTENED PROGRESS ============

// Get how many songs the current user has listened to in a playlist
router.get('/:id/listened-progress', async (req, res) => {
  const { id } = req.params
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { allowed } = await canAccessPlaylist(id, userId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  // Get all song IDs in the playlist
  const { data: playlistSongs, error: psError } = await supabase
    .from('playlist_songs')
    .select('song_id')
    .eq('playlist_id', id)

  if (psError) return res.status(500).json({ error: psError.message })

  const totalSongs = playlistSongs?.length || 0
  if (totalSongs === 0) return res.json({ total: 0, listened: 0, percentage: 0 })

  const songIds = playlistSongs!.map(ps => ps.song_id)

  // Count how many of those the user has listened to
  const { data: listenedSongs, error: lError } = await supabase
    .from('listened')
    .select('song_id')
    .eq('user_id', userId)
    .in('song_id', songIds)

  if (lError) return res.status(500).json({ error: lError.message })

  const listenedCount = listenedSongs?.length || 0
  const percentage = Math.round((listenedCount / totalSongs) * 100)

  res.json({ total: totalSongs, listened: listenedCount, percentage })
})

// ============ PLAYLIST LIKES ============

// Get likes count for a playlist
router.get('/:id/likes', async (req, res) => {
  const { id } = req.params
  const requesterId = req.headers['x-user-id'] as string | undefined

  const { allowed } = await canAccessPlaylist(id, requesterId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  const { count, error } = await supabase
    .from('playlist_likes')
    .select('*', { count: 'exact', head: true })
    .eq('playlist_id', id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ count: count ?? 0 })
})

// Check if current user liked a playlist
router.get('/:id/likes/check', async (req, res) => {
  const { id } = req.params
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { allowed } = await canAccessPlaylist(id, userId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  const { data, error } = await supabase
    .from('playlist_likes')
    .select('id')
    .eq('playlist_id', id)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message })
  }
  res.json({ liked: !!data })
})

// Like a playlist
router.post('/:id/likes', async (req, res) => {
  const { id } = req.params
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { allowed } = await canAccessPlaylist(id, userId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  const { data, error } = await supabase
    .from('playlist_likes')
    .insert({ playlist_id: id, user_id: userId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Already liked' })
    }
    return res.status(500).json({ error: error.message })
  }
  res.status(201).json(data)
})

// Unlike a playlist
router.delete('/:id/likes', async (req, res) => {
  const { id } = req.params
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { allowed } = await canAccessPlaylist(id, userId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  const { error } = await supabase
    .from('playlist_likes')
    .delete()
    .eq('playlist_id', id)
    .eq('user_id', userId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Like removed' })
})

// ============ PLAYLIST COMMENTS ============

// Get comments for a playlist
router.get('/:id/comments', async (req, res) => {
  const { id } = req.params
  const requesterId = req.headers['x-user-id'] as string | undefined

  const { allowed } = await canAccessPlaylist(id, requesterId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  const { data: comments, error } = await supabase
    .from('playlist_comments')
    .select('*, users(id, username)')
    .eq('playlist_id', id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(comments)
})

// Add a comment to a playlist
router.post('/:id/comments', async (req, res) => {
  const { id } = req.params
  const { content } = req.body
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { allowed } = await canAccessPlaylist(id, userId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' })
  }
  if (content.trim().length > 1000) {
    return res.status(400).json({ error: 'Comment must be 1000 characters or less' })
  }

  const { data, error } = await supabase
    .from('playlist_comments')
    .insert({ playlist_id: id, user_id: userId, content: content.trim() })
    .select('*, users(id, username)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// Delete a comment
router.delete('/:id/comments/:commentId', async (req, res) => {
  const { id, commentId } = req.params
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { allowed } = await canAccessPlaylist(id, userId)
  if (!allowed) return res.status(403).json({ error: 'This playlist belongs to a private account' })

  // Verify ownership
  const { data: comment, error: fetchError } = await supabase
    .from('playlist_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchError) return res.status(404).json({ error: 'Comment not found' })
  if (comment.user_id !== userId) return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabase
    .from('playlist_comments')
    .delete()
    .eq('id', commentId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Comment deleted' })
})

export default router
