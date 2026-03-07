import { useEffect, useState } from 'react'
import * as Form from '@radix-ui/react-form'
import { Dialog, Button, Flex } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'

//TODO: Check it does not make duplicate song
//TODO: add comments and clean up

interface Song {
    id: string
    title: string
    bpm: number
    genre: string
    year_released: number
    user_id: string
    spotify_id?: string | null
    spotify_url?: string | null
}

interface EditSongModalProps {
  isOpen: boolean
  onClose: () => void
  song: Song
  onUpdated?: (updatedSong: Song) => void
}

export default function EditSongModal({ isOpen, onClose, song, onUpdated }: EditSongModalProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setLoading(false)
      setError(null)
    }
  }, [song, isOpen])

    if (!user) {
      setError("You must be logged in to delete a song")
      return
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const title = form.get('title')?.toString() ?? ''
    const bpm = Number(form.get('bpm') ?? 0)
    const genre = form.get('genre')?.toString() ?? ''
    const year_released = Number(form.get('year_released') ?? 0)

    try {
      const res = await fetch(`http://localhost:3001/api/songs/${song.id}`, {
        method: 'PATCH',
        headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id 
              }, 
        body: JSON.stringify({ title, bpm, genre, year_released }),
      })
      const update = await res.json()
      if (!res.ok) throw new Error(update.error || 'Failed to update song')

      
      setSuccess("Song successfully updated")
      onUpdated?.(update)
      setTimeout(() => {
        setSuccess(null)
        onClose()
      },1500)
      //onClose()
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
          <Dialog.Title mb="0">Edit Song</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>
        {success && (
        <div className="bg-success/20 border border-success rounded-lg p-3 mb-4">
        <p className="text-success text-sm">{success}</p>
        </div>)}
        {error && (
          <div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-4">
          <p className="text-destructive text-sm">{error}</p>
          </div>)}
        {/* Form */}
        <Form.Root asChild>
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <Form.Field name="title" className="mb-4">
              <Form.Label className="FormLabel text-foreground mb-1">Title</Form.Label>
              <Form.Control asChild>
                <input
                  name="title"
                  defaultValue={song.title}
                  className="Input w-full px-3 py-2 rounded text-foreground bg-background border border-border
                 invalid:border-destructive focus:invalid:border-destructive"
                  required  
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter a title
              </Form.Message>
            </Form.Field>
            {/* BPM */}
            <Form.Field name="bpm" className="mb-4">
              <Form.Label className="FormLabel text-foreground mb-1">BPM</Form.Label>
              <Form.Control asChild>
                <input
                  name="bpm"
                  type="number"
                  min={0}
                  defaultValue={song.bpm}
                  className="Input w-full px-3 py-2 rounded text-foreground bg-background border border-border
                  invalid:border-destructive focus:invalid:border-destructive"
                  required
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter BPM
              </Form.Message>
              <Form.Message match="rangeUnderflow" className="FormMessage text-destructive text-sm mt-1">
                BPM must be 0 or higher
              </Form.Message>
            </Form.Field>
            {/* Genre */}
            <Form.Field name="genre" className="mb-4">
              <Form.Label className="FormLabel text-foreground mb-1">Genre</Form.Label>
              <Form.Control asChild>
                <input
                  name="genre"
                  defaultValue={song.genre}
                  className="Input w-full px-3 py-2 rounded text-foreground bg-background border border-border
                  invalid:border-destructive focus:invalid:border-destructive"
                  required
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter a genre
              </Form.Message>
            </Form.Field>
            {/* Year Released */}
            <Form.Field name="year_released" className="mb-4">
              <Form.Label className="FormLabel text-foreground mb-1">Year Released</Form.Label>
              <Form.Control asChild>
                <input
                  name="year_released"
                  type="number"
                  min={0}
                  defaultValue={song.year_released}
                  className="Input w-full px-3 py-2 rounded text-foreground bg-background border border-border
                  invalid:border-destructive focus:invalid:border-destructive"
                  required
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter a year
              </Form.Message>
              <Form.Message match="rangeUnderflow" className="FormMessage text-destructive text-sm mt-1">
                Year must be 0 or higher
              </Form.Message>
            </Form.Field>
            {/* Buttons */}
            <Flex justify="end" gap="2" mt="4">
              <Button 
               size="2"
               variant="soft"
               onClick={onClose}>
                Cancel
              </Button>
              <Button 
                size="2"
                type="submit"    
                disabled={loading}>
                    {loading ? 'Saving…' : 'Save Changes'}
              </Button>
            </Flex>
          </form>
        </Form.Root>
      </Dialog.Content>
    </Dialog.Root>
  )
}
