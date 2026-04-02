import { useEffect, useState, useRef, useCallback } from 'react'
import { Box, Button, Dialog, Flex, Heading, Text, TextField } from '@radix-ui/themes'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'

interface FavoriteSong {
  id: string
  song_id: string
  position: number
  songs: {
    id: string
    title: string
    bpm: number
    genre: string
    year_released: number
    song_artists?: Array<{ artists?: { id: string; name: string } }>
  }
}

interface ManageFavoritesModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export default function ManageFavoritesModal({ isOpen, onClose, onUpdated }: ManageFavoritesModalProps) {
  const [favorites, setFavorites] = useState<FavoriteSong[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; genre: string; year_released: number; bpm: number; song_artists?: Array<{ artists?: { id: string; name: string } }> }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) fetchFavorites()
  }, [isOpen])

  async function fetchFavorites() {
    try {
      const res = await fetch(`/api/favorite-songs/user/${MOCK_CURRENT_USER_ID}`)
      if (res.ok) setFavorites(await res.json())
    } catch {}
  }

  async function searchSongs() {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/likes/user/${MOCK_CURRENT_USER_ID}`)
      if (res.ok) {
        const allLiked = await res.json()
        const filtered = allLiked.filter((s: any) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setSearchResults(filtered)
      }
    } catch {}
    setLoading(false)
  }

  async function addFavorite(songId: string) {
    const nextPosition = favorites.length
    if (nextPosition >= 5) return

    try {
      const res = await fetch('/api/favorite-songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ song_id: songId, position: nextPosition }),
      })
      if (res.ok) {
        await fetchFavorites()
        onUpdated()
      }
    } catch {}
  }

  async function removeFavorite(songId: string) {
    try {
      const res = await fetch(`/api/favorite-songs/${songId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (res.ok) {
        await fetchFavorites()
        onUpdated()
      }
    } catch {}
  }

  // Drag & drop handlers for reordering favorites
  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setDragOverIndex(index)
    })
  }, [])

  const handleDrop = async (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (dragIndex === null) return
    if (dragIndex === toIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const newFavs = [...favorites]
    const [moved] = newFavs.splice(dragIndex, 1)
    newFavs.splice(toIndex, 0, moved)
    setFavorites(newFavs)
    setDragIndex(null)
    setDragOverIndex(null)

    try {
      const res = await fetch('/api/favorite-songs/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ songIds: newFavs.map(f => f.song_id) }),
      })
      if (!res.ok) {
        // revert on server failure
        await fetchFavorites()
        return
      }
      onUpdated()
    } catch (err) {
      // revert on network failure
      fetchFavorites()
    }
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const favoriteSongIds = new Set(favorites.map(f => f.song_id))

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Content style={{ maxWidth: 500 }}>
        <Dialog.Title>Manage Top 5 Favorites</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Select up to 5 songs as your favorites. They will be displayed on your profile.
        </Dialog.Description>

        {/* Current favorites */}
        <Heading size="3" mb="2">Current Favorites ({favorites.length}/5)</Heading>
        {favorites.length === 0 ? (
          <Text size="2" color="gray" mb="4" as="p">No favorites yet. Search for songs below to add them.</Text>
        ) : (
          <Flex direction="column" gap="2" mb="4">
            {favorites.map((fav, idx) => {
              const artists = fav.songs?.song_artists?.map(sa => sa?.artists?.name).filter(Boolean)
              const artistStr = artists && artists.length ? artists.join(', ') : undefined
              return (
                <div
                  key={fav.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                  style={{
                    opacity: dragIndex === idx ? 0.5 : 1,
                    borderTop: dragOverIndex === idx && dragIndex !== null && dragIndex > idx ? '2px solid var(--accent-9)' : undefined,
                    borderBottom: dragOverIndex === idx && dragIndex !== null && dragIndex < idx ? '2px solid var(--accent-9)' : undefined,
                    cursor: 'grab',
                  }}
                >
                  <Flex
                    align="center"
                    justify="between"
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: 'var(--gray-a3)' }}
                  >
                    <Flex align="center" gap="2">
                      <Text color="gray" style={{ cursor: 'grab', userSelect: 'none' }}>⠿</Text>
                      <Text size="2" color="gray" weight="bold">{idx + 1}.</Text>
                      <Box>
                        <Text size="2" weight="medium">{fav.songs.title}</Text>
                        <Text size="1" color="gray" as="p">
                          {artistStr && <>{artistStr} · </>}
                          {fav.songs.genre} · {fav.songs.year_released}
                        </Text>
                      </Box>
                    </Flex>
                    <Button size="1" variant="ghost" color="red" onClick={() => removeFavorite(fav.song_id)}>
                      Remove
                    </Button>
                  </Flex>
                </div>
              )
            })}
          </Flex>
        )}

        {/* Search to add */}
        {favorites.length < 5 && (
          <>
            <Heading size="3" mb="2">Add from Liked Songs</Heading>
            <Flex gap="2" mb="3">
              <TextField.Root
                style={{ flex: 1 }}
                placeholder="Search your liked songs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSongs()}
              />
              <Button onClick={searchSongs} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </Flex>
            {searchResults.length > 0 && (
              <Flex direction="column" gap="1" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {searchResults.map(song => {
                      const artists = (song as any)?.song_artists?.map((sa: any) => sa?.artists?.name).filter(Boolean)
                      const artistStr = artists && artists.length ? artists.join(', ') : undefined
                      return (
                      <Flex
                        key={song.id}
                        align="center"
                        justify="between"
                        className="p-2 rounded"
                        style={{ backgroundColor: 'var(--gray-a2)' }}
                      >
                        <Box>
                          <Text size="2">{song.title}</Text>
                          <Text size="1" color="gray" as="p">{artistStr && <>{artistStr} · </>}{song.genre} · {song.year_released}</Text>
                        </Box>
                        {favoriteSongIds.has(song.id) ? (
                          <Text size="1" color="green">Added</Text>
                        ) : (
                          <Button size="1" variant="soft" onClick={() => addFavorite(song.id)}>
                            Add
                          </Button>
                        )}
                      </Flex>
                    )})}
              </Flex>
            )}
          </>
        )}

        <Flex justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft">Done</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
