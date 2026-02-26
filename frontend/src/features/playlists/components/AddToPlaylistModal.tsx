import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { PlaylistCheckItem } from '../types'

interface AddToPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  songId: string
}

export default function AddToPlaylistModal({ isOpen, onClose, songId }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<PlaylistCheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const headers = { 'x-user-id': MOCK_CURRENT_USER_ID }

  useEffect(() => {
    if (isOpen) fetchPlaylists()
  }, [isOpen, songId])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  async function fetchPlaylists() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/playlists/song/${songId}`, { headers })
      if (!res.ok) throw new Error('Failed to fetch playlists')
      setPlaylists(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function togglePlaylist(playlist: PlaylistCheckItem) {
    setActionLoading(playlist.id)
    try {
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

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-bold text-white">Add to Playlist</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <form onSubmit={handleCreate} className="px-6 pb-3 flex gap-2">
          <input
            type="text"
            placeholder="New playlist name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {creating ? '...' : 'Create'}
          </button>
        </form>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <p className="text-gray-400 text-center py-4">Loading...</p>
          ) : playlists.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No playlists yet. Create one above!</p>
          ) : (
            <ul className="space-y-2">
              {playlists.map(playlist => (
                <li key={playlist.id}>
                  <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750">
                    <input
                      type="checkbox"
                      checked={playlist.hasSong}
                      onChange={() => togglePlaylist(playlist)}
                      disabled={actionLoading === playlist.id}
                      className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-white flex-1">{playlist.name}</span>
                    {actionLoading === playlist.id && (
                      <span className="text-gray-400 text-sm">...</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
