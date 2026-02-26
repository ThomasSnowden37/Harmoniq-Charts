import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Box, Card, Flex, Heading, Text } from '@radix-ui/themes'
import type { PlaylistWithSongs } from '../features/playlists/types'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

/**
 * PlaylistPage.tsx
 *
 * Description:
 * This UI displays the playlist and information
 *  
 * Author: Brice
 * 
 */

export default function PlaylistPage() {
  const { playlistId } = useParams()
  const [playlist, setPlaylist] = useState<PlaylistWithSongs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!playlistId) return
    fetchPlaylist()
  }, [playlistId])

  async function fetchPlaylist() {
    setLoading(true)
    try {
      const res = await fetch(`/api/playlists/${playlistId}`)
      if (!res.ok) throw new Error('Playlist not found')
      setPlaylist(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box className="min-h-screen">
        <Navbar />
        <Box className="max-w-3xl mx-auto" p="6">
          <Text color="gray">Loading...</Text>
        </Box>
      </Box>
    )
  }

  if (error || !playlist) {
    return (
      <Box className="min-h-screen">
        <Navbar />
        <Box className="max-w-3xl mx-auto" p="6">
          <Text color="red">{error || 'Playlist not found'}</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box className="min-h-screen flex flex-col">
      <Navbar />
      <Box className="max-w-3xl mx-auto flex-1 w-full" p="6">
        <Box mb="5">
          <Heading size="7" mb="1">{playlist.name}</Heading>
          {playlist.users?.username && (
            <Link to={`/user/${playlist.user_id}`}>
              <Text size="2" color="gray" className="hover:underline">
                by {playlist.users.username}
              </Text>
            </Link>
          )}
          <Text size="2" color="gray" as="p" mt="1">
            {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
          </Text>
        </Box>

        {playlist.songs.length === 0 ? (
          <Card size="3">
            <Flex direction="column" align="center" py="6">
              <Text color="gray">This playlist is empty.</Text>
            </Flex>
          </Card>
        ) : (
          <Flex direction="column" gap="2">
            {playlist.songs.map((song, idx) => (
              <Link
                key={song.id}
                to={`/songs/${song.id}`}
                className="flex items-center gap-4 p-4 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--gray-a3)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--gray-a4)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--gray-a3)'}
              >
                <Text color="gray" className="w-6 text-right">{idx + 1}</Text>
                <div className="flex-1 min-w-0">
                  <Text weight="medium" className="truncate block">{song.title}</Text>
                  <Text size="2" color="gray">
                    {song.genre} • {song.year_released} • {song.bpm} BPM
                  </Text>
                </div>
              </Link>
            ))}
          </Flex>
        )}
      </Box>
      <Footer />
    </Box>
  )
}
