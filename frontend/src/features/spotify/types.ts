// Spotify-related types for frontend

export type SpotifyEntityType = 'track' | 'artist' | 'album'

export interface SpotifyLookupItem {
  id: string
  type: SpotifyEntityType
  name: string
  subtitle: string
  image_url: string | null
  spotify_url: string | null
}

export interface SpotifyEntitySearchResult {
  type: SpotifyEntityType
  total: number
  items: SpotifyLookupItem[]
}

export interface SpotifyConnectionStatus {
  connected: boolean
  displayName?: string
  profileUrl?: string
  connectedAt?: string
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string | null
  images: Array<{ url: string; height: number; width: number }>
  items: {
    href?: string
    total: number
  }
  owner: {
    id: string
    display_name: string
  }
  external_urls: {
    spotify: string
  }
}

export interface SpotifyTrack {
  id: string
  name: string
  duration_ms: number
  external_urls: {
    spotify: string
  }
  artists: Array<{
    id: string
    name: string
  }>
  album: {
    id: string
    name: string
    release_date: string
    images: Array<{ url: string; height: number; width: number }>
  }
  audioFeatures?: {
    tempo: number | null
  }
  bpm?: number | null
  genres?: string[]
  primaryGenre?: string | null
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[]
    total: number
  }
}

export interface PlaylistImportCandidate {
  songId: string
  title: string
  artistNames: string[]
  albumName: string | null
  spotifyId: string | null
  confidence: number
  reasons: string[]
}

export interface PlaylistImportPreviewItem {
  trackId: string
  title: string
  artists: string[]
  album: string | null
  year_released: number | null
  bpm: number | null
  position: number
  matchState: 'linked' | 'match_available' | 'no_match'
  songId: string | null
  matchedTitle?: string | null
  candidates: PlaylistImportCandidate[]
}

export interface PlaylistImportPreview {
  playlist: {
    id: string
    name: string
  }
  counts: {
    linked: number
    matchAvailable: number
    noMatch: number
    skipped: number
  }
  items: PlaylistImportPreviewItem[]
  skipped: Array<{ title: string; reason?: string }>
}

export interface ImportResult {
  success: boolean
  playlist: {
    id: string
    name: string
  }
  counts: {
    linked: number
    confirmed: number
    unmatched: number
    skipped: number
  }
  added: Array<{
    title: string
    songId: string
    position: number
    source: 'linked' | 'confirmed'
  }>
  unmatched: Array<{ title: string; trackId: string }>
  skipped: Array<{ title: string; reason?: string }>
}

export interface ExportResult {
  success: boolean
  spotifyPlaylist: {
    id: string
    name: string
    url: string
  }
  matched: number
  unmatched: number
  unmatchedSongs: string[]
}
