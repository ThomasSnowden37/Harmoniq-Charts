import { useState } from 'react'
import { Dialog, Button, Flex, Text, TextField, Spinner, ScrollArea } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import { useSpotify } from '../context/SpotifyContext'
import type { ExportResult } from '../types'

interface ExportPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  playlistId: string
  playlistName: string
}

export default function ExportPlaylistModal({ 
  isOpen, 
  onClose, 
  playlistId, 
  playlistName 
}: ExportPlaylistModalProps) {
  const { isConnected } = useSpotify()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<ExportResult | null>(null)

  function resetState() {
    setCustomName('')
    setDescription('')
    setResult(null)
    setError(null)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/spotify/export-playlist/${playlistId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({
          name: customName || playlistName,
          description: description || `Exported from Harmoniq`,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to export playlist')
      }

      const data: ExportResult = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  if (!isConnected) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Content maxWidth="450px">
          <Flex justify="between" align="center" mb="4">
            <Dialog.Title mb="0">Export to Spotify</Dialog.Title>
            <Dialog.Close>
              <button className="p-1 rounded-md hover:bg-secondary cursor-pointer" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </Flex>
          <Flex direction="column" align="center" py="6" gap="3">
            <Text color="gray">Connect your Spotify account in Settings to export playlists.</Text>
            <Button variant="soft" onClick={handleClose}>Close</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Content maxWidth="450px">
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title mb="0">
            {result ? 'Export Complete' : 'Export to Spotify'}
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

        {result ? (
          <Flex direction="column" gap="4">
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <Text weight="medium" color="green">Successfully exported to Spotify!</Text>
              <Text size="2" color="gray" as="p" mt="2">
                {result.matched} songs added
                {result.unmatched > 0 && `, ${result.unmatched} could not be matched`}
              </Text>
            </div>
            
            <Button
              onClick={() => window.open(result.spotifyPlaylist.url, '_blank')}
              style={{ backgroundColor: '#1DB954', color: 'white' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Open in Spotify
            </Button>

            {result.unmatchedSongs.length > 0 && (
              <div>
                <Text size="2" weight="medium">Could not find on Spotify:</Text>
                <ScrollArea style={{ maxHeight: '100px' }} className="mt-2">
                  {result.unmatchedSongs.map((song, i) => (
                    <Text key={i} size="1" color="gray" as="p">{song}</Text>
                  ))}
                </ScrollArea>
              </div>
            )}

            <Button variant="soft" onClick={handleClose}>Done</Button>
          </Flex>
        ) : (
          <Flex direction="column" gap="4">
            <Text size="2" color="gray">
              Export "{playlistName}" to your Spotify account. Songs will be matched by title and artist.
            </Text>
            
            <div>
              <Text size="2" weight="medium" mb="2" as="label">Playlist name on Spotify</Text>
              <TextField.Root
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={playlistName}
              />
            </div>

            <div>
              <Text size="2" weight="medium" mb="2" as="label">Description (optional)</Text>
              <TextField.Root
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Exported from Harmoniq"
              />
            </div>

            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleExport} 
                disabled={exporting}
                style={{ backgroundColor: '#1DB954', color: 'white' }}
              >
                {exporting ? (
                  <>
                    <Spinner size="1" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Export to Spotify
                  </>
                )}
              </Button>
            </Flex>
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
