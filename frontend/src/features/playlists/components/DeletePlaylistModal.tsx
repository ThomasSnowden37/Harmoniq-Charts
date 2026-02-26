import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'

interface DeletePlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  playlistId: string
  playlistName: string
  onDeleted: (id: string) => void
}

export default function DeletePlaylistModal({ isOpen, onClose, playlistId, playlistName, onDeleted }: DeletePlaylistModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete playlist')
      }

      onDeleted(playlistId)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">Delete Playlist</h2>
        <p className="text-gray-400 mb-4">
          Are you sure you want to delete <span className="text-white font-medium">"{playlistName}"</span>? This action cannot be undone.
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
