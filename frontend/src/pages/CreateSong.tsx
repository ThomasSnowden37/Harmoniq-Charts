import { useEffect, useState } from 'react'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Tabs,
  Text,
} from '@radix-ui/themes'

/**
 * TODO:
 * Add Deleting, and Editing own songs
 * Change album id to name 
 * Add artist when i put in song db
 * Make more navigable 
 * Make Error Codes better for users
 */

/**
 * CreateSong.tsx
 *
 * Description:
 * This UI allows the user to add a new song to the database
 *  
 * Author: Jonas Langer
 * 
 */

export default function CreateSong() {
  const [title, setTitle] = useState('')
  const [bpm, setBpm] = useState('')
  const [genre, setGenre] = useState('')
  const [yearreleased, setYearReleased] = useState('')
  const [albumID, setAlbumID] = useState('')
  const [error, setError] = useState('')


 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
        const res = await fetch('http://localhost:3001/api/song/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': MOCK_CURRENT_USER_ID,},
          body: JSON.stringify({
          userId: MOCK_CURRENT_USER_ID,
          title,
          bpm: Number(bpm),
          genre,
          year_released: Number(yearreleased),
          album_id: albumID,
        }),
      })
      const data = await res.json()

      if (!res.ok) setError(`Error: ${data.error}`)
      else {
        setError(`${data.title} added successfully`)
        setTitle('')
        setBpm('')
        setGenre('')
        setYearReleased('')
        setAlbumID('')
      }

    } catch (err: any) {
      console.error('Request failed:', err)
      setError(`Request failed: ${err.message}`)
    }
  } 

return (
  <Box className='min-h-screen bg-gray-900 flex items-center justify-center p-4'>
    <Card size="3" className="w-full max-w-md p-6">
      <Heading size="5" className="mb-4 text-white">
        Add New Song
      </Heading>

    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
      <input
        value = {title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder='Title'
        className="p-2 rounded bg-gray-700 text-white"
        required/>
      <input
        value = {bpm}
        onChange={(e) => setBpm(e.target.value)}
        placeholder='Bpm'
        className="p-2 rounded bg-gray-700 text-white"
        required/>
      <input
        value = {genre}
        onChange={(e) => setGenre(e.target.value)}
        placeholder='Genre'
        className="p-2 rounded bg-gray-700 text-white"
        required/>
      <input
        value = {yearreleased}
        onChange={(e) => setYearReleased(e.target.value)}
        placeholder='Year Released'
        className="p-2 rounded bg-gray-700 text-white"
        required/>
      <input
        value = {albumID}
        onChange={(e) => setAlbumID(e.target.value)}
        placeholder='Album ID'
        className="p-2 rounded bg-gray-700 text-white"
        required/>
      <Button type = "submit" className='mt-2'>
        Add Song</Button>
    </form>
    {error && (
      <Text size="2" color="blue" className="mt-3">
        {error}</Text>
    )}
    </Card>
  </Box>
)
}


