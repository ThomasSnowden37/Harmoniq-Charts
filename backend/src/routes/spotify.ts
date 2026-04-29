/**
 * Spotify Routes
 * 
 * Handles Spotify OAuth flow, playlist import/export,
 * and track search functionality.
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import * as spotify from '../lib/spotify.js'
import { detectDuplicateCandidates, proposalHighConfidenceMatchThreshold } from '../lib/proposals.js'
import { determineTrackTempo, fetchReccoBeatsTempo } from '../lib/tempo.js'
import { fetchAllPlaylistTracks, normalizePlaylistItems } from '../lib/playlist.js'
import crypto from 'crypto'

const router = Router()

function sendSpotifyRouteError(res: Response, err: unknown) {
  const context = spotify.getSpotifyErrorContext(err)
  if (context.statusCode === 429) {
    if (context.retryAfterSeconds !== null) {
      res.setHeader('Retry-After', String(context.retryAfterSeconds))
    }

    return res.status(429).json({ error: err instanceof Error ? err.message : 'Spotify rate limit exceeded' })
  }

  const statusCode = context.statusCode && context.statusCode >= 400 ? context.statusCode : 500
  return res.status(statusCode).json({ error: err instanceof Error ? err.message : 'Spotify request failed' })
}

function getUserId(req: Request): string | null {
  return req.headers['x-user-id'] as string || null
}

type SpotifyEntityType = 'track' | 'artist' | 'album'

function parseSpotifyEntityId(input: string, entityType: SpotifyEntityType): string | null {
  const value = input.trim()
  if (!value) return null

  const uriMatch = value.match(/^spotify:(track|artist|album):([a-zA-Z0-9]+)$/)
  if (uriMatch) return uriMatch[1].toLowerCase() === entityType ? uriMatch[2] : null

  try {
    const url = new URL(value)
    if (!url.hostname.includes('spotify.com')) return null
    const pathMatch = url.pathname.match(/\/(track|artist|album)\/([a-zA-Z0-9]+)/)
    if (!pathMatch) return null
    return pathMatch[1].toLowerCase() === entityType ? pathMatch[2] : null
  } catch {
    return /^[a-zA-Z0-9]+$/.test(value) ? value : null
  }
}

function normalizeSpotifyEntityItem(item: any, entityType: SpotifyEntityType) {
  if (!item?.id) return null

  if (entityType === 'track') {
    const artistNames = Array.isArray(item.artists)
      ? item.artists.map((artist: any) => String(artist?.name ?? '')).filter(Boolean)
      : []

    return {
      id: String(item.id),
      type: entityType,
      name: String(item.name ?? 'Unknown track'),
      subtitle: [artistNames.join(', '), item?.album?.name ? String(item.album.name) : null].filter(Boolean).join(' • '),
      image_url: item?.album?.images?.[0]?.url ?? item?.album?.images?.[1]?.url ?? null,
      spotify_url: typeof item?.external_urls?.spotify === 'string' ? item.external_urls.spotify : null,
    }
  }

  if (entityType === 'artist') {
    const genres = Array.isArray(item.genres)
      ? item.genres.map((genre: any) => String(genre)).filter(Boolean).slice(0, 2)
      : []

    return {
      id: String(item.id),
      type: entityType,
      name: String(item.name ?? 'Unknown artist'),
      subtitle: genres.length > 0 ? genres.join(' • ') : 'Artist',
      image_url: item?.images?.[0]?.url ?? item?.images?.[1]?.url ?? null,
      spotify_url: typeof item?.external_urls?.spotify === 'string' ? item.external_urls.spotify : null,
    }
  }

  const albumArtistNames = Array.isArray(item.artists)
    ? item.artists.map((artist: any) => String(artist?.name ?? '')).filter(Boolean)
    : []
  const releaseYear = typeof item?.release_date === 'string'
    ? String(item.release_date).split('-')[0] ?? null
    : null

  return {
    id: String(item.id),
    type: entityType,
    name: String(item.name ?? 'Unknown album'),
    subtitle: [albumArtistNames.join(', '), releaseYear].filter(Boolean).join(' • '),
    image_url: item?.images?.[0]?.url ?? item?.images?.[1]?.url ?? null,
    spotify_url: typeof item?.external_urls?.spotify === 'string' ? item.external_urls.spotify : null,
  }
}

async function getSpotifyEntity(entityType: SpotifyEntityType, entityId: string, accessToken: string) {
  switch (entityType) {
    case 'artist':
      return spotify.getArtist(entityId, accessToken)
    case 'album':
      return spotify.getAlbum(entityId, accessToken)
    default:
      return spotify.getTrack(entityId, accessToken)
  }
}

async function searchSpotifyEntities(entityType: SpotifyEntityType, query: string, accessToken: string, limit: number) {
  switch (entityType) {
    case 'artist': {
      const result = await spotify.searchArtists(query, accessToken, limit)
      return {
        items: result.artists?.items ?? [],
        total: result.artists?.total ?? 0,
      }
    }
    case 'album': {
      const result = await spotify.searchAlbums(query, accessToken, limit)
      return {
        items: result.albums?.items ?? [],
        total: result.albums?.total ?? 0,
      }
    }
    default: {
      const result = await spotify.searchTracks(query, accessToken, limit)
      return {
        items: result.tracks?.items ?? [],
        total: result.tracks?.total ?? 0,
      }
    }
  }
}

function trackReleaseYear(track: any): number | null {
  const releaseDate = track?.album?.release_date
  if (!releaseDate) return null
  const year = Number.parseInt(String(releaseDate).split('-')[0] ?? '', 10)
  return Number.isFinite(year) ? year : null
}

function basePlaylistPreviewItem(track: any, bpm: number | null, position: number) {
  return {
    trackId: String(track.id),
    title: String(track?.name ?? 'Unknown track'),
    artists: Array.isArray(track?.artists) ? track.artists.map((artist: any) => String(artist?.name ?? '')).filter(Boolean) : [],
    album: typeof track?.album?.name === 'string' ? track.album.name : null,
    year_released: trackReleaseYear(track),
    bpm,
    position,
    matchState: 'no_match' as const,
    songId: null,
    matchedTitle: null,
    candidates: [],
  }
}

async function getRequestSpotifyAccessToken(userId: string | null): Promise<string | null> {
  if (userId) {
    const userToken = await getValidAccessToken(userId)
    if (userToken) {
      return userToken
    }
  }

  try {
    return await spotify.getAppAccessToken()
  } catch (err: any) {
    console.error('Failed to get app Spotify token:', err)
    return null
  }
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
    sendSpotifyRouteError(res, err)
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
    sendSpotifyRouteError(res, err)
  }
})

/**
 * GET /search
 * Search for tracks on Spotify
 */
