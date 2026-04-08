/**
 * Spotify Routes
 * 
 * Handles Spotify OAuth flow, playlist import/export,
 * and track search functionality.
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import * as spotify from '../lib/spotify.js'
import { determineTrackTempo, fetchReccoBeatsTempo } from '../lib/tempo.js'
import { fetchAllPlaylistTracks, normalizePlaylistItems } from '../lib/playlist.js'
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
    } catch (err: any) {
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
              const artistData: any = await artistRes.json()
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
    } catch (err: any) {
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
        const rbTempo = await fetchReccoBeatsTempo(trackId)
        if (rbTempo !== null) tempo = rbTempo
      } catch (err: any) {
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

/**
 * POST /import-playlist/preview-stream
 * Stream a preview of importing a Spotify playlist as newline-delimited JSON (NDJSON).
 * Each line is a JSON object with a `type` field: 'init', 'item', or 'complete'.
 */
router.post('/import-playlist/preview-stream', async (req: Request, res: Response) => {
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
    let allTracks: any[] = []
    try {
      allTracks = await fetchAllPlaylistTracks(spotifyPlaylistId, accessToken, 100)
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg.includes('Forbidden') || msg.includes('Bad OAuth') || msg.includes('401') || msg.includes('403')) {
        return res.status(502).json({ error: 'Spotify API returned a Forbidden/OAuth error while fetching playlist tracks. Error details: ' + msg })
      }
      throw err
    }

    const normalized = normalizePlaylistItems(allTracks)

    const validTracks = normalized.filter(n => n.track && n.track.id)
    const total = validTracks.length

    // Prepare streaming headers
    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    if ((res as any).flushHeaders) (res as any).flushHeaders()

    let aborted = false
    req.on('close', () => { aborted = true })

    const foundResults: Array<{ title: string; songId?: string }> = []
    const toImportResults: Array<any> = []
    const skippedResults: Array<{ title: string; reason?: string }> = []

    // Send init message
    res.write(JSON.stringify({ type: 'init', total, playlist: { id: spotifyPlaylistId, name: playlistName || 'Imported from Spotify' } }) + '\n')

    for (let i = 0; i < validTracks.length; i++) {
      if (aborted) break
      const nItem = validTracks[i]
      const track = nItem.track
      const trackName = track?.name ?? 'Unknown track'

      try {
        // Determine BPM using centralized helper (Spotify audio-features, then ReccoBeats fallback)
        const tempoImport = await determineTrackTempo(track.id, accessToken)
        const bpm = tempoImport ? Math.round(tempoImport) : null

        // Check existing song by spotify_id
        let existingSong: any = null
        try {
          const { data } = await supabase
            .from('songs')
            .select('id, title')
            .eq('spotify_id', track.id)
            .single()
          existingSong = data
        } catch (e) {
          existingSong = null
        }

        if (existingSong) {
          foundResults.push({ title: existingSong.title ?? trackName, songId: existingSong.id })
          res.write(JSON.stringify({ type: 'item', index: i, total, item: { title: existingSong.title ?? trackName, songId: existingSong.id, found: true } }) + '\n')
        } else {
          const importDetail = {
            title: trackName,
            spotify_id: track.id,
            artists: (track.artists || []).map((a: any) => a.name),
            album: track.album?.name ?? null,
            year_released: track.album?.release_date ? parseInt(track.album.release_date.split('-')[0]) : null,
            bpm,
            songId: null,
            found: false,
          }
          toImportResults.push(importDetail)
          res.write(JSON.stringify({ type: 'item', index: i, total, item: importDetail }) + '\n')
        }
      } catch (err: any) {
        skippedResults.push({ title: trackName, reason: String((err as any)?.message || err) })
        res.write(JSON.stringify({ type: 'item', index: i, total, item: { title: trackName, reason: String((err as any)?.message || err), skipped: true } }) + '\n')
      }
    }

    // If the client aborted, do not attempt to write final summary
    if (aborted) {
      try { return res.end() } catch (e) { return }
    }

    // Final summary
    res.write(JSON.stringify({
      type: 'complete',
      counts: { found: foundResults.length, imported: toImportResults.length, skipped: skippedResults.length },
      found: foundResults,
      imported: toImportResults,
      skipped: skippedResults,
      playlist: { id: spotifyPlaylistId, name: playlistName || 'Imported from Spotify' },
    }) + '\n')

    return res.end()
  } catch (err: any) {
    console.error('Preview stream error:', err)
    if (!res.headersSent) return res.status(500).json({ error: err.message })
    try { res.write(JSON.stringify({ type: 'error', message: err.message }) + '\n') } catch (e) { }
    return res.end()
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
    try {
      allTracks = await fetchAllPlaylistTracks(spotifyPlaylistId, accessToken, 100)
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg.includes('Forbidden') || msg.includes('Bad OAuth') || msg.includes('401') || msg.includes('403')) {
        return res.status(502).json({
          error: 'Spotify API returned a Forbidden/OAuth error while fetching playlist tracks. Check that your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET match the app used to authorize users, ensure the stored tokens in the database are valid, and re-link the Spotify account if needed. Error details: ' + msg,
        })
      }
      throw err
    }

    // Filter out null tracks and normalize shape
    const normalized = normalizePlaylistItems(allTracks)

    const validTracks = normalized.filter(n => n.track && n.track.id)

    // Allow a preview mode where we only compute what would be created/linked
    const preview = Boolean(req.body?.preview)

    // Prepare result buckets
    const foundResults: Array<{ title: string; songId?: string }> = []
    const toImportResults: Array<any> = []
    const skippedResults: Array<{ title: string; reason?: string }> = []

    // Create the playlist in Harmoniq unless this is a preview run
    let newPlaylist: any = null
    if (!preview) {
      const { data: created, error: playlistError } = await supabase
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
      newPlaylist = created
    } else {
      newPlaylist = { id: spotifyPlaylistId, name: playlistName || 'Imported from Spotify' }
    }

    // Process each track: either preview (no writes) or perform real import
    for (const nItem of validTracks) {
      const item = nItem.raw
      const track = nItem.track
      const trackName = track?.name ?? 'Unknown track'

      try {
        // Determine BPM using centralized helper (Spotify audio-features, then ReccoBeats fallback)
        const tempoImport = await determineTrackTempo(track.id, accessToken)
        const bpm = tempoImport ? Math.round(tempoImport) : null

        // Check if song with this spotify_id already exists (include bpm to allow conditional update)
        const { data: existingSong } = await supabase
          .from('songs')
          .select('id, bpm, title')
          .eq('spotify_id', track.id)
          .single()

        let songId: string | null = null

        if (existingSong) {
          // Found an existing Harmoniq song linked to this Spotify track
          songId = existingSong.id
          foundResults.push({ title: existingSong.title ?? trackName, songId: existingSong.id })

          // If not preview, update BPM when missing
          if (!preview) {
            try {
              if ((existingSong as any).bpm == null && bpm != null) {
                await supabase.from('songs').update({ bpm }).eq('id', songId)
              }
            } catch (e) {
              console.error('Failed to update existing song bpm', { songId, bpm, error: e })
            }
          }
        } else {
          // Create artists (prefer spotify_id when present; fallback to name)
          const artistIds: string[] = []
          for (const artist of (track.artists || [])) {
            let existingArtist: any = null
            // Try find by spotify_id
            try {
              const { data: bySpotify } = await supabase
                .from('artists')
                .select('id')
                .eq('spotify_id', artist.id)
                .single()
              if (bySpotify) existingArtist = bySpotify
            } catch (e) {
              // ignore
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
            } else if (!preview) {
              // Only create artists when not in preview mode
              try {
                const { data: newArtist } = await supabase
                  .from('artists')
                  .insert({ name: artist.name })
                  .select()
                  .single()

                if (newArtist) {
                  artistIds.push(newArtist.id)
                  // Try to save spotify_id when possible (ignore failures)
                  try {
                    if (artist.id) {
                      await supabase.from('artists').update({ spotify_id: artist.id }).eq('id', newArtist.id)
                    }
                  } catch (e) {
                    // ignore
                  }
                } else {
                  // If insert didn't return a row, try to find by name again (concurrent insert)
                  try {
                    const { data: maybe } = await supabase
                      .from('artists')
                      .select('id')
                      .eq('name', artist.name)
                      .single()
                    if (maybe) artistIds.push(maybe.id)
                  } catch (e) {
                    // ignore
                  }
                }
              } catch (e) {
                // Insert error: try to find by name as a fallback
                try {
                  const { data: maybe } = await supabase
                    .from('artists')
                    .select('id')
                    .eq('name', artist.name)
                    .single()
                  if (maybe) artistIds.push(maybe.id)
                } catch (ee) {
                  // ignore
                }
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
            } else if (!preview) {
              try {
                const { data: newAlbum } = await supabase
                  .from('albums')
                  .insert({ name: track.album.name })
                  .select()
                  .single()

                if (newAlbum) {
                  albumId = newAlbum.id
                  // Try to save spotify_id when possible (ignore failures)
                  try {
                    if (track.album?.id) {
                      await supabase.from('albums').update({ spotify_id: track.album.id }).eq('id', newAlbum.id)
                    }
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
                } else {
                  // Try to find by name as fallback
                  try {
                    const { data: maybe } = await supabase
                      .from('albums')
                      .select('id')
                      .eq('name', track.album.name)
                      .single()
                    if (maybe) albumId = maybe.id
                  } catch (e) {
                    // ignore
                  }
                }
              } catch (e) {
                // Insert error fallback
                try {
                  const { data: maybe } = await supabase
                    .from('albums')
                    .select('id')
                    .eq('name', track.album.name)
                    .single()
                  if (maybe) albumId = maybe.id
                } catch (ee) {
                  // ignore
                }
              }
            }
          }

          // Extract year from release_date
          const yearReleased = track.album?.release_date
            ? parseInt(track.album.release_date.split('-')[0])
            : null

          // Create song (store spotify_id only; spotify_url column will be removed)
          let newSong: any = null
          let songError: any = null
          if (!preview) {
            try {
              const insertRes = await supabase
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

              newSong = insertRes.data
              songError = insertRes.error
            } catch (e) {
              songError = e
            }

            if (songError || !newSong) {
              skippedResults.push({ title: trackName, reason: 'Failed to create song' })
              continue
            }

            songId = newSong.id

            // If artistIds is empty for some reason, try to resolve by name before linking
            if ((artistIds || []).length === 0) {
              for (const artist of (track.artists || [])) {
                try {
                  const { data: maybe } = await supabase
                    .from('artists')
                    .select('id')
                    .eq('name', artist.name)
                    .single()
                  if (maybe) artistIds.push(maybe.id)
                } catch (e) {
                  // ignore
                }
              }
            }

            // Link song to artists (only when not preview)
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
          } else {
            // preview mode: do not write any DB rows; songId remains null
            songId = null
          }

          // Record import detail
          const importDetail = {
            title: trackName,
            spotify_id: track.id,
            artists: (track.artists || []).map((a: any) => a.name),
            album: track.album?.name ?? null,
            year_released: yearReleased,
            bpm,
            songId: songId,
          }

          toImportResults.push(importDetail)
        }

        // Add song to playlist (only when not preview)
        if (!preview && songId) {
          try {
            await supabase
              .from('playlist_songs')
              .insert({ playlist_id: newPlaylist.id, song_id: songId })
          } catch (e) {
            console.error('Failed to add song to playlist', { playlistId: newPlaylist?.id, songId, error: e })
            skippedResults.push({ title: trackName, reason: 'Failed to add to playlist' })
            continue
          }
        }
      } catch (err: any) {
        skippedResults.push({ title: trackName, reason: String((err as any)?.message || err) })
      }
    }

    // Respond with categorized results
    res.json({
      success: true,
      playlist: newPlaylist,
      counts: {
        found: foundResults.length,
        imported: toImportResults.length,
        skipped: skippedResults.length,
      },
      found: foundResults,
      imported: toImportResults,
      skipped: skippedResults,
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
        } catch (err: any) {
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
