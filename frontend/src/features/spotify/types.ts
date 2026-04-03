// Spotify-related types for frontend

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
    tempo: number
  }
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[]
    total: number
  }
}

export interface ImportResult {
  success: boolean
  playlist: {
    id: string
    name: string
  }
  imported: number
  skipped: number
  skippedSongs: string[]
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
