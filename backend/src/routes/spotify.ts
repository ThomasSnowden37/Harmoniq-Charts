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

    // Try to fetch genres from the track's artists (combine unique genres)
    let genres: string[] = []
    try {
      if (track && Array.isArray((track as any).artists) && (track as any).artists.length > 0) {
        const artistIds = (track as any).artists.map((a: any) => a.id).filter(Boolean)
        const genreSet = new Set<string>()
        for (const artistId of artistIds) {
          try {
            const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (artistRes.ok) {
              const artistData = await artistRes.json()
              if (Array.isArray(artistData.genres)) {
                for (const g of artistData.genres) genreSet.add(g)
              }
            }
          } catch (e) {
            // ignore individual artist fetch errors
          }
        }
        genres = Array.from(genreSet)
      }
    } catch (err) {
      console.error('Failed to fetch artist genres:', err)
    }

    // Normalize audio features (SDKs may wrap the response)
    const extractTempo = (af: any): number | null => {
      if (!af) return null
      if (typeof af.tempo === 'number') return af.tempo
      if (af?.body && typeof af.body.tempo === 'number') return af.body.tempo
      if (af?.audio_features && typeof af.audio_features.tempo === 'number') return af.audio_features.tempo
      if (af?.audio_features?.body && typeof af.audio_features.body.tempo === 'number') return af.audio_features.body.tempo
      return null
    }

    let tempo = extractTempo(audioFeatures)

    // If Spotify audio features didn't provide tempo, try ReccoBeats API as a fallback
    if (tempo === null) {
      try {
        const rbRes = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${encodeURIComponent(trackId)}`)
        if (rbRes.ok) {
          const rbJson = await rbRes.json()
          const content = rbJson?.content
          if (Array.isArray(content) && content.length > 0) {
            // Find matching item by href or id
            const found = content.find((c: any) => {
              if (c?.href && typeof c.href === 'string') return c.href.includes(`/track/${trackId}`)
              if (c?.id && typeof c.id === 'string') return c.id === trackId
              return false
            }) || content[0]

            if (found && typeof found.tempo === 'number') {
              tempo = found.tempo
            }
          }
        }
      } catch (err) {
        console.error('ReccoBeats tempo fetch failed:', err)
      }
    }

    const bpm = tempo ? Math.round(tempo) : null

    // Return flattened fields to make frontend consumption predictable
    res.json({
      ...track,
      audioFeatures: { tempo: tempo ?? null },
      bpm,
      genres,
      primaryGenre: genres.length > 0 ? genres[0] : null,
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
      let result: any
      try {
        result = await spotify.getPlaylistTracks(spotifyPlaylistId, accessToken, limit, offset)
      } catch (err: any) {
        console.error('Spotify getPlaylistTracks error:', err)
        const msg = err?.message || String(err)
        if (msg.includes('Forbidden') || msg.includes('Bad OAuth') || msg.includes('401') || msg.includes('403')) {
          return res.status(502).json({
            error: 'Spotify API returned a Forbidden/OAuth error while fetching playlist tracks. Check that your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET match the app used to authorize users, ensure the stored tokens in the database are valid, and re-link the Spotify account if needed. Error details: ' + msg,
          })
        }
        throw err
      }

      allTracks = allTracks.concat(result.items)

      if (offset + limit >= result.total) break
      offset += limit
    }

    // Filter out null tracks (deleted songs)
    // Normalize different playlist-item shapes returned by Spotify SDKs/APIs.
    // Some responses wrap the real track object as `item`, some as `track`,
    // and some callers may return the track object directly.
    const normalized = allTracks.map((t: any) => {
      let trackObj = null as any
      // Case: Spotify v1-like: { track: { ... } }
      if (t && typeof t === 'object') {
        if (t.track && typeof t.track === 'object') trackObj = t.track
        // Case: some responses use `item` to hold the track
        else if (t.item && typeof t.item === 'object') trackObj = (t.item.track && typeof t.item.track === 'object') ? t.item.track : t.item
        // Case: the item is already the track object
        else if (t.name || t.id) trackObj = t
      }
      return { raw: t, track: trackObj }
    })

    const validTracks = normalized.filter(n => n.track && n.track.id)

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

    for (const nItem of validTracks) {
      const item = nItem.raw
      const track = nItem.track
      const trackName = track?.name ?? 'Unknown track'
      
      try {
        // Attempt to determine BPM for this track: Spotify audio features, then ReccoBeats fallback
        let tempoImport: number | null = null
        try {
          const audioFeaturesImport = await spotify.getTrackAudioFeatures(track.id, accessToken).catch(() => null)
          const extractTempoImport = (af: any): number | null => {
            if (!af) return null
            if (typeof af.tempo === 'number') return af.tempo
            if (af?.body && typeof af.body.tempo === 'number') return af.body.tempo
            if (af?.audio_features && typeof af.audio_features.tempo === 'number') return af.audio_features.tempo
            if (af?.audio_features?.body && typeof af.audio_features.body.tempo === 'number') return af.audio_features.body.tempo
            return null
          }
          tempoImport = extractTempoImport(audioFeaturesImport)
        } catch (e) {
          // ignore
        }

        if (tempoImport === null) {
          try {
            const rbRes = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${encodeURIComponent(track.id)}`)
            if (rbRes.ok) {
              const rbJson = await rbRes.json()
              const content = rbJson?.content
              if (Array.isArray(content) && content.length > 0) {
                const found = content.find((c: any) => {
                  if (c?.href && typeof c.href === 'string') return c.href.includes(`/track/${track.id}`)
                  if (c?.id && typeof c.id === 'string') return c.id === track.id
                  return false
                }) || content[0]

                if (found && typeof found.tempo === 'number') {
                  tempoImport = found.tempo
                }
              }
            }
          } catch (err) {
            console.error('ReccoBeats tempo fetch failed during import:', err)
          }
        }

        const bpm = tempoImport ? Math.round(tempoImport) : null

        // Check if song with this spotify_id already exists (include bpm to allow conditional update)
        const { data: existingSong } = await supabase
          .from('songs')
          .select('id, bpm')
          .eq('spotify_id', track.id)
          .single()

        let songId: string

        if (existingSong) {
          // Use existing song
          songId = existingSong.id
          // If the existing song is missing BPM but we determined one, update it
          try {
            if ((existingSong as any).bpm == null && bpm != null) {
              await supabase.from('songs').update({ bpm }).eq('id', songId)
            }
          } catch (e) {
            console.error('Failed to update existing song bpm', { songId, bpm, error: e })
          }
        } else {
          // Create artists (prefer spotify_id when present; fallback to name)
          const artistIds: string[] = []
          for (const artist of (track.artists || [])) {
            let existingArtist: any = null
            // Try find by spotify_id (silently ignore errors if column missing)
            try {
              const { data: bySpotify } = await supabase
                .from('artists')
                .select('id')
                .eq('spotify_id', artist.id)
                .single()
              if (bySpotify) existingArtist = bySpotify
            } catch (e) {
              // ignore - maybe spotify_id column doesn't exist yet
            }

            // Fallback: search by name
            if (!existingArtist) {
              try {
                const { data: byName } = await supabase
                  .from('artists')
                  .select('id')
                  .eq('name', artist.name)
                  .single()
                if (byName) existingArtist = byName
              } catch (e) {
                // ignore query error
              }
            }

            if (existingArtist) {
              artistIds.push(existingArtist.id)
            } else {
              const { data: newArtist } = await supabase
                .from('artists')
                .insert({ name: artist.name })
                .select()
                .single()

              if (newArtist) {
                // Try to save spotify_id when possible (ignore failures)
                try {
                  await supabase.from('artists').update({ spotify_id: artist.id }).eq('id', newArtist.id)
                } catch (e) {
                  // ignore
                }
                artistIds.push(newArtist.id)
              }
            }
          }

          // Create album
          let albumId: string | null = null
          if (track.album) {
            // Prefer lookup by spotify album id
            let existingAlbum: any = null
            try {
              const { data: bySpotify } = await supabase
                .from('albums')
                .select('id')
                .eq('spotify_id', track.album.id)
                .single()
              if (bySpotify) existingAlbum = bySpotify
            } catch (e) {
              // ignore
            }

            if (!existingAlbum) {
              try {
                const { data: byName } = await supabase
                  .from('albums')
                  .select('id')
                  .eq('name', track.album.name)
                  .single()
                if (byName) existingAlbum = byName
              } catch (e) {
                // ignore
              }
            }

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
                // Try to save spotify_id when possible (ignore failures)
                try {
                  await supabase.from('albums').update({ spotify_id: track.album.id }).eq('id', newAlbum.id)
                } catch (e) {
                  // ignore
                }

                // Link album to artists
                for (const artistId of artistIds) {
                  try {
                    await supabase
                      .from('album_artists')
                      .insert({ album_id: albumId, artist_id: artistId })
                      .single()
                  } catch (e) {
                    console.error('Failed to link album to artist', { albumId, artistId, error: e })
                  }
                }
              }
            }
          }

          // Extract year from release_date
          const yearReleased = track.album?.release_date
            ? parseInt(track.album.release_date.split('-')[0])
            : null

          // Create song (store spotify_id only; spotify_url column will be removed)
          const { data: newSong, error: songError } = await supabase
            .from('songs')
            .insert({
              title: trackName,
              album_id: albumId,
              year_released: yearReleased,
              user_id: userId,
              spotify_id: track.id,
              bpm: bpm ?? null,
            })
            .select()
            .single()

          if (songError || !newSong) {
            skippedSongs.push(trackName)
            continue
          }

          songId = newSong.id

          // Link song to artists
          for (const artistId of (artistIds || [])) {
            try {
              await supabase
                .from('song_artists')
                .insert({ song_id: songId, artist_id: artistId })
                .single()
            } catch (e) {
              console.error('Failed to link song to artist', { songId, artistId, error: e })
            }
          }
        }

        // Add song to playlist
        await supabase
          .from('playlist_songs')
          .insert({ playlist_id: newPlaylist.id, song_id: songId })

        importedSongs.push(trackName)
      } catch (err) {
        skippedSongs.push(trackName)
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
