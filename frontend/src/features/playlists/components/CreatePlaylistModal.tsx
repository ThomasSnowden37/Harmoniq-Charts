import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { Playlist } from '../types'

interface CreatePlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (playlist: Playlist) => void
}

export default function CreatePlaylistModal({ isOpen, onClose, onCreated }: CreatePlaylistModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const MAX_NAME_LENGTH = 50
  const trimmedName = name.trim()
  const isOverLimit = trimmedName.length > MAX_NAME_LENGTH

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trimmedName || isOverLimit) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create playlist')
      }

      const playlist = await res.json()
      onCreated(playlist)
      setName('')
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
        <h2 className="text-xl font-bold text-white mb-4">Create Playlist</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Playlist name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div className={`text-right text-xs mt-1 ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
              {trimmedName.length}/{MAX_NAME_LENGTH}
            </div>
            {isOverLimit && (
              <p className="text-red-400 text-sm mt-1">Name must be {MAX_NAME_LENGTH} characters or less</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !trimmedName || isOverLimit}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
