// This does some type checking and validation. Also helps vscode do autocomplete 

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          email: string
          privacy: 'public' | 'private'
          created_at: string
        }
        Insert: {
          id: string
          username: string
          email: string
          privacy?: 'public' | 'private'
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          email?: string
          privacy?: 'public' | 'private'
          created_at?: string
        }
      }
      artists: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      albums: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      songs: {
        Row: {
          id: string
          title: string
          bpm: number | null
          genre: string | null
          year_released: number | null
          album_id: string | null
          created_at: string
          user_id: string | null
          spotify_id: string | null
          trending_score: number | null
        }
        Insert: {
          id?: string
          title: string
          bpm?: number | null
          genre?: string | null
          year_released?: number | null
          album_id?: string | null
          created_at?: string
          user_id: string | null
          spotify_id?: string | null
          trending_score: number | null
        }
        Update: {
          id?: string
          title?: string
          bpm?: number | null
          genre?: string | null
          year_released?: number | null
          album_id?: string | null
          created_at?: string
          user_id: string | null
          spotify_id?: string | null
          trending_score: number | null
        }
      }
      song_artists: {
        Row: {
          song_id: string
          artist_id: string
        }
        Insert: {
          song_id: string
          artist_id: string
        }
        Update: {
          song_id?: string
          artist_id?: string
        }
      }
      album_artists: {
        Row: {
          album_id: string
          artist_id: string
        }
        Insert: {
          album_id: string
          artist_id: string
        }
        Update: {
          album_id?: string
          artist_id?: string
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          song_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_id?: string
          content?: string
          created_at?: string
        }
      }
      likes: {
        Row: {
          id: string
          user_id: string
          song_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_id?: string
          created_at?: string
        }
      }
      ratings: {
        Row: {
          id: string
          user_id: string
          song_id: string
          rating: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_id: string
          rating: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_id?: string
          rating?: number
          created_at?: string
        }
      }
      listened: {
        Row: {
          id: string
          user_id: string
          song_id: string
          has_listened: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_id: string
          has_listened?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_id?: string
          has_listened?: boolean
          created_at?: string
        }
      }
      listento: {
        Row: {
          id: string
          user_id: string
          song_id: string
          add_listento: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_id: string
          add_listento?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_id?: string
          add_listento: boolean
          created_at?: string
        }
      }
      playlists: {
        Row: {
          id: string
          user_id: string
          name: string
          is_pinned: boolean
          created_at: string
          spotify_playlist_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          is_pinned?: boolean
          created_at?: string
          spotify_playlist_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          is_pinned?: boolean
          created_at?: string
          spotify_playlist_id?: string | null
        }
      }
      playlist_songs: {
        Row: {
          id: string
          playlist_id: string
          song_id: string
          position: number
          added_at: string
        }
        Insert: {
          id?: string
          playlist_id: string
          song_id: string
          position?: number
          added_at?: string
        }
        Update: {
          id?: string
          playlist_id?: string
          song_id?: string
          position?: number
          added_at?: string
        }
      }
      recommendations: {
        Row: {
          id: string
          source_song_id: string
          recommended_song_id: string
          user_id: string | null
          is_helpful: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          source_song_id: string
          recommended_song_id: string
          user_id?: string | null
          is_helpful?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          source_song_id?: string
          recommended_song_id?: string
          user_id?: string | null
          is_helpful?: boolean | null
          created_at?: string
        }
      }
      friend_requests: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          addressee_id?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
      }
      user_spotify_tokens: {
        Row: {
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          spotify_display_name: string | null
          spotify_profile_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          spotify_display_name?: string | null
          spotify_profile_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          access_token?: string
          refresh_token?: string
          expires_at?: string
          spotify_display_name?: string | null
          spotify_profile_url?: string | null
          created_at?: string
          updated_at?: string
          favorite_songs: {
            Row: {
              id: string
              user_id: string
              song_id: string
              position: number
              created_at: string
            }
            Insert: {
              id?: string
              user_id: string
              song_id: string
              position: number
              created_at?: string
            }
            Update: {
              id?: string
              user_id?: string
              song_id?: string
              position?: number
              created_at?: string
            }
          }
        }
      }
    }
  }
}
// These are helper types for easier use
export type Tables = Database['public']['Tables']
export type User = Tables['users']['Row']
export type Artist = Tables['artists']['Row']
export type Album = Tables['albums']['Row']
export type Song = Tables['songs']['Row']
export type Review = Tables['reviews']['Row']
export type Like = Tables['likes']['Row']
export type Rating = Tables['ratings']['Row']
export type Listened = Tables['listened']['Row']
export type Playlist = Tables['playlists']['Row']
export type PlaylistSong = Tables['playlist_songs']['Row']
export type Recommendation = Tables['recommendations']['Row']
export type FriendRequest = Tables['friend_requests']['Row']
export type UserSpotifyToken = Tables['user_spotify_tokens']['Row']
export type FavoriteSong = Tables['favorite_songs']['Row']
