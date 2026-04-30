import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Button, Avatar, Box, Card, Dialog, Flex, Heading, Text } from '@radix-ui/themes'
import AddToPlaylistModal from '../features/playlists/components/AddToPlaylistModal'
import DeleteSongModal from '../features/songs/components/DeleteSongModal'
import EditSongModal from '../features/songs/components/EditSongModal'
import RatingSong from '../features/songs/components/RatingSong'
import { Heart, Headphones, Clock, Star, Plus, GitMerge, PencilLine, ScrollText, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SPOTIFY_OPEN_TRACK_URL } from '../lib/spotify'
import { supabase } from '../lib/supabase'
import {SpotifyIcon} from '../features/spotify/components/SpotifyConnectButton'
import SongSuggestionModal from '../features/proposals/components/SongProposalModal'
import MergeProposalModal from '../features/proposals/components/MergeSongsProposalModal'
import { MOCK_CURRENT_USER_ID } from '@/lib/auth'
import LoginPromptModal from '../components/LoginPromptModal'

/**
 * SongPage.tsx
 *
 * Description:
 * This UI displays the song and information
 *  
 * Author: 
 * 
 */

function PlaceholderCover({ title, size = 160 }: { title: string; size?: number }) {
  const hashStr = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i)
      h |= 0
    }
    return Math.abs(h)
  }

  const seed = hashStr(title || 'Untitled')
  const hue = seed % 360
  const colorBg = `hsl(${hue}, 40%, 12%)`
  const colorAccent = `hsl(${(hue + 30) % 360}, 80%, 60%)`
  
  // Clean up title and grab the first 3 words
  const titleWords = (title || 'Untitled').trim().split(/\s+/)
  // Reverse them so word[0] is the bottom-most word near the accent line
  const displayWords = [...titleWords].reverse()

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      preserveAspectRatio="xMidYMid slice"
      style={{ borderRadius: '6px', background: colorBg }}
    >
      <defs>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0" />
        </filter>

        <radialGradient id="glow" cx="80%" cy="20%" r="70%">
          <stop offset="0%" stopColor={colorAccent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colorAccent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill={colorBg} />
      <rect width="100" height="100" fill="url(#glow)" />
      <rect width="100" height="100" filter="url(#noise)" />

      {/* Modern Typographic Layout */}
      <g transform="translate(10, 84)">
        {displayWords.map((word, i) => (
          <text
            key={i}
            x="0"
            y={-i * 11} // Moves upwards for each word
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize={word.length > 10 ? "8.5" : "10.5"}
            fontWeight="800"
            fill="white"
            style={{ 
              textTransform: 'uppercase', 
              letterSpacing: '-0.03em',
              opacity: 1 - (i * 0.1) // Top words fade out slightly
            }}
          >
            {word}
          </text>
        ))}
      </g>

      <rect x="10" y="88" width="12" height="1.5" fill={colorAccent} rx="0.75" />
    </svg>
  )
}

interface Song {
  id: string
  title: string
  bpm?: number | null
  genre?: string | null
  year_released?: number | null
  duration_ms?: number | null
  spotify_import?: boolean
  spotify_id?: string | null
  album_id?: string | null
  albums?: { id: string; name: string } | null
  song_artists?: Array<{ artists?: { id: string; name: string } }>
  song_credits?: Array<{
    role?: string | null
    artist_id?: string | null
    artist_name?: string | null
    artists?: { id?: string; name: string } | Array<{ id?: string; name: string }> | null
  }>
}

type NormalizedSongCredit = {
  artistId: string | null
  artistName: string | null
  role: string | null
}

