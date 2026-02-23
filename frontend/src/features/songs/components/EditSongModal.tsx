import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import * as Form from '@radix-ui/react-form'
import {
  Dialog,
  Button,
  Box,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes'   

//TODO: Add success messages/popup
//TODO: Check it does not make duplicate song
//TODO: add comments and clean up
//TODO: need auth so only user created can edit

interface Song {
    id: string
    title: string
    bpm: number
    genre: string
    year_released: number
}

interface EditSongModalProps {
  isOpen: boolean
  onClose: () => void
  song: Song
  onUpdated?: (updatedSong: Song) => void
}

export default function EditSongModal({ isOpen, onClose, song, onUpdated }: EditSongModalProps) {
    const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) setLoading(false)
  }, [song, isOpen])

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, bpm, genre, year_released }),
      })
      const update = await res.json()
      if (!res.ok) throw new Error(update.error || 'Failed to update song')
      onUpdated?.(update)
      onClose()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (!isOpen) return null

  return (
    <Box
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Box className="absolute inset-0 bg-black/60" />
      <Box className="relative z-10 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6">
        {/* Header */}
        <Flex justify="between" align="center" mb="4">
          <Heading size="5" className="text-white">
            Edit Song
          </Heading>
          <Button variant=
            "ghost" 
            size="2" 
            onClick={onClose}
            className="text-white text-3xl leading-none p-0">
            &times;
          </Button>
        </Flex>
        {/* Form */}
        <Form.Root asChild>
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <Form.Field name="title" className="mb-4">
              <Form.Label className="FormLabel text-white mb-1">Title</Form.Label>
              <Form.Control asChild>
                <input
                  name="title"
                  defaultValue={song.title}
                  className="Input w-full px-3 py-2 rounded text-white bg-gray-800 border border-gray-700
                 invalid:border-red-600 focus:invalid:border-red-600"
                  required  
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-red-400 text-sm mt-1">
                Please enter a title
              </Form.Message>
            </Form.Field>
            {/* BPM */}
            <Form.Field name="bpm" className="mb-4">
              <Form.Label className="FormLabel text-white mb-1">BPM</Form.Label>
              <Form.Control asChild>
                <input
                  name="bpm"
                  type="number"
                  min={0}
                  defaultValue={song.bpm}
                  className="Input w-full px-3 py-2 rounded text-white bg-gray-800 border border-gray-700
                  invalid:border-red-600 focus:invalid:border-red-600"
                  required
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-red-400 text-sm mt-1">
                Please enter BPM
              </Form.Message>
              <Form.Message match="rangeUnderflow" className="FormMessage text-red-400 text-sm mt-1">
                BPM must be 0 or higher
              </Form.Message>
            </Form.Field>
            {/* Genre */}
            <Form.Field name="genre" className="mb-4">
              <Form.Label className="FormLabel text-white mb-1">Genre</Form.Label>
              <Form.Control asChild>
                <input
                  name="genre"
                  defaultValue={song.genre}
                  className="Input w-full px-3 py-2 rounded text-white bg-gray-800 border border-gray-700
                  invalid:border-red-600 focus:invalid:border-red-600"
                  required
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-red-400 text-sm mt-1">
                Please enter a genre
              </Form.Message>
            </Form.Field>
            {/* Year Released */}
            <Form.Field name="year_released" className="mb-4">
              <Form.Label className="FormLabel text-white mb-1">Year Released</Form.Label>
              <Form.Control asChild>
                <input
                  name="year_released"
                  type="number"
                  min={0}
                  defaultValue={song.year_released}
                  className="Input w-full px-3 py-2 rounded text-white bg-gray-800 border border-gray-700
                  invalid:border-red-600 focus:invalid:border-red-600"
                  required
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-red-400 text-sm mt-1">
                Please enter a year
              </Form.Message>
              <Form.Message match="rangeUnderflow" className="FormMessage text-red-400 text-sm mt-1">
                Year must be 0 or higher
              </Form.Message>
            </Form.Field>
            {/* Buttons */}
            <Flex justify="end" gap="2" mt="4">
              <Button 
               variant="outline" 
               className="text-white border-white hover:bg-white/10"
               onClick={onClose}>
                Cancel
              </Button>
                <Button 
                type="submit"    
                color="red"   
                disabled={loading} 
                className={`px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 ${
                loading ? 'opacity-70 cursor-wait' : ''
                }`}>
                    {loading ? 'Saving…' : 'Save Changes'}</Button>
            </Flex>
          </form>
        </Form.Root>
      </Box>
    </Box>
  )
}
