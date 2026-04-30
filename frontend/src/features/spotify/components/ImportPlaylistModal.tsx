import { useState, useEffect, useRef } from 'react'
import { Dialog, Button, Flex, Text, ScrollArea, Spinner, TextField } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import { useSpotify } from '../context/SpotifyContext'
import type { SpotifyPlaylist, ImportResult, PlaylistImportPreview } from '../types'

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
  const [preview, setPreview] = useState<PlaylistImportPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewControllerRef = useRef<AbortController | null>(null)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [previewTotal, setPreviewTotal] = useState<number | null>(null)
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({})

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
      setPreview(null)
      setSelectedMatches({})
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

  // Perform the actual import (commits to DB)
  async function handleImport() {
    const pl = selectedPlaylist
    if (!pl || !preview) return

    const linkedSelections = preview.items
      .filter((item) => item.matchState === 'linked' && item.songId)
      .map((item) => ({
        trackId: item.trackId,
        songId: item.songId as string,
        title: item.matchedTitle ?? item.title,
        position: item.position,
        source: 'linked' as const,
      }))

    const confirmedSelections = preview.items
      .filter((item) => item.matchState === 'match_available' && selectedMatches[item.trackId])
      .map((item) => ({
        trackId: item.trackId,
        songId: selectedMatches[item.trackId],
        title: item.title,
        position: item.position,
        source: 'confirmed' as const,
      }))

    const unresolvedMatches = preview.items
      .filter((item) => item.matchState === 'match_available' && !selectedMatches[item.trackId])
      .map((item) => ({ title: item.title, reason: 'No confident match was confirmed' }))

    const unmatchedItems = preview.items
      .filter((item) => item.matchState === 'no_match')
      .map((item) => ({ title: item.title, trackId: item.trackId }))

    const chosenMatches = [...linkedSelections, ...confirmedSelections]
    if (chosenMatches.length === 0) {
      setError('Choose at least one exact or confident match before importing.')
      return
    }

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
          selectedMatches: chosenMatches,
          unmatchedItems,
          skippedItems: [...preview.skipped, ...unresolvedMatches],
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

  // Fetch preview of what would be imported (no DB writes)
  async function fetchPreview(pl: SpotifyPlaylist) {
    // Use streaming preview endpoint to show determinate progress
    // Abort any previous preview
    previewControllerRef.current?.abort()
    const controller = new AbortController()
    previewControllerRef.current = controller

    setPreviewLoading(true)
    setError(null)
    setPreview(null)
    setSelectedMatches({})
    setPreviewProgress(0)
    setPreviewTotal(null)

    try {
      const res = await fetch(`/api/spotify/import-playlist/preview-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({
          spotifyPlaylistId: pl.id,
          playlistName: customName || pl.name,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to preview import')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          let msg: any
          try { msg = JSON.parse(line) } catch (e) { continue }

          if (msg.type === 'init') {
            setPreviewTotal(msg.total || 0)
          } else if (msg.type === 'item') {
            const progress = (msg.index + 1) / (msg.total || 1)
            setPreviewProgress(progress)
          } else if (msg.type === 'complete') {
            setPreview(msg)
            setPreviewProgress(1)
            setPreviewTotal((msg.items?.length ?? 0) + (msg.skipped?.length ?? 0) || null)
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // user cancelled preview
      } else {
        setError(err.message || String(err))
      }
    } finally {
      setPreviewLoading(false)
      previewControllerRef.current = null
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
        <style>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            60% { transform: translateX(-10%); }
            100% { transform: translateX(100%); }
          }
          .indeterminate-bar { position: relative; overflow: hidden; background: rgba(255,255,255,0.02); border-radius: 8px; }
          .indeterminate-bar .bar { position: absolute; left: -40%; width: 40%; height: 100%; background: linear-gradient(90deg, rgba(59,130,246,0.95), rgba(79,70,229,0.9)); animation: indeterminate 1.4s linear infinite; }
          .progress-track { background: rgba(255,255,255,0.03); border-radius: 8px; overflow: hidden; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, rgba(59,130,246,0.95), rgba(79,70,229,0.9)); transition: width 240ms ease; }
        `}</style>
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
            <div className="bg-card/50 border border-border rounded-lg p-4">
              <Text weight="medium" color="green">Successfully imported "{result.playlist.name}"</Text>
              <Text size="2" color="gray" as="p" mt="2">
                {result.counts.linked + result.counts.confirmed} songs added
                {result.counts.unmatched > 0 && `, ${result.counts.unmatched} still need contributions`}
                {(result.counts.skipped ?? 0) > 0 && `, ${result.counts.skipped ?? 0} skipped`}
              </Text>
            </div>

            {result.added && result.added.length > 0 && (
              <div>
                <Text size="2" weight="medium">Added to playlist</Text>
                <ScrollArea style={{ maxHeight: '120px' }} className="mt-2">
                  {result.added.map((entry, i) => (
                    <div key={i} className="py-2 border-b border-border last:border-none">
                      <Text weight="medium" className="block">{entry.title}</Text>
                      <Text size="1" color="gray" className="block mt-1">
                        {entry.source === 'linked' ? 'Exact linked song' : 'Confirmed community match'}
                      </Text>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {result.unmatched && result.unmatched.length > 0 && (
              <div>
                <Text size="2" weight="medium">Still missing from Harmoniq</Text>
                <ScrollArea style={{ maxHeight: '160px' }} className="mt-2">
                  {result.unmatched.map((item, i) => (
                    <div key={i} className="py-2 border-b border-border last:border-none">
                      <Text weight="medium" className="block">{item.title}</Text>
                      <a href="/songs/add" className="mt-1 inline-block text-xs text-primary no-underline hover:underline">
                        Suggest this song for the database
                      </a>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {result.skipped && result.skipped.length > 0 && (
              <div>
                <Text size="2" weight="medium">Skipped / Issues</Text>
                <ScrollArea style={{ maxHeight: '120px' }} className="mt-2">
                  {result.skipped.map((s: any, i: number) => (
                    <div key={i} className="py-2 border-b border-border last:border-none">
                      <Text weight="medium" className="block">{s.title}</Text>
                      {s.reason && <Text size="1" color="gray" className="block mt-1">{s.reason}</Text>}
                    </div>
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
            <div className="bg-card/50 border border-border rounded-lg p-4">
              <Flex align="center" gap="3">
                {selectedPlaylist.images && selectedPlaylist.images[0] && (
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
            {/* Preview of what will be imported */}
            <div>
              <Text size="2" weight="medium" mb="2">Preliminary review</Text>
              {previewLoading ? (
                <div className="space-y-3">
                  {previewTotal && previewTotal > 0 ? (
                    <div className="progress-track h-2 mt-1 mb-2">
                      <div className="progress-fill" style={{ width: `${Math.round(previewProgress * 100)}%` }} />
                    </div>
                  ) : (
                    <div className="indeterminate-bar h-2 mt-1 mb-2">
                      <div className="bar" />
                    </div>
                  )}
                  <Flex align="center" gap="2">
                    <Spinner size="1" />
                    <Text color="gray">
                      {previewTotal && previewTotal > 0 ? `Analyzing playlist — ${Math.round(previewProgress * 100)}%` : 'Analyzing playlist — this may take a minute...'}
                    </Text>
                  </Flex>
                </div>
              ) : preview ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-border bg-card/30">
                    <Text weight="medium">Exact linked songs</Text>
                    {preview.items.filter((item) => item.matchState === 'linked').length > 0 ? (
                      <ScrollArea style={{ maxHeight: 120 }} className="mt-2">
                        {preview.items.filter((item) => item.matchState === 'linked').map((item) => (
                          <div key={item.trackId} className="py-2 border-b border-border last:border-none">
                            <Text weight="medium" className="block">{item.title}</Text>
                            <Text size="1" color="gray" className="block mt-1">Already linked to an existing song in Harmoniq</Text>
                          </div>
                        ))}
                      </ScrollArea>
                    ) : (
                      <Text size="1" color="gray" mt="2">No exact linked songs</Text>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card/30">
                    <Text weight="medium">Confident community matches</Text>
                    {preview.items.filter((item) => item.matchState === 'match_available').length > 0 ? (
                      <ScrollArea style={{ maxHeight: 240 }} className="mt-2">
                        {preview.items.filter((item) => item.matchState === 'match_available').map((item) => (
                          <div key={item.trackId} className="py-3 border-b border-border last:border-none space-y-2">
                            <div>
                              <Text weight="medium" className="block">{item.title}</Text>
                              <Text size="1" color="gray" className="block mt-1">
                                {item.artists.join(', ') || 'Unknown artist'}
                                {item.album ? ` • ${item.album}` : ''}
                              </Text>
                            </div>
                            <div className="space-y-2">
                              {item.candidates.map((candidate) => (
                                <button
                                  key={`${item.trackId}-${candidate.songId}`}
                                  type="button"
                                  onClick={() => setSelectedMatches((current) => ({ ...current, [item.trackId]: candidate.songId }))}
                                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedMatches[item.trackId] === candidate.songId ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/70 hover:bg-background'}`}
                                >
                                  <Text weight="medium" className="block">{candidate.title}</Text>
                                  <Text size="1" color="gray" className="block mt-1">
                                    {candidate.artistNames.join(', ') || 'Unknown artist'}
                                    {candidate.albumName ? ` • ${candidate.albumName}` : ''}
                                    {` • ${Math.round(candidate.confidence * 100)}% confidence`}
                                  </Text>
                                  <Text size="1" color="gray" className="block mt-1">{candidate.reasons.join(' • ')}</Text>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    ) : (
                      <Text size="1" color="gray" mt="2">No confident matches need confirmation</Text>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card/30">
                    <Text weight="medium">No match yet</Text>
                    {preview.items.filter((item) => item.matchState === 'no_match').length > 0 ? (
                      <ScrollArea style={{ maxHeight: 160 }} className="mt-2">
                        {preview.items.filter((item) => item.matchState === 'no_match').map((item) => (
                          <div key={item.trackId} className="py-2 border-b border-border last:border-none">
                            <Text weight="medium" className="block">{item.title}</Text>
                            <Text size="1" color="gray" className="block mt-1">
                              {item.artists.join(', ') || 'Unknown artist'}
                              {item.album ? ` • ${item.album}` : ''}
                            </Text>
                            <a href="/songs/add" className="mt-1 inline-block text-xs text-primary no-underline hover:underline">
                              Suggest this song for Harmoniq
                            </a>
                          </div>
                        ))}
                      </ScrollArea>
                    ) : (
                      <Text size="1" color="gray" mt="2">Every track has either an exact link or a confident candidate.</Text>
                    )}
                  </div>

                  {preview.skipped.length > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-card/30">
                      <Text weight="medium">Skipped / Issues</Text>
                      <ScrollArea style={{ maxHeight: 120 }} className="mt-2">
                        {preview.skipped.map((s, i) => (
                          <div key={i} className="py-2 border-b border-border last:border-none">
                            <Text weight="medium" className="block">{s.title}</Text>
                            {s.reason && <Text size="1" color="gray" className="block mt-1">{s.reason}</Text>}
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              ) : (
                <Text size="1" color="gray">Preview not available yet.</Text>
              )}
            </div>
            <Flex gap="2" justify="end">
              <Button variant="soft" onClick={() => { previewControllerRef.current?.abort(); setSelectedPlaylist(null); setPreview(null); }}>Back</Button>
              <Button onClick={() => handleImport()} disabled={importing || previewLoading}>
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
                      onClick={() => { setSelectedPlaylist(playlist); fetchPreview(playlist); }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left w-full cursor-pointer"
                    >
                      {playlist.images && playlist.images[0] ? (
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