router.get('/search', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const accessToken = await getRequestSpotifyAccessToken(userId)
  if (!accessToken) {
    return res.status(503).json({ error: 'Spotify lookup is currently unavailable' })
  }

  try {
    const query = req.query.q as string
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const limit = parseInt(req.query.limit as string) || 20

    const trackId = parseSpotifyEntityId(query, 'track')
    if (trackId) {
      const track = await spotify.getTrack(trackId, accessToken)
      return res.json({
        tracks: {
          items: track ? [track] : [],
          total: track ? 1 : 0,
        },
      })
    }

    const result = await spotify.searchTracks(query, accessToken, limit)
    res.json(result)
  } catch (err: any) {
    sendSpotifyRouteError(res, err)
  }
})

router.get('/search/entities', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const accessToken = await getRequestSpotifyAccessToken(userId)
  if (!accessToken) {
    return res.status(503).json({ error: 'Spotify lookup is currently unavailable' })
  }

  try {
    const query = req.query.q as string
    const entityType = req.query.type as SpotifyEntityType
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    if (entityType !== 'track' && entityType !== 'artist' && entityType !== 'album') {
      return res.status(400).json({ error: 'Query parameter "type" must be one of: track, artist, album' })
    }

    const requestedLimit = Number.parseInt(req.query.limit as string, 10)
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(6, requestedLimit)) : 6
    const directEntityId = parseSpotifyEntityId(query, entityType)

    if (directEntityId) {
      const entity = await getSpotifyEntity(entityType, directEntityId, accessToken)
      const item = normalizeSpotifyEntityItem(entity, entityType)
      return res.json({
        type: entityType,
        total: item ? 1 : 0,
        items: item ? [item] : [],
      })
    }

    const result = await searchSpotifyEntities(entityType, query, accessToken, limit)
    return res.json({
      type: entityType,
      total: result.total,
      items: result.items
        .map((item) => normalizeSpotifyEntityItem(item, entityType))
        .filter(Boolean),
    })
  } catch (err: any) {
    sendSpotifyRouteError(res, err)
  }
})

router.get('/entities/:type/:entityId', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const accessToken = await getRequestSpotifyAccessToken(userId)
  if (!accessToken) {
    return res.status(503).json({ error: 'Spotify lookup is currently unavailable' })
  }

  try {
    const entityType = req.params.type as SpotifyEntityType
    const { entityId } = req.params

    if (entityType !== 'track' && entityType !== 'artist' && entityType !== 'album') {
      return res.status(400).json({ error: 'Route parameter "type" must be one of: track, artist, album' })
    }

    const entity = await getSpotifyEntity(entityType, entityId, accessToken)
    const item = normalizeSpotifyEntityItem(entity, entityType)
    if (!item) {
      return res.status(404).json({ error: 'Spotify entity not found' })
    }

    return res.json(item)
  } catch (err: any) {
    sendSpotifyRouteError(res, err)
  }
})

