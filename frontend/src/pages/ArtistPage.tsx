import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { PencilLine, Clock, Headphones, Heart } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LinkSpotifyEntityProposalModal from '../features/proposals/components/ArtistProposalModal'

interface Artist {
  id: string
  name: string
  spotify_id?: string | null
}

interface Song {
  id: string
  title: string
  genre?: string | null
  year_released?: number | null
  bpm?: number | null
  trending_score?: number | null
  albums?: { id: string; name: string } | Array<{ id: string; name: string }> | null
}

interface Album {
  id: string
  name: string
  spotify_id?: string | null
}

export default function ArtistPage() {
  const { artistId } = useParams()
  const { user } = useAuth()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [songActions, setSongAction] = useState<Record<string, {
    listened: boolean
    listento: boolean
    liked: boolean
  }>>({})

  useEffect(() => {
    if (!artistId) return

    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [artistResult, songResult, albumResult] = await Promise.all([
          supabase.from('artists').select('id, name, spotify_id').eq('id', artistId).single(),
          supabase
            .from('songs')
            .select('id, title, genre, year_released, bpm, trending_score, albums ( id, name ), song_artists!inner ( artist_id )')
            .eq('song_artists.artist_id', artistId),
          supabase
            .from('albums')
            .select('id, name, spotify_id, album_artists!inner ( artist_id )')
            .eq('album_artists.artist_id', artistId)
            .order('name', { ascending: true }),
        ])

        if (artistResult.error || !artistResult.data) {
          throw new Error(artistResult.error?.message ?? 'Failed to load artist')
        }
        if (songResult.error) {
          throw new Error(songResult.error.message)
        }
        if (albumResult.error) {
          throw new Error(albumResult.error.message)
        }

        const nextSongs = ((songResult.data ?? []) as Song[])
          .slice()
          .sort((left, right) => {
            const scoreDifference = Number(right.trending_score ?? 0) - Number(left.trending_score ?? 0)
            if (scoreDifference !== 0) return scoreDifference
            return left.title.localeCompare(right.title)
          })

        const dedupedAlbums = Array.from(new Map(((albumResult.data ?? []) as Album[]).map((album) => [album.id, album])).values())

        setArtist(artistResult.data as Artist)
        setSongs(nextSongs)
        if (user) {
          const statusEntries = await Promise.all(
            nextSongs.map(async song => {
              const res = await fetch(`/api/songs/${song.id}/status`, {
                headers: { 'x-user-id': user.id }
              })

              if (!res.ok) {
                return [song.id, { listened: false, listento: false, liked: false }]
              }

              const data = await res.json()

              return [
                song.id,
                {
                  listened: data.listened ?? false,
                  listento: data.listento ?? false,
                  liked: data.liked ?? false
                }
              ]
            })
          )
          setSongAction(Object.fromEntries(statusEntries))
        }
        setAlbums(dedupedAlbums)
      } catch (err) {
        console.error(err)
        setError('Failed to fetch artist')
      } finally {
        setLoading(false)
      }
    })()
  }, [artistId, user])

  async function songAction(
    e: React.MouseEvent,
    songId: string,
    action: 'listento' | 'listened' | 'like'
  ) {
    e.preventDefault()
    e.stopPropagation()

    const userId = user?.id
    if (!userId) {
      alert('You must be logged in')
      return
    }

    const current = songActions[songId] ?? {
      listened: false,
      listento: false,
      liked: false
    }

    const key = action === 'like' ? 'liked' : action
    const wasActive = current[key]
    const optimistic = !wasActive

    setSongAction(prev => ({
      ...prev,
      [songId]: {
        ...current,
        [key]: optimistic
      }
  }))

  try {
    const method = optimistic ? 'POST' : 'DELETE'
    const url =
      action === 'like'
        ? `/api/likes/${songId}`
        : `/api/songs/${songId}/${action}`

    const res = await fetch(url, {
      method,
      headers: { 'x-user-id': userId }
    })

    if (!res.ok) {
      setSongAction(prev => ({
        ...prev,
        [songId]: {
          ...current,
          [key]: wasActive
        }
      }))
    }
  } catch (err) {
    setSongAction(prev => ({
      ...prev,
      [songId]: {
        ...current,
        [key]: wasActive
      }
    }))
    console.error(err)
  }
}

  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center text-destructive">{error}</main><Footer /></div>
  if (!artist) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center text-destructive">Artist not found</main><Footer /></div>

  return (
    <Box className="min-h-screen flex flex-col">
      <Navbar />
      <Box className="max-w-4xl mx-auto flex-1 w-full p-6">
        <Flex justify="between" align="start" gap="4" mb="5">
          <div>
            <Flex align="center" gap="2">
              <Heading size="8">{artist.name}</Heading>
              {user && (
                <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1 shadow-sm">
                  <Button
                    size="1"
                    variant="ghost"
                    color="gray"
                    onClick={() => setLinkModalOpen(true)}
                    title="Suggest an edit"
                    aria-label="Suggest an edit"
                    className="rounded-full"
                  >
                    <PencilLine className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Flex>
            <Text size="2" color="gray" as="p" mt="2">
              {songs.length} {songs.length === 1 ? 'trending song' : 'trending songs'} • {albums.length} {albums.length === 1 ? 'album' : 'albums'}
            </Text>
          </div>

          <Flex gap="2" wrap="wrap" justify="end">
            {artist.spotify_id && (
              <a href={`https://open.spotify.com/artist/${artist.spotify_id}`} target="_blank" rel="noopener noreferrer" className="no-underline">
                <Button variant="outline">Open on Spotify</Button>
              </a>
            )}
          </Flex>
        </Flex>

        <Heading size="5" mb="3">Trending Songs</Heading>
        {songs.length === 0 ? (
          <Card size="3" mb="5"><Text color="gray">No songs for this artist yet.</Text></Card>
        ) : (
          <Flex direction="column" gap="2" mb="6">
            {songs.map((song, index) => {
            const status = songActions[song.id] ?? {
              listened: false,
              listento: false,
              liked: false,
            }

            return (
              <Link key={song.id} to={`/songs/${song.id}`} className="no-underline">
                <Card size="2">
                  <Flex justify="between" align="center" gap="3">
                    <div>
                      {/** Supabase may hydrate this left join as a single object or a one-item array. */}
                      {(() => {
                        const album = Array.isArray(song.albums) ? song.albums[0] : song.albums
                        return (
                          <>
                      <Text as="div" weight="medium">{index + 1}. {song.title}</Text>
                      <Text as="div" size="2" color="gray">
                        {album?.name ? `${album.name} • ` : ''}
                        {song.year_released ? `${song.year_released} • ` : ''}
                        {song.genre || 'Unknown genre'}
                        {song.bpm ? ` • ${song.bpm} BPM` : ''}
                      </Text>
                          </>
                        )
                      })()}
                    </div>

                    {user && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="1"
                          variant={status.listento ? 'solid' : 'ghost'}
                          color={status.listento ? 'green' : 'gray'}
                          onClick={(e) => songAction(e, song.id, 'listento')}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>

                        <Button
                          size="1"
                          variant={status.listened ? 'solid' : 'ghost'}
                          color={status.listened ? 'green' : 'gray'}
                          onClick={(e) => songAction(e, song.id, 'listened')}
                        >
                          <Headphones className="w-4 h-4" />
                        </Button>

                        <Button
                          size="1"
                          variant={status.liked ? 'solid' : 'ghost'}
                          color={status.liked ? 'red' : 'gray'}
                          onClick={(e) => songAction(e, song.id, 'like')}
                        >
                          <Heart className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Flex>
                </Card>
              </Link>
            )
          })}
          </Flex>
        )}

        <Heading size="5" mb="3">Albums</Heading>
        {albums.length === 0 ? (
          <Card size="3"><Text color="gray">No albums linked to this artist yet.</Text></Card>
        ) : (
          <Flex direction="column" gap="2">
            {albums.map((album) => (
              <Link key={album.id} to={`/albums/${album.id}`} className="no-underline">
                <Card size="2">
                  <Flex justify="between" align="center">
                    <Text weight="medium">{album.name}</Text>
                  </Flex>
                </Card>
              </Link>
            ))}
          </Flex>
        )}
      </Box>
      <Footer />
      <LinkSpotifyEntityProposalModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        currentUserId={user?.id ?? null}
        entityType="artist"
        entityId={artist.id}
        entityName={artist.name}
        currentSpotifyId={artist.spotify_id ?? null}
      />
    </Box>
  )
}