function normalizeSongCredits(song: Song | null): NormalizedSongCredit[] {
  return (song?.song_credits ?? [])
    .map((credit) => {
      const relatedArtist = Array.isArray(credit.artists)
        ? credit.artists[0]
        : credit.artists

      const artistName = relatedArtist?.name?.trim() || credit.artist_name?.trim() || null
      const role = credit.role?.trim() || null

      if (!artistName && !role) {
        return null
      }

      return {
        artistId: relatedArtist?.id ?? credit.artist_id ?? null,
        artistName,
        role,
      }
    })
    .filter((credit): credit is NormalizedSongCredit => Boolean(credit))
    .sort((left, right) => {
      const roleCompare = String(left.role ?? '').localeCompare(String(right.role ?? ''))
      if (roleCompare !== 0) return roleCompare
      return String(left.artistName ?? '').localeCompare(String(right.artistName ?? ''))
    })
}

export default function SongPage() {
    const { user } = useAuth()
    const currentUserId = user?.id ?? MOCK_CURRENT_USER_ID
    const { id } = useParams()
  const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [song, setSong] = useState<Song | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [suggestionOpen, setSuggestionOpen] = useState(false)
    const [mergeOpen, setMergeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
    const [playlistOpen, setPlaylistOpen] = useState(false)
    const [creditsOpen, setCreditsOpen] = useState(false)
    const [listenedCount, setListenedCount] = useState(0)
    const [averageRating, setAverageRating] = useState<number | null>(null)
    const [ratingsCount, setRatingsCount] = useState<number | null>(null)
    const [coverUrl, setCoverUrl] = useState<string | null>(null)
    const [listened, setListened] = useState(false)
    const [listento, setListento] = useState(false)
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)
    const [reviews, setReviews] = useState<{id: string; content: string; created_at: string; user_id: string; users: { username: string; picture_url?: string }; review_likes?: { user_id: string }[];}[]>([])
    const [reviewText, setReviewText] = useState('')
    const [reviewError, setReviewError] = useState<string | null>(null)
    const [submittingReview, setSubmittingReview] = useState(false)
    const [userRating, setUserRating] = useState<number | null>(null)
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
    const [editReviewText, setEditReviewText] = useState('')
    const [editReviewError, setEditReviewError] = useState<string | null>(null)
    const [loginPromptOpen, setLoginPromptOpen] = useState(false)
    const [loginPromptAction, setLoginPromptAction] = useState('')
    

    const MAX_CHARS = 100
    const userReview = reviews.find(r => r.user_id === user?.id)


    useEffect(() => {
      if (!id) return

      async function fetchSong() {
        setLoading(true)
        try {
          // Fetch song with album and artist relations directly from Supabase
          const { data, error } = await supabase
            .from('songs')
            .select(`
              *,
              albums!left (id, name),
              song_artists ( artists ( id, name ) )
            `)
            .eq('id', id)
            .single()

          if (error) {
            setError('Failed to load song')
            return
          }

          let creditsData: Song['song_credits'] = []
          try {
            const creditsRes = await fetch(`/api/songs/${id}/credits`)
            if (!creditsRes.ok) {
              throw new Error('Failed to load song credits')
            }

            creditsData = await creditsRes.json()
          } catch (creditsError) {
            console.error('Failed to load song credits', creditsError)
          }

          setSong({
            ...(data as any),
            song_credits: creditsData ?? [],
          })
          // aggregated engagement details (listens, likes, average rating)
          try {
            const engRes = await fetch(`/api/songs/${id}/engagement`)
            if (engRes.ok) {
              const eng = await engRes.json()
              setListenedCount(eng.listenedCount ?? 0)
              setLikeCount(eng.likeCount ?? 0)
              setAverageRating(eng.average ?? null)
              setRatingsCount(eng.count ?? 0)
            }
          } catch (err) {
            console.error('Failed to load engagement details', err)
          }

          const reviewsRes = await fetch(`/api/reviews/song/${id}`)
          if (reviewsRes.ok) setReviews(await reviewsRes.json())
          
        } catch (err) {
          setError('Failed to fetch song')
          console.error(err)
        } finally {
          setLoading(false)
        }
      }

      fetchSong()
    }, [id])

    useEffect(() => {
        if (!user || !id) return

        const userId = user.id

        async function fetchUserSongData() {
          try {
            const statusRes = await fetch(`/api/songs/${id}/status`, {
              headers: { 'x-user-id': userId }
            })
            if (statusRes.ok) {
              const statusData = await statusRes.json()
              setListened(statusData.listened ?? false)
              setListento(statusData.listento ?? false)
              setLiked(statusData.liked ?? false)
              setUserRating(statusData.rating ?? null)
            }
          } catch (err) {
            console.error(err)
          }
        }
        fetchUserSongData()
      }, [user, id])

// Fetch Spotify cover when song becomes available.
// Try public oEmbed first so cover can be shown even when current user
// hasn't connected Spotify. Fall back to backend (requires user token).
useEffect(() => {
  if (!song?.spotify_id) return
  let cancelled = false
  ;(async () => {
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${song.spotify_id}`
      const oeRes = await fetch(oembedUrl)
      if (oeRes.ok) {
        const oe = await oeRes.json()
        const thumb = oe?.thumbnail_url || oe?.thumbnail || null
        if (!cancelled && thumb) {
          setCoverUrl(thumb)
          return
        }
      }
    } catch (e) {
      // ignore oembed/network errors and fallback
    }
  })()
  return () => { cancelled = true }
}, [song?.spotify_id, user])



  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">{error}</main><Footer /></div>
  if (!song) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">Song not found</main><Footer /></div>

  const artists = song.song_artists?.map((entry) => entry?.artists).filter(Boolean) as Array<{ id: string; name: string }> | undefined
  const credits = normalizeSongCredits(song)
  const canManageSong = Boolean(user?.isAdmin)


  return (
    <Box className="min-h-screen flex flex-col">
      <Navbar />
      <Box className="max-w-3xl mx-auto flex-1 w-full p-6">
        <Card size="3" className="p-6">
          <Flex gap="4" align="start">
            <div className="w-40 flex-shrink-0 pr-4">
              <div className="relative w-40 h-40 rounded-md overflow-hidden bg-muted-foreground/5 flex items-center justify-center">
                {coverUrl ? (
                  <img src={coverUrl} alt={`${song.title} cover`} className="w-full h-full object-cover" />
                ) : (
                  <PlaceholderCover title={song.title} />
                )}
                {song.spotify_id && (
                  <div className="absolute bottom-2 right-2 flex items-center justify-center shadow">
                    <SpotifyIcon />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <Flex justify="between" align="start" gap="3">
                <Heading size="7">{song.title}</Heading>
                {user && (
                  <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1 shadow-sm">
                    <Button
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() => setSuggestionOpen(true)}
                      title="Suggest an edit"
                      aria-label="Suggest an edit"
                      className="rounded-full"
                    >
                      <PencilLine className="w-4 h-4" />
                    </Button>
                    <Button
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() => setMergeOpen(true)}
                      title="Suggest a merge"
                      aria-label="Suggest a merge"
                      className="rounded-full"
                    >
                      <GitMerge className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Flex>

              <div className="mt-3 flex flex-wrap gap-2">
                {artists && artists.length > 0 ? (
                  artists.map((artist) => (
                    <Link key={artist.id} to={`/artists/${artist.id}`} className="no-underline">
                      <div className="px-3 py-1 rounded-full bg-muted-foreground/5 text-sm hover:bg-muted-foreground/10">{artist.name}</div>
                    </Link>
                  ))
                ) : (
                  <Text size="2" color="gray">Unknown artist</Text>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                {song.genre && <div className="px-3 py-1 rounded-full bg-primary/5 text-sm">{song.genre}</div>}
                {song.bpm != null && <div className="px-3 py-1 rounded-full bg-primary/5 text-sm">{song.bpm} BPM</div>}
                {song.year_released != null && <div className="px-3 py-1 rounded-full bg-primary/5 text-sm">{song.year_released}</div>}
                {song.albums?.name && (
                  <Link to={`/albums/${song.album_id}`} className="no-underline">
                    <div className="px-3 py-1 rounded-full bg-primary/5 text-sm hover:bg-primary/10">{song.albums.name}</div>
                  </Link>
                )}
                <Button size="1" variant="soft" color="gray" onClick={() => setCreditsOpen(true)}>
                  <ScrollText className="w-4 h-4" />
                  Credits
                  {credits.length > 0 ? ` (${credits.length})` : ''}
                </Button>
              </div>

              {canManageSong && (
                <div className="mt-4 flex items-center gap-2">
                  <Button size="2" onClick={() => setEditOpen(true)}>Edit</Button>
                  <Button size="2" color="red" onClick={() => setDeleteOpen(true)}>Delete</Button>
                </div>
              )}

              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Headphones className="w-5 h-5" />
                  <span className="font-medium">{listenedCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="w-5 h-5 text-destructive" />
                  <span className="font-medium">{likeCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">
                    {averageRating !== null ? (
                      <>
                        <span>{averageRating.toFixed(1)}</span>
                        <Star className="w-4 h-4 inline-block ml-1" />
                      </>
                    ) : (
                      'No ratings'
                    )}
                    <span className="text-xs text-muted-foreground ml-2">({ratingsCount ?? 0})</span>
                  </span>
                </div>
              </div>
              </div>

            <div className="hidden md:flex md:flex-col md:items-start md:pl-4 w-28">
              <Text size="2" color="gray">Platforms</Text>
              <div className="mt-2 flex flex-col gap-2">
                {song.spotify_id && (
                  <a href={`${SPOTIFY_OPEN_TRACK_URL}${song.spotify_id}`} target="_blank" rel="noopener noreferrer" className="no-underline flex items-center gap-2">
                    <SpotifyIcon />
                    <span className="text-sm">Spotify</span>
                  </a>
                )}
              </div>
            </div>
          </Flex>
        </Card>

        {/* Per-user actions (like / listen-to / listened) — grouped and more prominent */}
        {user && (
          <div className="mt-6">
            <div className="flex items-center gap-2 justify-center">
              {/* Listen Later */}
              <div className="w-20 flex flex-col items-center">
                <Button
                  size="3"
                  variant={listento ? 'solid' : 'ghost'}
                  color={listento ? 'green' : 'gray'}
                  className="rounded-full w-12 h-12 flex items-center justify-center"
                  aria-label={listento ? 'Remove from Listen To' : 'Add to Listen To'}
                  onClick={async () => {
                    if (!user) return alert('You must be logged in to mark as listen to')
                    const was = listento
                    const optimistic = !was
                    setListento(optimistic)
                    try {
                      const method = optimistic ? 'POST' : 'DELETE'
                      const res = await fetch(`/api/songs/${id}/listento`, {
                        method,
                        headers: { 'x-user-id': user.id }
                      })
                      if (!res.ok) {
                        setListento(was)
                        console.error('Failed to update listen-to')
                      }
                    } catch (err) {
                      setListento(was)
                      console.error(err)
                    }
                  }}
                >
                  <Clock className="w-5 h-5" />
                </Button>
                <span className="text-xs text-muted-foreground mt-1 h-4">Later</span>
              </div>

              {/* Listened */}
              <div className="w-20 flex flex-col items-center">
                <Button
                  size="3"
                  variant={listened ? 'solid' : 'ghost'}
                  color={listened ? 'green' : 'gray'}
                  className="rounded-full w-12 h-12 flex items-center justify-center"
                  aria-label={listened ? 'Unmark listened' : 'Mark as listened'}
                  onClick={async () => {
                    if (!user) return alert('You must be logged in to mark as listened')
                    const wasListened = listened
                    const optimistic = !wasListened
                    setListened(optimistic)
                    setListenedCount(c => optimistic ? c + 1 : Math.max(0, c - 1))
                    try {
                      const method = optimistic ? 'POST' : 'DELETE'
                      const res = await fetch(`/api/songs/${id}/listened`, {
                        method,
                        headers: { 'x-user-id': user.id }
                      })
                      if (!res.ok) {
                        // revert
                        setListened(wasListened)
                        setListenedCount(c => optimistic ? Math.max(0, c - 1) : c + 1)
                        console.error('Failed to update listened')
                      }
                    } catch (err) {
                      setListened(wasListened)
                      setListenedCount(c => optimistic ? Math.max(0, c - 1) : c + 1)
                      console.error(err)
                    }
                  }}
                >
                  <Headphones className="w-5 h-5" />
                </Button>
                <span className="text-xs text-muted-foreground mt-1 h-4">Listened</span>
              </div>

              {/* Like */}
              <div className="w-20 flex flex-col items-center">
                <Button
                  size="3"
                  variant={liked ? 'solid' : 'ghost'}
                  color={liked ? 'red' : 'gray'}
                  className="rounded-full w-12 h-12 flex items-center justify-center"
                  aria-label={liked ? 'Unlike' : 'Like'}
                  onClick={async () => {
                    if (!user) return alert('You must be logged in to like a song')
                    const wasLiked = liked
                    const optimistic = !wasLiked
                    setLiked(optimistic)
                    setLikeCount(c => optimistic ? c + 1 : Math.max(0, c - 1))
                    try {
                      const method = optimistic ? 'POST' : 'DELETE'
                      const res = await fetch(`/api/likes/${id}`, {
                        method,
                        headers: { 'x-user-id': user.id }
                      })
                      if (!res.ok) {
                        setLiked(wasLiked)
                        setLikeCount(c => optimistic ? Math.max(0, c - 1) : c + 1)
                        console.error('Failed to update like')
                      }
                    } catch (err) {
                      setLiked(wasLiked)
                      setLikeCount(c => optimistic ? Math.max(0, c - 1) : c + 1)
                      console.error(err)
                    }
                  }}
                >
                  <Heart className="w-5 h-5" />
                </Button>
                <span className="text-xs text-muted-foreground mt-1 h-4">Like</span>
              </div>
              {/* Add to Playlist action */}
              <div className="w-20 flex flex-col items-center">
                <Button
                  size="3"
                  variant="ghost"
                  color="gray"
                  className="rounded-full w-12 h-12 flex items-center justify-center"
                  aria-label="Add to playlist"
                  onClick={() => setPlaylistOpen(true)}
                >
                  <Plus className="w-5 h-5" />
                </Button>
                <span className="text-xs text-muted-foreground mt-1 h-4">Playlist</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center">
              <RatingSong
                id={song.id}
                showAverage={false}
                initialAverage={averageRating}
                initialUserRating={userRating}
                onAverageChange={(a, c) => { setAverageRating(a); setRatingsCount(c ?? 0); }}
                onUserRatingChange={(r) => setUserRating(r)}
              />
              <span className="text-xs text-muted-foreground mt-1">Rate</span>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <section className="max-w-2xl mx-auto w-full px-6 pb-16 mt-6">
          <h2 className="text-xl font-bold mb-6">Reviews</h2>

          {user && !userReview && (
            <div className="mb-8 p-4 rounded-xl border border-border bg-card">
              <h3 className="text-sm font-medium mb-2">Leave a Review</h3>
              <textarea
                value={reviewText}
                onChange={e => { setReviewText(e.target.value); setReviewError(null) }}
                placeholder="What did you think of this song?"
                rows={4}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${reviewText.length >= MAX_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {reviewText.length}/{MAX_CHARS}
                </span>
                <div className="flex items-center gap-3">
                  {reviewError && <span className="text-xs text-destructive">{reviewError}</span>}
                  <Button
                    size="2"
                    disabled={submittingReview || !reviewText.trim()}
                    onClick={async () => {
                      if (reviewText.trim().length > MAX_CHARS) {
                        setReviewError(`Review cannot exceed ${MAX_CHARS} characters`)
                        return
                      }
                      setSubmittingReview(true)
                      setReviewError(null)
                      try {
                        const res = await fetch(`/api/reviews/${id}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
                          body: JSON.stringify({ content: reviewText.trim() }),
                        })
                        const data = await res.json()
                        if (!res.ok) { setReviewError(data.error); return }
                        setReviews(prev => [data, ...prev])
                        setReviewText('')
                      } catch {
                        setReviewError('Failed to submit review')
                      } finally {
                        setSubmittingReview(false)
                      }
                    }}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No reviews yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Link to={`/user/${review.user_id}`}>
                        <Avatar 
                          size="2" 
                          radius="full" 
                          src={review.users?.picture_url}
                          fallback={review.users?.username?.slice(0, 2).toUpperCase() || '??'} 
                          className="hover:opacity-80 transition-opacity"
                        />
                      </Link>
                      <Link to={`/user/${review.user_id}`} className="text-sm font-medium text-foreground hover:text-primary no-underline">
                        {review.users.username}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    <div className="flex items-center gap-2">
                      <button
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          review.review_likes?.some((like) => like.user_id === user?.id)
                            ? 'text-destructive'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={async () => {
                          if (!user) {
                            setLoginPromptAction('like a review')
                            setLoginPromptOpen(true)
                            return
                          }

                          const hasLiked = review.review_likes?.some((like) => like.user_id === user.id);
                          const optimisticLiked = !hasLiked;

                          setReviews((prev) =>
                            prev.map((r) => {
                              if (r.id === review.id) {
                                const newLikes = optimisticLiked
                                  ? [...(r.review_likes || []), { user_id: user.id }]
                                  : (r.review_likes || []).filter((like) => like.user_id !== user.id);
                                return { ...r, review_likes: newLikes };
                              }
                              return r;
                            })
                          );

                          try {
                            const method = optimisticLiked ? 'POST' : 'DELETE';
                            const res = await fetch(`/api/reviews/${review.id}/like`, {
                              method,
                              headers: { 'x-user-id': user.id },
                            });

                            if (!res.ok) console.error('Failed to toggle review like');
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      >
                        <Heart 
                          className={`w-4 h-4 ${review.review_likes?.some((like) => like.user_id === user?.id) ? 'fill-current' : ''}`} 
                        />
                        <span className="font-medium">{review.review_likes?.length || 0}</span>
                      </button>
                    </div>
                      {(user?.id === review.user_id) && (
                        <button
                            className="text-xs text-primary hover:underline cursor-pointer"
                            onClick={() => {
                              setEditingReviewId(review.id)
                              setEditReviewText(review.content)
                              setEditReviewError(null)
                            }}
                          >
                            Edit
                          </button>
                      )}
                      {(user?.id === review.user_id || user?.isAdmin === true) && (
                        <button
                          className="text-xs text-destructive hover:underline cursor-pointer"
                          onClick={async () => {
                            const res = await fetch(`/api/reviews/${review.id}`, {
                              method: 'DELETE',
                              headers: { 'x-user-id': user.id },
                            })
                            if (res.ok) setReviews(prev => prev.filter(r => r.id !== review.id))
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Toggle between Edit Mode and View Mode */}
                  {editingReviewId === review.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editReviewText}
                        onChange={(e) => { setEditReviewText(e.target.value); setEditReviewError(null); }}
                        rows={3}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${editReviewText.length >= MAX_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {editReviewText.length}/{MAX_CHARS}
                        </span>
                        <div className="flex items-center gap-3">
                          {editReviewError && <span className="text-xs text-destructive">{editReviewError}</span>}
                          <Button size="1" variant="soft" color="gray" onClick={() => setEditingReviewId(null)}>Cancel</Button>
                          <Button
                            size="1"
                            disabled={!editReviewText.trim() || editReviewText === review.content}
                            onClick={async () => {
                              if (editReviewText.trim().length > MAX_CHARS) {
                                setEditReviewError(`Review cannot exceed ${MAX_CHARS} characters`);
                                return;
                              }
                              try {
                                const res = await fetch(`/api/reviews/${review.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
                                  body: JSON.stringify({ content: editReviewText.trim() })
                                });
                                if (!res.ok) {
                                  const data = await res.json();
                                  setEditReviewError(data.error || 'Failed to update review');
                                  return;
                                }
                                const updatedReview = await res.json();
                                // Update the specific review in the UI state
                                setReviews(prev => prev.map(r => r.id === review.id ? { ...r, content: updatedReview.content } : r));
                                setEditingReviewId(null);
                              } catch (err) {
                                setEditReviewError('Failed to update review');
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{review.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Hidden modals kept intact */}
        {user && (
          <>
            <AddToPlaylistModal isOpen={playlistOpen} onClose={() => setPlaylistOpen(false)} songId={song.id} />
            <EditSongModal
              isOpen={editOpen}
              onClose={() => setEditOpen(false)}
              song={{
                id: song.id,
                title: song.title,
                bpm: song.bpm ?? 0,
                genre: song.genre ?? '',
                year_released: song.year_released ?? 0,
                spotify_id: song.spotify_id ?? null,
              }}
              onUpdated={(updatedSong) => {
                setSong((currentSong) => currentSong ? { ...currentSong, ...updatedSong } : currentSong)
                setEditOpen(false)
              }}
            />
            <DeleteSongModal
              isOpen={deleteOpen}
              onClose={() => setDeleteOpen(false)}
              songId={song.id}
              songTitle={song.title}
              onDeleted={() => navigate('/feed')}
            />
            <SongSuggestionModal open={suggestionOpen} onOpenChange={setSuggestionOpen} currentUserId={user.id} song={song} />
            <MergeProposalModal open={mergeOpen} onOpenChange={setMergeOpen} currentUserId={user.id} song={song} />
          </>
        )}

        <Dialog.Root open={creditsOpen} onOpenChange={setCreditsOpen}>
          <Dialog.Content maxWidth="560px">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Dialog.Title mb="0">Credits</Dialog.Title>
                <Dialog.Description size="2" color="gray">
                  {credits.length > 0
                    ? `Credits for ${song.title} (${song.year_released}).`
                    : 'No credits have been attached to this song yet.'}
                </Dialog.Description>
              </div>
              <Dialog.Close>
                <button className="rounded-full border border-border/70 p-2 text-muted-foreground transition hover:border-border hover:text-foreground" aria-label="Close credits">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-4 space-y-3">
              {credits.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/45 px-4 py-6 text-center text-sm text-muted-foreground">
                  No credits listed yet.
                </div>
              ) : (
                credits.map((credit, index) => (
                  <div
                    key={`${credit.artistId ?? credit.artistName ?? 'credit'}-${credit.role ?? 'unknown'}-${index}`}
                    className="rounded-2xl border border-border/70 bg-background/55 px-4 py-4 shadow-sm"
                  >
                    <Flex justify="between" align="center" gap="3" wrap="wrap">
                      {credit.artistName ? (
                        <Link
                          to={`/search?credit=${encodeURIComponent(credit.artistName)}`}
                          className="text-base font-medium text-foreground no-underline hover:text-primary"
                        >
                          {credit.artistName}
                        </Link>
                      ) : (
                        <Text className="text-base font-medium text-foreground">Unknown artist</Text>
                      )}
                      <Text size="1" className="uppercase tracking-[0.22em] text-muted-foreground">
                        {credit.role ?? 'Unspecified role'}
                      </Text>
                    </Flex>
                  </div>
                ))
              )}
            </div>

            <Flex justify="end" mt="4">
              <Button variant="soft" color="gray" onClick={() => setCreditsOpen(false)}>
                Close
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
        <LoginPromptModal 
          isOpen={loginPromptOpen} 
          onClose={() => setLoginPromptOpen(false)} 
          actionName={loginPromptAction} 
        />
      </Box>
      <Footer />
    </Box>
  )
}


