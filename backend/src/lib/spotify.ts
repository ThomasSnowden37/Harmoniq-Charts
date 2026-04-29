/**
 * Spotify API Client
 * 
 * Uses the official @spotify/web-api-ts-sdk for API interactions.
 * Handles OAuth flow manually since SDK requires existing tokens.
 */

import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import dotenv from 'dotenv'
dotenv.config()

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || ''

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.warn('Warning: Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env')
}

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1'
const SPOTIFY_MIN_REQUEST_INTERVAL_MS = Math.max(0, Number(process.env.SPOTIFY_MIN_REQUEST_INTERVAL_MS ?? 1000))

let appAccessTokenCache: { token: string; expiresAt: number } | null = null
let spotifyRequestQueue: Promise<void> = Promise.resolve()
let nextSpotifyRequestAt = 0

// Required scopes for our features
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
]

export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export class SpotifyHttpError extends Error {
  statusCode: number
  retryAfterSeconds: number | null

  constructor(message: string, statusCode: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'SpotifyHttpError'
    this.statusCode = statusCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Public-open Spotify URL base for tracks 
export const SPOTIFY_OPEN_TRACK_URL = 'https://open.spotify.com/track/'

function parseRetryAfterValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed
  }

  const dateMs = Date.parse(String(value))
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000))
  }

  return null
}

function extractHeaderValue(headers: unknown, headerName: string): string | null {
  if (!headers) return null

  if (typeof (headers as { get?: unknown }).get === 'function') {
    return ((headers as Headers).get(headerName) ?? (headers as Headers).get(headerName.toLowerCase()))
  }

  const source = headers as Record<string, unknown>
  const directMatch = source[headerName] ?? source[headerName.toLowerCase()]
  return typeof directMatch === 'string' ? directMatch : null
}

export function getSpotifyErrorContext(error: unknown): { statusCode: number | null; retryAfterSeconds: number | null } {
  if (error instanceof SpotifyHttpError) {
    return {
      statusCode: error.statusCode,
      retryAfterSeconds: error.retryAfterSeconds,
    }
  }

  const source = error as Record<string, unknown> | null
  const response = source?.response as Record<string, unknown> | undefined
  const body = source?.body as Record<string, unknown> | undefined
  const bodyError = body?.error as Record<string, unknown> | undefined
  const statusCode = Number(
    source?.status
    ?? source?.statusCode
    ?? response?.status
    ?? bodyError?.status,
  )

  const headers = source?.headers ?? response?.headers
  const retryAfterSeconds = parseRetryAfterValue(
    extractHeaderValue(headers, 'Retry-After')
    ?? (source?.retryAfter as string | number | undefined)
    ?? (source?.retry_after as string | number | undefined),
  )

  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
    retryAfterSeconds,
  }
}

function logSpotifyRateLimit(label: string, retryAfterSeconds: number | null): void {
  if (retryAfterSeconds !== null) {
    console.error(`[spotify] 429 rate limit hit during ${label}; Retry-After=${retryAfterSeconds}s`)
    return
  }

  console.error(`[spotify] 429 rate limit hit during ${label}; Retry-After header missing`)
}

function normalizeSpotifyError(error: unknown, label: string): SpotifyHttpError {
  const context = getSpotifyErrorContext(error)
  const fallbackMessage = error instanceof Error ? error.message : 'Spotify request failed'

  if (context.statusCode === 429) {
    logSpotifyRateLimit(label, context.retryAfterSeconds)
    return new SpotifyHttpError('The app has exceeded Spotify rate limits.', 429, context.retryAfterSeconds)
  }

  if (context.statusCode) {
    return new SpotifyHttpError(fallbackMessage, context.statusCode, context.retryAfterSeconds)
  }

  return new SpotifyHttpError(fallbackMessage, 500, context.retryAfterSeconds)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function enqueueSpotifyRequest<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const run = async () => {
    if (SPOTIFY_MIN_REQUEST_INTERVAL_MS > 0) {
      const scheduledStart = Math.max(Date.now(), nextSpotifyRequestAt)
      const waitMs = Math.max(0, scheduledStart - Date.now())
      if (waitMs > 0) {
        await sleep(waitMs)
      }
      nextSpotifyRequestAt = scheduledStart + SPOTIFY_MIN_REQUEST_INTERVAL_MS
    }

    try {
      return await operation()
    } catch (error) {
      throw normalizeSpotifyError(error, label)
    }
  }

  const result = spotifyRequestQueue.then(run, run)
  spotifyRequestQueue = result.then(() => undefined, () => undefined)
  return result
}

