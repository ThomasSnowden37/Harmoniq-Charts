import { useState } from 'react'
import { Dialog, Button, Flex, Text } from '@radix-ui/themes'
import { X } from 'lucide-react'
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="400px">
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Delete Playlist</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>
        <Dialog.Description size="2" mb="4" mt="2">
          Are you sure you want to delete <Text weight="medium">"{playlistName}"</Text>? This action cannot be undone.
        </Dialog.Description>

        {error && (
          <div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <Flex gap="3" justify="end">
          <Button
            size="2"
            variant="soft"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="2"
            color="red"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
