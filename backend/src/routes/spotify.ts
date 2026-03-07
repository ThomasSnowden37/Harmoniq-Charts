/**
 * Spotify Routes
 * 
 * Handles Spotify OAuth flow, playlist import/export,
 * and track search functionality.
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import * as spotify from '../lib/spotify.js'
import crypto from 'crypto'

const router = Router()

function getUserId(req: Request): string | null {
  return req.headers['x-user-id'] as string || null
}

/**
 * Helper to get valid Spotify access token for a user.
 * Automatically refreshes if expired.
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: tokenData, error } = await supabase
    .from('user_spotify_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenData) return null

  const expiresAt = new Date(tokenData.expires_at)
  const now = new Date()

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const newTokens = await spotify.refreshAccessToken(tokenData.refresh_token)
      
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000)
      
      await supabase
        .from('user_spotify_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokenData.refresh_token,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      return newTokens.access_token
    } catch (err) {
      console.error('Failed to refresh Spotify token:', err)
      return null
    }
  }

  return tokenData.access_token
}

// ============================================
// OAuth Flow
// ============================================

/**
 * GET /auth/url
 * Generate Spotify OAuth authorization URL
 */
router.get('/auth/url', (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Use userId as state to verify callback (URL-safe base64)
  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  
  try {
    const authUrl = spotify.getAuthUrl(state)
    res.json({ url: authUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /auth/callback
 * Handle OAuth callback from Spotify
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query

  if (error) {
    // Redirect to frontend with error (to root, user can navigate)
    const frontendUrl = process.env.FRONTEND_URL
    return res.redirect(`${frontendUrl}/?spotify_error=${encodeURIComponent(error as string)}`)
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' })
  }

  try {
    // Decode URL-safe base64 state to get userId
    let base64 = (state as string).replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    while (base64.length % 4) base64 += '='
    const stateData = JSON.parse(Buffer.from(base64, 'base64').toString())
    const { userId } = stateData

    if (!userId) {
      throw new Error('Invalid state: missing userId')
    }

    // Exchange code for tokens
    const tokens = await spotify.exchangeCode(code as string)

    // Get user profile from Spotify
    const spotifyUser = await spotify.getCurrentUser(tokens.access_token)

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Store tokens in database (upsert)
    const { error: dbError } = await supabase
      .from('user_spotify_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        spotify_display_name: spotifyUser.display_name,
        spotify_profile_url: spotifyUser.external_urls.spotify,
        updated_at: new Date().toISOString(),
      })

    if (dbError) {
      throw new Error(`Failed to store tokens: ${dbError.message}`)
    }

    // Redirect to user's profile page with success
    const frontendUrl = process.env.FRONTEND_URL
    res.redirect(`${frontendUrl}/user/${userId}?spotify_connected=true`)
  } catch (err: any) {
    console.error('Spotify callback error:', err)
    const frontendUrl = process.env.FRONTEND_URL
    res.redirect(`${frontendUrl}/?spotify_error=${encodeURIComponent(err.message)}`)
  }
})

/**
 * GET /connection-status
 * Check if current user has connected Spotify
 */
router.get('/connection-status', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { data, error } = await supabase
    .from('user_spotify_tokens')
    .select('spotify_display_name, spotify_profile_url, updated_at')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return res.json({ connected: false })
  }

  res.json({
    connected: true,
    displayName: data.spotify_display_name,
    profileUrl: data.spotify_profile_url,
    connectedAt: data.updated_at,
  })
})

/**
 * DELETE /disconnect
 * Remove user's Spotify connection
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { error } = await supabase
    .from('user_spotify_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ success: true })
})

// ============================================
// Spotify Data Access
// ============================================

/**
 * GET /playlists
 * Get current user's Spotify playlists
 */
