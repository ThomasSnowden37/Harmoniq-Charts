import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { PencilLine, Clock, Headphones, Heart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AddToPlaylistModal from '../features/playlists/components/AddToPlaylistModal'
import { useAuth } from '../context/AuthContext'
import LinkSpotifyEntityProposalModal from '../features/proposals/components/ArtistProposalModal'

interface Artist { id: string; name: string }
interface Album {
  id: string
  name: string
  spotify_id?: string | null
  created_at?: string
  album_artists?: Array<{ artists?: Artist }>
}
interface Song {
  id: string
  title: string
  bpm?: number | null
  genre?: string | null
  year_released?: number | null
  song_artists?: Array<{ artists?: Artist }>
}

export default function AlbumPage() {
  const { albumId } = useParams()
  const { user } = useAuth()

  const [album, setAlbum] = useState<Album | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [albumPlaylistOpen, setAlbumPlaylistOpen] = useState(false)
  const [spotifyProposalOpen, setSpotifyProposalOpen] = useState(false)
  const [albumLoading, setAlbumLoading] = useState<'listento' | 'listened' | null>(null)
  const [albumSuccess, setAlbumSuccess] = useState<'listento' | 'listened' | null>(null)
  const [songActions, setSongAction] = useState<Record<string, {
    listened: boolean
    listento: boolean
    liked: boolean
  }>>({})

  useEffect(() => {
    if (!albumId) return
    setLoading(true)
    ;(async () => {
      try {
        const { data: albumData, error: albumErr } = await supabase
          .from('albums')
          .select('id, name, spotify_id, created_at, album_artists ( artists ( id, name ) )')
          .eq('id', albumId)
          .single()

        if (albumErr) {
          setError('Failed to load album')
          return
        }
        setAlbum(albumData as any)

        const { data: songsData, error: songsErr } = await supabase
          .from('songs')
          .select('id, title, bpm, genre, year_released, song_artists ( artists ( id, name ) )')
          .eq('album_id', albumId)
          .order('title', { ascending: true })

        if (songsErr) {
          setError('Failed to load songs')
          return
        }
        setSongs(songsData ?? [])
        if (user && songsData) {
          const statusEntries = await Promise.all(
            songsData.map(async song => {
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
      } catch (err) {
        console.error(err)
        setError('Failed to fetch album')
      } finally {
        setLoading(false)
      }
    })()
  }, [albumId, user])

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

  const handleAddAlbum = async (target: 'listento' | 'listened') => {
    if (!user || !albumId) return
    setAlbumLoading(target)
    setAlbumSuccess(null)
    try {
      const res = await fetch(`/api/songs/album/${albumId}/bulk-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ targetTable: target }),
      })
      if (res.ok) {
        setAlbumSuccess(target)
        setTimeout(() => setAlbumSuccess(null), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAlbumLoading(null)
    }
  }

  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center text-destructive">{error}</main><Footer /></div>
  if (!album) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center text-destructive">Album not found</main><Footer /></div>

  const albumArtists = album.album_artists?.map((entry) => entry.artists).filter(Boolean) as Artist[] | undefined

  return (
    <Box className="min-h-screen flex flex-col">
      <Navbar />
      <Box className="max-w-3xl mx-auto flex-1 w-full p-6">
        <Box mb="5">
          <Flex justify="between" align="start">
            <div>
              <Flex align="center" gap="2" mb="1">
                <Heading size="7">{album.name}</Heading>
                {user && (
                  <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1 shadow-sm">
                    <Button
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() => setSpotifyProposalOpen(true)}
                      title="Suggest an edit"
                      aria-label="Suggest an edit"
                      className="rounded-full"
                    >
                      <PencilLine className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Flex>
              {albumArtists && albumArtists.length > 0 && (
                <Flex gap="2" wrap="wrap" mt="1">
                  {albumArtists.map((artist) => (
                    <Link key={artist.id} to={`/artists/${artist.id}`} className="no-underline">
                      <Text size="2" color="gray" className="hover:underline">{artist.name}</Text>
                    </Link>
                  ))}
                </Flex>
              )}
              <Text size="2" color="gray" as="p" mt="1">{songs.length} {songs.length === 1 ? 'song' : 'songs'}</Text>
            </div>
            <div>
              {user && (
                <div className="flex gap-3">
                  <Button variant={albumSuccess === 'listento' ? 'solid' : 'outline'} onClick={() => handleAddAlbum('listento')} disabled={albumLoading !== null}>{albumLoading === 'listento' ? 'Adding...' : albumSuccess === 'listento' ? 'Album Added' : '+ Add to Listen To'}</Button>
                  <Button variant={albumSuccess === 'listened' ? 'solid' : 'outline'} onClick={() => handleAddAlbum('listened')} disabled={albumLoading !== null}>{albumLoading === 'listened' ? 'Adding...' : albumSuccess === 'listened' ? 'Album Added' : '+ Mark Album as Listened'}</Button>
                  <Button variant="outline" color="orange" onClick={() => setAlbumPlaylistOpen(true)}>+ Album to Playlist</Button>
                </div>
              )}
            </div>
          </Flex>
        </Box>

        {songs.length === 0 ? (
          <Card size="3"><Text color="gray" className="p-6">No songs in this album yet.</Text></Card>
        ) : (
          <Flex direction="column" gap="2">
            {songs.map((s, idx) => {
              const artists = s.song_artists?.map(sa => sa?.artists?.name).filter(Boolean)
              const artistStr = artists && artists.length ? artists.join(', ') : undefined

              const status = songActions[s.id] ?? {
                listened: false,
                listento: false,
                liked: false,
              }

              return (
                <div key={s.id}>
                  <Link to={`/songs/${s.id}`} className="flex items-center gap-4 p-4 rounded-lg transition-colors hover-bg-gray no-underline">
                    <Text color="gray" className="w-6 text-right">{idx + 1}</Text>
                    <div className="flex-1 min-w-0">
                      <Text weight="medium" className="truncate block">{s.title}</Text>
                      <Text size="2" color="gray">
                        {artistStr && <>{artistStr} • </>}
                        {s.genre} {s.year_released ? `• ${s.year_released}` : ''} {s.bpm ? `• ${s.bpm} BPM` : ''}
                      </Text>
                    </div>
                    {user && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="1"
                          variant={status.listento ? 'solid' : 'ghost'}
                          color={status.listento ? 'green' : 'gray'}
                          onClick={(e) => songAction(e, s.id, 'listento')}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>

                        <Button
                          size="1"
                          variant={status.listened ? 'solid' : 'ghost'}
                          color={status.listened ? 'green' : 'gray'}
                          onClick={(e) => songAction(e, s.id, 'listened')}
                        >
                          <Headphones className="w-4 h-4" />
                        </Button>

                        <Button
                          size="1"
                          variant={status.liked ? 'solid' : 'ghost'}
                          color={status.liked ? 'red' : 'gray'}
                          onClick={(e) => songAction(e, s.id, 'like')}
                        >
                          <Heart className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Link>
                </div>
              )
            })}
          </Flex>
        )}

        <AddToPlaylistModal isOpen={albumPlaylistOpen} onClose={() => setAlbumPlaylistOpen(false)} albumId={album.id} />
        <LinkSpotifyEntityProposalModal
          open={spotifyProposalOpen}
          onOpenChange={setSpotifyProposalOpen}
          currentUserId={user?.id ?? null}
          entityType="album"
          entityId={album.id}
          entityName={album.name}
          currentSpotifyId={album.spotify_id ?? null}
          currentArtists={albumArtists?.map((artist) => ({ id: artist.id, name: artist.name })) ?? []}
        />
      </Box>
      <Footer />
    </Box>
  )
}
