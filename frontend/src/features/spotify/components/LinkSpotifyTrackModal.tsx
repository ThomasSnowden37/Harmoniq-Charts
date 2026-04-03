import { useState, useEffect, useCallback } from 'react'
import { Dialog, Flex, Text, TextField, Button, ScrollArea, Spinner, Card, Avatar, Box } from '@radix-ui/themes'
import { Search, X, Link, Trash2 } from 'lucide-react'
import { useSpotify } from '../context/SpotifyContext'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { SpotifyTrack } from '../types'
import { SPOTIFY_OPEN_TRACK_URL } from '../../../lib/spotify'

interface LinkSpotifyTrackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songTitle: string
  artistName?: string
  currentSpotifyId?: string | null
  onLink: (spotifyId: string) => Promise<void>
  onUnlink: () => Promise<void>
}

export function LinkSpotifyTrackModal({
  open,
  onOpenChange,
  songTitle,
  artistName,
  currentSpotifyId,
  onLink,
  onUnlink,
}: LinkSpotifyTrackModalProps) {
  const { isConnected } = useSpotify()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTrackInfo, setCurrentTrackInfo] = useState<SpotifyTrack | null>(null)

  // Initialize search query with song info
  useEffect(() => {
    if (open && songTitle) {
      const query = artistName ? `${songTitle} ${artistName}` : songTitle
      setSearchQuery(query)
    }
  }, [open, songTitle, artistName])

  // Load current linked track info
  useEffect(() => {
    if (open && currentSpotifyId && isConnected) {
      loadCurrentTrack()
    }
  }, [open, currentSpotifyId, isConnected])

  const loadCurrentTrack = async () => {
    if (!currentSpotifyId) return

    try {
      const response = await fetch(`/api/spotify/tracks/${currentSpotifyId}`, {
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })

      if (response.ok) {
        const track = await response.json()
        setCurrentTrackInfo(track)
      }
    } catch (err) {
      console.error('Failed to load current track info:', err)
    }
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !isConnected) return

    setIsSearching(true)
    setError(null)
    setSearchResults([])

    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        { headers: { 'x-user-id': MOCK_CURRENT_USER_ID } }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setSearchResults(data.tracks?.items || [])
    } catch (err) {
      setError('Failed to search Spotify. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, isConnected])

  // Auto-search when query is populated and modal opens
  useEffect(() => {
    if (open && searchQuery.trim() && isConnected && searchResults.length === 0) {
      handleSearch()
    }
  }, [open, searchQuery, isConnected])

  const handleLink = async (track: SpotifyTrack) => {
    setIsLinking(true)
    setError(null)

    try {
      await onLink(track.id)
      setCurrentTrackInfo(track)
      onOpenChange(false)
    } catch (err) {
      setError('Failed to link track. Please try again.')
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlink = async () => {
    setIsLinking(true)
    setError(null)

    try {
      await onUnlink()
      setCurrentTrackInfo(null)
      onOpenChange(false)
    } catch (err) {
      setError('Failed to unlink track. Please try again.')
    } finally {
      setIsLinking(false)
    }
  }

  const handleClose = () => {
    setSearchResults([])
    setError(null)
    onOpenChange(false)
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!isConnected) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Link Spotify Song</Dialog.Title>
          <Flex direction="column" gap="3" py="4" align="center">
            <Text color="gray">
              Connect your Spotify account in Settings to link songs.
            </Text>
            <Button variant="soft" onClick={handleClose}>
              Close
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="550px">
        <Dialog.Title>Link Spotify Song</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          Search for a song on Spotify to link to "{songTitle}"
        </Dialog.Description>

        <Flex direction="column" gap="4" mt="4">
          {/* Current linked track */}
          {currentTrackInfo && (
            <Card>
              <Flex justify="between" align="center">
                <Flex gap="3" align="center">
                  <Avatar
                    size="3"
                    src={currentTrackInfo.album.images[0]?.url}
                    fallback="♪"
                    radius="small"
                  />
                  <Flex direction="column">
                    <Text weight="medium" size="2">{currentTrackInfo.name}</Text>
                    <Text color="gray" size="1">
                      {currentTrackInfo.artists.map(a => a.name).join(', ')}
                    </Text>
                  </Flex>
                </Flex>
                <Flex gap="2">
                  <Button
                    size="1"
                    variant="soft"
                    color="green"
                    asChild
                  >
                    <a href={currentSpotifyId ? `${SPOTIFY_OPEN_TRACK_URL}${currentSpotifyId}` : '#'} target="_blank" rel="noopener noreferrer">
                      Open in Spotify
                    </a>
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    color="red"
                    onClick={handleUnlink}
                    disabled={isLinking}
                  >
                    <Trash2 size={14} />
                    Unlink
                  </Button>
                </Flex>
              </Flex>
            </Card>
          )}

          {/* Search input */}
          <Flex gap="2">
            <TextField.Root
              placeholder="Search Spotify..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
            >
              <TextField.Slot>
                <Search size={14} />
              </TextField.Slot>
            </TextField.Root>
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? <Spinner size="1" /> : 'Search'}
            </Button>
          </Flex>

          {error && (
            <Text color="red" size="2">{error}</Text>
          )}

          {/* Search results */}
          <ScrollArea style={{ maxHeight: '300px' }}>
            <Flex direction="column" gap="2">
              {searchResults.map((track) => (
                <Card
                  key={track.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleLink(track)}
                >
                  <Flex justify="between" align="center">
                    <Flex gap="3" align="center">
                      <Avatar
                        size="3"
                        src={track.album.images[2]?.url || track.album.images[0]?.url}
                        fallback="♪"
                        radius="small"
                      />
                      <Flex direction="column">
                        <Text weight="medium" size="2">{track.name}</Text>
                        <Text color="gray" size="1">
                          {track.artists.map(a => a.name).join(', ')} • {track.album.name}
                        </Text>
                        <Text color="gray" size="1">
                          {formatDuration(track.duration_ms)}
                        </Text>
                      </Flex>
                    </Flex>
                    <Button
                      size="1"
                      variant="soft"
                      disabled={isLinking}
                    >
                      <Link size={14} />
                      Link
                    </Button>
                  </Flex>
                </Card>
              ))}

              {searchResults.length === 0 && !isSearching && searchQuery && (
                <Box py="4">
                  <Text color="gray" size="2" align="center">
                    No results found. Try a different search.
                  </Text>
                </Box>
              )}
            </Flex>
          </ScrollArea>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" onClick={handleClose}>
            <X size={14} />
            Cancel
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
