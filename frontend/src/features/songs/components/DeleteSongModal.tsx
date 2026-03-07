import { useState } from 'react'
import { Dialog, Button, Flex } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'

interface DeleteSongModalProps {
  isOpen: boolean
  onClose: () => void
  songId: string
  songTitle: string
  onDeleted?: () => void
}

export default function DeleteSongModal({
  isOpen,
  onClose,
  songId,
  songTitle,
  onDeleted,
}: DeleteSongModalProps) {
    const { user } = useAuth()        
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

async function handleDelete() {
    if (!user) {
      setError("You must be logged in to delete a song")
      return
    }
    setLoading(true)
    setSuccess(null)
    setError(null)
    try {
        const res = await fetch(
            `http://localhost:3001/api/songs/${songId}`,
            { method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id 
              },
            })
        const data = await res.json()
        if (!res.ok) {
            throw new Error(data.error || 'Failed to delete song')
        }
        setSuccess('Song deleted successfully')
        //onDeleted?.()
        } catch (err: any) {
          setError(err.message)  
        } finally {
            setLoading(false)
        }
}

return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="450px">
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Delete Song</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>
        <div className='pt-4'>
          {success && (
            <div className='bg-success/20 border border-success rounded-lg p-3 mb-4'>
              <p className='text-success text-sm'>{success}</p>
            </div>
          )}
          {error && (
            <div className='bg-destructive/20 border border-destructive rounded-lg p-3 mb-4'>
              <p className='text-destructive text-sm'>{error}</p>
            </div>
          )}
          {!success && (
          <p className='text-muted-foreground mb-6'>
            Are you sure you want to delete{' '}
            <span className='text-foreground font-semibold'>{songTitle}</span>?
            This action cannot be undone.
            </p>
          )}
          <Flex justify='end' gap='3'>
            { success ? (
               <Button size="2" variant="soft" onClick={() => {
                        onDeleted?.()
                        onClose()
              }}>
                Close
              </Button>
            ) : (
            <>
            <Button size="2" variant="soft" onClick={onClose} disabled={loading}>
            Cancel
            </Button>

            <Button size="2" color="red" onClick={handleDelete} disabled={loading}>
                {loading ? 'Deleting': 'Delete'}
            </Button>
            </>
            )}
          </Flex>
        </div>
      </Dialog.Content>
    </Dialog.Root>
    )
}
