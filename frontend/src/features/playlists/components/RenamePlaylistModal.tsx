import { useState, useEffect } from 'react'
import { Dialog, Button } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'

interface RenamePlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  playlistId: string
  currentName: string
  onRenamed: (id: string, newName: string) => void
}

export default function RenamePlaylistModal({ isOpen, onClose, playlistId, currentName, onRenamed }: RenamePlaylistModalProps) {
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const MAX_NAME_LENGTH = 50
  const trimmedName = name.trim()
  const isOverLimit = trimmedName.length > MAX_NAME_LENGTH

  useEffect(() => {
    if (isOpen) setName(currentName)
  }, [isOpen, currentName])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isOverLimit) return
    if (!trimmedName || trimmedName === currentName) {
      onClose()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to rename playlist')
      }

      onRenamed(playlistId, name.trim())
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="400px">
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Rename Playlist</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        {error && (
          <div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-4">
            <p className="text-destructive text-sm">{error}</p>
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
            <div className={`text-right text-xs mt-1 ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {trimmedName.length}/{MAX_NAME_LENGTH}
            </div>
            {isOverLimit && (
              <p className="text-destructive text-sm mt-1">Name must be {MAX_NAME_LENGTH} characters or less</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              size="2"
              variant="soft"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              disabled={loading || !trimmedName || isOverLimit}
              className="flex-1"
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