async function ensureSpotifyResponseOk(response: Response, label: string): Promise<Response> {
  if (response.ok) {
    return response
  }

  const retryAfterSeconds = parseRetryAfterValue(response.headers.get('Retry-After'))
  if (response.status === 429) {
    logSpotifyRateLimit(label, retryAfterSeconds)
  }

  let message = `Spotify request failed with status ${response.status}`
  try {
    const data = await response.json() as { error?: { message?: string } | string; error_description?: string }
    if (typeof data.error === 'string') {
      message = data.error
    } else if (data.error?.message) {
      message = data.error.message
    } else if (data.error_description) {
      message = data.error_description
    }
  } catch {
    // ignore body parse errors and fall back to status message
  }

  throw new SpotifyHttpError(message, response.status, retryAfterSeconds)
}

async function fetchSpotifyApi(path: string, accessToken: string, label: string): Promise<Response> {
  return enqueueSpotifyRequest(label, async () => {
    const response = await fetch(`${SPOTIFY_API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return ensureSpotifyResponseOk(response, label)
  })
}

export async function getArtist(artistId: string, accessToken: string) {
  const response = await fetchSpotifyApi(`/artists/${artistId}`, accessToken, `getArtist:${artistId}`)
  return response.json() as Promise<any>
}

export async function getAlbum(albumId: string, accessToken: string) {
  const response = await fetchSpotifyApi(`/albums/${albumId}`, accessToken, `getAlbum:${albumId}`)
  return response.json() as Promise<any>
}

/**
 * Create SDK instance with an existing access token
 */
export function createSpotifyClient(accessToken: string): SpotifyApi {
  return SpotifyApi.withAccessToken(SPOTIFY_CLIENT_ID, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: '',
  })
}

/**
 * Generate the Spotify OAuth authorization URL
 */
export function getAuthUrl(state: string): string {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_REDIRECT_URI) {
    throw new Error('Spotify credentials not configured')
  }

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state: state,
    show_dialog: 'true',
  })

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCode(code: string): Promise<SpotifyTokens> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
    throw new Error('Spotify credentials not configured')
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  })

  await ensureSpotifyResponseOk(response, 'exchangeCode')

  return response.json() as Promise<SpotifyTokens>
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured')
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  await ensureSpotifyResponseOk(response, 'refreshAccessToken')

  return response.json() as Promise<SpotifyTokens>
}

export async function getAppAccessToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured')
  }

  if (appAccessTokenCache && appAccessTokenCache.expiresAt > Date.now() + 30_000) {
    return appAccessTokenCache.token
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  })

  await ensureSpotifyResponseOk(response, 'getAppAccessToken')

  const data = await response.json() as { access_token: string; expires_in: number }
  appAccessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

// ============================================
// SDK-based API methods
// ============================================

export async function getCurrentUser(accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest('getCurrentUser', () => sdk.currentUser.profile())
}

export async function getUserPlaylists(accessToken: string, limit = 50, offset = 0) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`getUserPlaylists:${offset}:${limit}`, () => sdk.currentUser.playlists.playlists(limit as 0 | 50, offset))
}

export async function getPlaylistTracks(playlistId: string, accessToken: string, limit = 50, offset = 0) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`getPlaylistTracks:${playlistId}:${offset}:${limit}`, () => sdk.playlists.getPlaylistItems(playlistId, undefined, undefined, limit as 0 | 50, offset))
}

export async function searchTracks(query: string, accessToken: string, limit = 20) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`searchTracks:${query.slice(0, 80)}`, () => sdk.search(query, ['track'], undefined, limit as 0 | 50))
}

export async function searchArtists(query: string, accessToken: string, limit = 20) {
  const params = new URLSearchParams({
    q: query,
    type: 'artist',
    limit: String(limit),
  })
  const response = await fetchSpotifyApi(`/search?${params.toString()}`, accessToken, `searchArtists:${query.slice(0, 80)}`)
  return response.json() as Promise<{ artists: { items: any[]; total: number } }>
}

export async function searchAlbums(query: string, accessToken: string, limit = 20) {
  const params = new URLSearchParams({
    q: query,
    type: 'album',
    limit: String(limit),
  })
  const response = await fetchSpotifyApi(`/search?${params.toString()}`, accessToken, `searchAlbums:${query.slice(0, 80)}`)
  return response.json() as Promise<{ albums: { items: any[]; total: number } }>
}

export async function createPlaylist(userId: string, name: string, description: string, accessToken: string, isPublic = true) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`createPlaylist:${userId}:${name.slice(0, 40)}`, () => sdk.playlists.createPlaylist(userId, { name, description, public: isPublic }))
}

export async function addTracksToPlaylist(playlistId: string, trackUris: string[], accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`addTracksToPlaylist:${playlistId}:${trackUris.length}`, () => sdk.playlists.addItemsToPlaylist(playlistId, trackUris))
}

export async function getTrack(trackId: string, accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`getTrack:${trackId}`, () => sdk.tracks.get(trackId))
}

export async function getTrackAudioFeatures(trackId: string, accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return enqueueSpotifyRequest(`getTrackAudioFeatures:${trackId}`, () => sdk.tracks.audioFeatures(trackId))
}
