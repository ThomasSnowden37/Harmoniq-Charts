import { useEffect, useState } from 'react'
import { Dialog, Button } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { PlaylistCheckItem } from '../types'

interface AddToPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  songId?: string
  albumId?: string
}

export default function AddToPlaylistModal({ isOpen, onClose, songId, albumId }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<PlaylistCheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const headers = { 'x-user-id': MOCK_CURRENT_USER_ID }

  useEffect(() => {
    if (isOpen) fetchPlaylists()
  }, [isOpen, songId, albumId])

  async function fetchPlaylists() {
    setLoading(true)
    setError(null)
    try {
      let data;
      
      if (songId) {
        // Standard check for a single song
        const res = await fetch(`/api/playlists/song/${songId}`, { headers })
        if (!res.ok) throw new Error('Failed to fetch playlists')
        data = await res.json()
      } else if (albumId) {
        const res = await fetch(`/api/playlists/user/${MOCK_CURRENT_USER_ID}`, { headers })
        if (!res.ok) throw new Error('Failed to fetch playlists')
        const rawPlaylists = await res.json()
        data = rawPlaylists.map((p: any) => ({ id: p.id, name: p.name, hasSong: false }))
      }

      setPlaylists(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function togglePlaylist(playlist: PlaylistCheckItem) {
    setActionLoading(playlist.id)
    try {
      if (songId) {
        // Single Song Toggle Logic
        if (playlist.hasSong) {
          const res = await fetch(`/api/playlists/${playlist.id}/songs/${songId}`, {
            method: 'DELETE',
            headers,
          })
          if (!res.ok) throw new Error('Failed to remove from playlist')
        } else {
          const res = await fetch(`/api/playlists/${playlist.id}/songs`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId }),
          })
          if (!res.ok) throw new Error('Failed to add to playlist')
        }
      } else if (albumId) {
        // Full Album Toggle Logic
        if (playlist.hasSong) {
          const res = await fetch(`/api/playlists/${playlist.id}/album/${albumId}`, {
            method: 'DELETE',
            headers,
          })
          if (!res.ok) throw new Error('Failed to remove album from playlist')
        } else {
          const res = await fetch(`/api/playlists/${playlist.id}/album/${albumId}`, {
            method: 'POST',
            headers,
          })
          if (!res.ok) throw new Error('Failed to add album to playlist')
        }
      }

      // Visually toggle the checkbox upon success
      setPlaylists(prev =>
        prev.map(p => p.id === playlist.id ? { ...p, hasSong: !p.hasSong } : p)
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error('Failed to create playlist')
      const created = await res.json()
      setPlaylists(prev => [{ id: created.id, name: created.name, hasSong: false }, ...prev])
      setNewName('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="450px" style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Add {albumId ? 'Album' : 'Song'} to Playlist</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        <form onSubmit={handleCreate} className="pb-3 flex gap-2 mt-4">
          <input
            type="text"
            placeholder="New playlist name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary"
          />
          <Button
            type="submit"
            size="2"
            disabled={creating || !newName.trim()}
          >
            {creating ? '...' : 'Create'}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto mt-2">
          {error && (
            <div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : playlists.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No playlists yet. Create one above!</p>
          ) : (
            <ul className="space-y-2">
              {playlists.map(playlist => (
                <li key={playlist.id}>
                  <label className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80">
                    <input
                      type="checkbox"
                      checked={playlist.hasSong}
                      onChange={() => togglePlaylist(playlist)}
                      disabled={actionLoading === playlist.id}
                      className="w-5 h-5 rounded border-border bg-background text-primary focus:ring-primary"
                    />
                    <span className="text-foreground flex-1">{playlist.name}</span>
                    {actionLoading === playlist.id && (
                      <span className="text-muted-foreground text-sm">...</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}