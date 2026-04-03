import { useState, useEffect } from 'react'
import { Dialog, Button, Flex, Text, ScrollArea, Spinner, TextField } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import { useSpotify } from '../context/SpotifyContext'
import type { SpotifyPlaylist, ImportResult } from '../types'

interface ImportPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportPlaylistModal({ isOpen, onClose, onImported }: ImportPlaylistModalProps) {
  const { isConnected } = useSpotify()
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [customName, setCustomName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    if (isOpen && isConnected) {
      fetchPlaylists()
    }
  }, [isOpen, isConnected])

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlaylist(null)
      setCustomName('')
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  async function fetchPlaylists() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/spotify/playlists`, {
        headers: {
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch playlists')
      }

      const data = await res.json()
      setPlaylists(data.items || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport(playlistParam?: SpotifyPlaylist) {
    const pl = playlistParam || selectedPlaylist
    if (!pl) return

    setSelectedPlaylist(pl)
    setImporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/spotify/import-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({
          spotifyPlaylistId: pl.id,
          playlistName: customName || pl.name,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to import playlist')
      }

      const data: ImportResult = await res.json()
      setResult(data)
      onImported()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    onClose()
  }

  if (!isConnected) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Content maxWidth="500px">
          <Flex justify="between" align="center" mb="4">
            <Dialog.Title mb="0">Import from Spotify</Dialog.Title>
            <Dialog.Close>
              <button className="p-1 rounded-md hover:bg-secondary cursor-pointer" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </Flex>
          <Flex direction="column" align="center" py="6" gap="3">
            <Text color="gray">Connect your Spotify account in Settings to import playlists.</Text>
            <Button variant="soft" onClick={handleClose}>Close</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Content maxWidth="500px">
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title mb="0">
            {result ? 'Import Complete' : selectedPlaylist ? 'Confirm Import' : 'Select Playlist'}
          </Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </Flex>

        {error && (
          <div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-4">
            <Text color="red" size="2">{error}</Text>
          </div>
        )}

        {/* Result view */}
        {result && (
          <Flex direction="column" gap="4">
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <Text weight="medium" color="green">Successfully imported "{result.playlist.name}"</Text>
              <Text size="2" color="gray" as="p" mt="2">
                {result.imported} songs imported
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </Text>
            </div>
            {result.skippedSongs.length > 0 && (
              <div>
                <Text size="2" weight="medium">Skipped songs:</Text>
                <ScrollArea style={{ maxHeight: '100px' }} className="mt-2">
                  {result.skippedSongs.map((song, i) => (
                    <Text key={i} size="1" color="gray" as="p">{song}</Text>
                  ))}
                </ScrollArea>
              </div>
            )}
            <Button onClick={handleClose}>Done</Button>
          </Flex>
        )}

        {/* Confirm view */}
        {!result && selectedPlaylist && (
          <Flex direction="column" gap="4">
            <div className="bg-secondary rounded-lg p-4">
              <Flex align="center" gap="3">
                {selectedPlaylist.images?.[0] && (
                  <img
                    src={selectedPlaylist.images[0].url}
                    alt={selectedPlaylist.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                )}
                <div>
                  <Text weight="medium">{selectedPlaylist.name}</Text>
                  <Text size="2" color="gray" as="p">{selectedPlaylist.items?.total ?? 0} songs</Text>
                </div>
              </Flex>
            </div>
            <div>
              <Text size="2" weight="medium" mb="2" as="label">Playlist name in Harmoniq</Text>
              <TextField.Root
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={selectedPlaylist.name}
              />
            </div>
            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => setSelectedPlaylist(null)}>Back</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Spinner size="1" />
                    Importing...
                  </>
                ) : (
                  'Import Playlist'
                )}
              </Button>
            </Flex>
          </Flex>
        )}

        {/* Playlist selection view */}
        {!result && !selectedPlaylist && (
          <>
            {loading ? (
              <Flex align="center" justify="center" py="8" gap="2">
                <Spinner size="2" />
                <Text color="gray">Loading your Spotify playlists...</Text>
              </Flex>
            ) : playlists.length === 0 ? (
              <Flex direction="column" align="center" py="6">
                <Text color="gray">No playlists found in your Spotify account.</Text>
              </Flex>
            ) : (
              <ScrollArea style={{ maxHeight: '400px' }}>
                <Flex direction="column" gap="2">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handleImport(playlist)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left w-full cursor-pointer"
                    >
                      {playlist.images?.[0] ? (
                        <img
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-muted-foreground">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Text weight="medium" className="truncate block">{playlist.name}</Text>
                        <Text size="1" color="gray">{playlist.items?.total ?? 0} songs • {playlist.owner?.display_name ?? 'Unknown'}</Text>
                      </div>
                    </button>
                  ))}
                </Flex>
              </ScrollArea>
            )}
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
