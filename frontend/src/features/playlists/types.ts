export interface Playlist {
  id: string
  user_id: string
  name: string
  is_pinned: boolean
  created_at: string
  song_count?: number
}

export interface PlaylistWithSongs extends Playlist {
  users?: { username: string }
  songs: PlaylistSong[]
}

export interface PlaylistSong {
  id: string
  title: string
  bpm: number
  genre: string
  year_released: number
  added_at: string
}

export interface PlaylistCheckItem {
  id: string
  name: string
  hasSong: boolean
}