router.get('/playlists', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return res.status(401).json({ error: 'Spotify not connected or token expired' })
  }

  try {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    
    const result = await spotify.getUserPlaylists(accessToken, limit, offset)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /playlists/:playlistId/tracks
 * Get tracks from a specific Spotify playlist
 */
router.get('/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return res.status(401).json({ error: 'Spotify not connected or token expired' })
  }

  try {
    const { playlistId } = req.params
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    
    const result = await spotify.getPlaylistTracks(playlistId, accessToken, limit, offset)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /search
 * Search for tracks on Spotify
 */
router.get('/search', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return res.status(401).json({ error: 'Spotify not connected or token expired' })
  }

  try {
    const query = req.query.q as string
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const limit = parseInt(req.query.limit as string) || 20
    const result = await spotify.searchTracks(query, accessToken, limit)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /tracks/:trackId
 * Get a specific track with audio features
 */
router.get('/tracks/:trackId', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return res.status(401).json({ error: 'Spotify not connected or token expired' })
  }

  try {
    const { trackId } = req.params
    const [track, audioFeatures] = await Promise.all([
      spotify.getTrack(trackId, accessToken),
      spotify.getTrackAudioFeatures(trackId, accessToken).catch(() => null),
    ])

    res.json({
      ...track,
      audioFeatures,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Import/Export
// ============================================

/**
 * POST /import-playlist
 * Import a Spotify playlist into Harmoniq
 */
router.post('/import-playlist', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return res.status(401).json({ error: 'Spotify not connected or token expired' })
  }

  const { spotifyPlaylistId, playlistName } = req.body
  if (!spotifyPlaylistId) {
    return res.status(400).json({ error: 'spotifyPlaylistId is required' })
  }

  try {
    // Get all tracks from Spotify playlist (paginated)
    let allTracks: any[] = []
    let offset = 0
    const limit = 100

    while (true) {
      const result = await spotify.getPlaylistTracks(spotifyPlaylistId, accessToken, limit, offset)
      allTracks = allTracks.concat(result.items)
      
      if (offset + limit >= result.total) break
      offset += limit
    }

    // Filter out null tracks (deleted songs)
    const validTracks = allTracks.filter(t => t.track !== null)

    // Create the playlist in Harmoniq
    const { data: newPlaylist, error: playlistError } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        name: playlistName || 'Imported from Spotify',
        spotify_playlist_id: spotifyPlaylistId,
      })
      .select()
      .single()

    if (playlistError) {
      throw new Error(`Failed to create playlist: ${playlistError.message}`)
    }

    // Process each track: create artists, albums, and songs
    const importedSongs: string[] = []
    const skippedSongs: string[] = []

    for (const item of validTracks) {
      const track = item.track!
      
      try {
        // Check if song with this spotify_id already exists
        const { data: existingSong } = await supabase
          .from('songs')
          .select('id')
          .eq('spotify_id', track.id)
          .single()

        let songId: string

        if (existingSong) {
          // Use existing song
          songId = existingSong.id
        } else {
          // Create artists
          const artistIds: string[] = []
          for (const artist of track.artists) {
            // Check if artist exists
            const { data: existingArtist } = await supabase
              .from('artists')
              .select('id')
              .eq('name', artist.name)
              .single()

            if (existingArtist) {
              artistIds.push(existingArtist.id)
            } else {
              const { data: newArtist, error: artistError } = await supabase
                .from('artists')
                .insert({ name: artist.name })
                .select()
                .single()

              if (newArtist) artistIds.push(newArtist.id)
            }
          }

          // Create album
          let albumId: string | null = null
          if (track.album) {
            const { data: existingAlbum } = await supabase
              .from('albums')
              .select('id')
              .eq('name', track.album.name)
              .single()

            if (existingAlbum) {
              albumId = existingAlbum.id
            } else {
              const { data: newAlbum } = await supabase
                .from('albums')
                .insert({ name: track.album.name })
                .select()
                .single()

              if (newAlbum) {
                albumId = newAlbum.id
                
                // Link album to artists
                for (const artistId of artistIds) {
                  await supabase
                    .from('album_artists')
                    .insert({ album_id: albumId, artist_id: artistId })
                    .single()
                }
              }
            }
          }

          // Extract year from release_date
          const yearReleased = track.album?.release_date
            ? parseInt(track.album.release_date.split('-')[0])
            : null

          // Create song
          const { data: newSong, error: songError } = await supabase
            .from('songs')
            .insert({
              title: track.name,
              album_id: albumId,
              year_released: yearReleased,
              user_id: userId,
              spotify_id: track.id,
              spotify_url: track.external_urls.spotify,
            })
            .select()
            .single()

          if (songError || !newSong) {
            skippedSongs.push(track.name)
            continue
          }

          songId = newSong.id

          // Link song to artists
          for (const artistId of artistIds) {
            await supabase
              .from('song_artists')
              .insert({ song_id: songId, artist_id: artistId })
          }
        }

        // Add song to playlist
        await supabase
          .from('playlist_songs')
          .insert({ playlist_id: newPlaylist.id, song_id: songId })

        importedSongs.push(track.name)
      } catch (err) {
        skippedSongs.push(track.name)
      }
    }

    res.json({
      success: true,
      playlist: newPlaylist,
      imported: importedSongs.length,
      skipped: skippedSongs.length,
      skippedSongs,
    })
  } catch (err: any) {
    console.error('Import error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /export-playlist/:playlistId
 * Export a Harmoniq playlist to Spotify
 */
router.post('/export-playlist/:playlistId', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) {
    return res.status(401).json({ error: 'Spotify not connected or token expired' })
  }

  const { playlistId } = req.params
  const { name, description } = req.body

  try {
    // Get Harmoniq playlist with songs
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select(`
        id, name, user_id,
        playlist_songs (
          songs (
            id, title, spotify_id,
            song_artists (
              artists (name)
            )
          )
        )
      `)
      .eq('id', playlistId)
      .single()

    if (playlistError || !playlist) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    // Verify ownership
    if (playlist.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to export this playlist' })
    }

    // Get Spotify user ID
    const spotifyUser = await spotify.getCurrentUser(accessToken)

    // Create playlist on Spotify
    const spotifyPlaylist = await spotify.createPlaylist(
      spotifyUser.id,
      name || playlist.name,
      description || `Exported from Harmoniq`,
      accessToken
    )

    // Collect track URIs
    const trackUris: string[] = []
    const matchedSongs: string[] = []
    const unmatchedSongs: string[] = []

    for (const ps of (playlist.playlist_songs as any[])) {
      const song = ps.songs
      if (!song) continue

      if (song.spotify_id) {
        // Song has Spotify ID, use it directly
        trackUris.push(`spotify:track:${song.spotify_id}`)
        matchedSongs.push(song.title)
      } else {
        // Try to find on Spotify by searching
        const artistNames = song.song_artists
          ?.map((sa: any) => sa.artists?.name)
          .filter(Boolean) as string[] || []
        
        const searchQuery = artistNames.length > 0
          ? `${song.title} ${artistNames[0]}`
          : song.title

        try {
          const searchResult = await spotify.searchTracks(searchQuery, accessToken, 1)
          if (searchResult.tracks.items.length > 0) {
            const foundTrack = searchResult.tracks.items[0]
            trackUris.push(`spotify:track:${foundTrack.id}`)
            matchedSongs.push(song.title)
            
            // Optionally update the song with Spotify ID for future exports
            await supabase
              .from('songs')
              .update({
                spotify_id: foundTrack.id,
                spotify_url: foundTrack.external_urls.spotify,
              })
              .eq('id', song.id)
          } else {
            unmatchedSongs.push(song.title)
          }
        } catch (err) {
          unmatchedSongs.push(song.title)
        }
      }
    }

    // Add tracks to Spotify playlist (in batches of 100)
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100)
      await spotify.addTracksToPlaylist(spotifyPlaylist.id, batch, accessToken)
    }

    // Update Harmoniq playlist with Spotify playlist ID
    await supabase
      .from('playlists')
      .update({ spotify_playlist_id: spotifyPlaylist.id })
      .eq('id', playlistId)

    res.json({
      success: true,
      spotifyPlaylist: {
        id: spotifyPlaylist.id,
        name: spotifyPlaylist.name,
        url: spotifyPlaylist.external_urls.spotify,
      },
      matched: matchedSongs.length,
      unmatched: unmatchedSongs.length,
      unmatchedSongs,
    })
  } catch (err: any) {
    console.error('Export error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