/**
 * GET /tracks/:trackId
 * Get a specific track with audio features
 */
router.get('/tracks/:trackId', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const accessToken = await getRequestSpotifyAccessToken(userId)
  if (!accessToken) {
    return res.status(503).json({ error: 'Spotify lookup is currently unavailable' })
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
            const artistData: any = await spotify.getArtist(artistId, accessToken)
            if (Array.isArray(artistData.genres)) {
              for (const g of artistData.genres) genreSet.add(g)
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
    sendSpotifyRouteError(res, err)
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

    const linkedResults: any[] = []
    const matchResults: any[] = []
    const unmatchedResults: any[] = []
    const skippedResults: Array<{ title: string; reason?: string }> = []
    const previewItems: any[] = []

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
          const previewItem = {
            ...basePlaylistPreviewItem(track, bpm, i),
            matchState: 'linked' as const,
            songId: String(existingSong.id),
            matchedTitle: String(existingSong.title ?? trackName),
          }

          linkedResults.push(previewItem)
          previewItems.push(previewItem)
          res.write(JSON.stringify({ type: 'item', index: i, total, item: previewItem }) + '\n')
        } else {
          const candidates = await detectDuplicateCandidates({
            title: trackName,
            artist_name: Array.isArray(track.artists) ? track.artists.map((artist: any) => artist.name).join(', ') : '',
            album_name: track.album?.name ?? undefined,
            year_released: trackReleaseYear(track) ?? undefined,
          })
          const confidentCandidates = candidates
            .filter((candidate) => candidate.confidence >= proposalHighConfidenceMatchThreshold())
            .slice(0, 3)

          const previewItem = {
            ...basePlaylistPreviewItem(track, bpm, i),
            matchState: confidentCandidates.length > 0 ? 'match_available' as const : 'no_match' as const,
            candidates: confidentCandidates,
          }

          if (confidentCandidates.length > 0) {
            matchResults.push(previewItem)
          } else {
            unmatchedResults.push(previewItem)
          }

          previewItems.push(previewItem)
          res.write(JSON.stringify({ type: 'item', index: i, total, item: previewItem }) + '\n')
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
      counts: {
        linked: linkedResults.length,
        matchAvailable: matchResults.length,
        noMatch: unmatchedResults.length,
        skipped: skippedResults.length,
      },
      items: previewItems,
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
 * Import a Spotify playlist into Harmoniq using confirmed existing-song matches only.
 */
router.post('/import-playlist', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { spotifyPlaylistId, playlistName } = req.body
  if (!spotifyPlaylistId) {
    return res.status(400).json({ error: 'spotifyPlaylistId is required' })
  }


  const selectedMatches = Array.isArray(req.body?.selectedMatches) ? req.body.selectedMatches : []
  const unmatchedItems = Array.isArray(req.body?.unmatchedItems) ? req.body.unmatchedItems : []
  const skippedItems = Array.isArray(req.body?.skippedItems) ? req.body.skippedItems : []

  try {
    const { data: created, error: playlistError } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        name: playlistName || 'Imported from Spotify',
        spotify_playlist_id: spotifyPlaylistId,
      })
      .select()
      .single()

    if (playlistError || !created) {
      throw new Error(`Failed to create playlist: ${playlistError?.message ?? 'unknown error'}`)
    }

    const added: Array<{ title: string; songId: string; position: number; source: 'linked' | 'confirmed' }> = []
    const skipped: Array<{ title: string; reason?: string }> = [...skippedItems]

    for (const entry of selectedMatches) {
      const songId = typeof entry?.songId === 'string' ? entry.songId : null
      const title = typeof entry?.title === 'string' ? entry.title : 'Unknown song'
      const position = Number.isFinite(Number(entry?.position)) ? Number(entry.position) : added.length
      const source = entry?.source === 'linked' ? 'linked' : 'confirmed'

      if (!songId) {
        skipped.push({ title, reason: 'Missing selected song id' })
        continue
      }

      try {
        await supabase
          .from('playlist_songs')
          .insert({ playlist_id: created.id, song_id: songId, position })

        added.push({ title, songId, position, source })
      } catch (error) {
        skipped.push({ title, reason: 'Failed to add to playlist' })
      }
    }

    return res.json({
      success: true,
      playlist: {
        id: created.id,
        name: created.name,
      },
      counts: {
        linked: added.filter((entry) => entry.source === 'linked').length,
        confirmed: added.filter((entry) => entry.source === 'confirmed').length,
        unmatched: unmatchedItems.length,
        skipped: skipped.length,
      },
      added,
      unmatched: unmatchedItems,
      skipped,
    })
  } catch (err: any) {
    console.error('Import playlist error:', err)
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
