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

  if (!response.ok) {
    const error = await response.json() as { error: string; error_description?: string }
    throw new Error(`Spotify token exchange failed: ${error.error_description || error.error}`)
  }

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

  if (!response.ok) {
    const error = await response.json() as { error: string; error_description?: string }
    throw new Error(`Spotify token refresh failed: ${error.error_description || error.error}`)
  }

  return response.json() as Promise<SpotifyTokens>
}

// ============================================
// SDK-based API methods
// ============================================

export async function getCurrentUser(accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.currentUser.profile()
}

export async function getUserPlaylists(accessToken: string, limit = 50, offset = 0) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.currentUser.playlists.playlists(limit as 0 | 50, offset)
}

export async function getPlaylistTracks(playlistId: string, accessToken: string, limit = 50, offset = 0) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.playlists.getPlaylistItems(playlistId, undefined, undefined, limit as 0 | 50, offset)
}

export async function searchTracks(query: string, accessToken: string, limit = 20) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.search(query, ['track'], undefined, limit as 0 | 50)
}

export async function createPlaylist(userId: string, name: string, description: string, accessToken: string, isPublic = true) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.playlists.createPlaylist(userId, { name, description, public: isPublic })
}

export async function addTracksToPlaylist(playlistId: string, trackUris: string[], accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.playlists.addItemsToPlaylist(playlistId, trackUris)
}

export async function getTrack(trackId: string, accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.tracks.get(trackId)
}

export async function getTrackAudioFeatures(trackId: string, accessToken: string) {
  const sdk = createSpotifyClient(accessToken)
  return sdk.tracks.audioFeatures(trackId)
}
