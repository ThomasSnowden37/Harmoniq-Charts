import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase';
import { Form } from "radix-ui";
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
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext';

/**
 * TODO:
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
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    
    if (!user) {
        setMessage("You must be logged in to add a song\n")
        setLoading(false)
        return;
    }
    const userId = user.id;

    const forms = e.currentTarget
    const form = new FormData(e.currentTarget)
    const title = form.get('title')?.toString() ?? ''
    const bpm = Number(form.get('bpm') ?? 0)
    const genre = form.get('genre')?.toString() ?? ''
    const year_released = Number(form.get('year_released') ?? 0)
    const album_name = form.get('album')?.toString() ?? ''
    const artist_name = form.get('artist')?.toString() ?? ''
    try {
        const res = await fetch('http://localhost:3001/api/songs/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId,},
          body: JSON.stringify({
          userId: userId,
          title,
          bpm,
          genre,
          year_released,  
          album_name,
          artist_name,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to add song')

      forms.reset()
      setMessage('Song Successfully Added')

    } catch (err: any) {
      console.error('Request failed:', err)
      setMessage(`Request failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  } 

return (
  <Box className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <Box className="flex-1 flex items-center justify-center p-6">
    <Card size="3" className="w-full max-w-xl p-6">
      <Heading size="6" mb="5">
        Add New Song
      </Heading>

    <Form.Root asChild>
      <form onSubmit={handleSubmit} onChange={() => message && setMessage(null)}>
        {/* Title */}
        <Form.Field name="title" className="mb-4">
            <Form.Label className="FormLabel text-foreground mb-1">
              Title</Form.Label>
            <Form.Control asChild>
              <input
                name="title"
                className="Input w-full px-3 py-2 rounded text-foreground bg-card border border-border
                 data-[invalid]:data-[touched]:border-destructive 
                 focus:data-[invalid]:data-[touched]:invalid:border-destructive"
                required  />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter a title
              </Form.Message>
            </Form.Field>

         {/* bpm */}
        <Form.Field name="bpm" className="mb-4">
            <Form.Label className="FormLabel text-foreground mb-1">
                BPM</Form.Label>
              <Form.Control asChild>
                <input
                  name="bpm"
                  type="number"
                  min={0}
                  className="Input w-full px-3 py-2 rounded text-foreground bg-card border border-border
                 data-[invalid]:data-[touched]:border-destructive 
                 focus:data-[invalid]:data-[touched]:invalid:border-destructive"
                  required  
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter the BPM
              </Form.Message>
              <Form.Message match="rangeUnderflow" className="text-destructive text-sm mt-1">
                BPM must be greater than 0
            </Form.Message>
            </Form.Field>

            {/* Genre */} 
         <Form.Field name="genre" className="mb-4">
            <Form.Label className="FormLabel text-foreground mb-1">
                Genre</Form.Label>
              <Form.Control asChild>
                <input
                  name="genre"
                  className="Input w-full px-3 py-2 rounded text-foreground bg-card border border-border
                  data-[invalid]:data-[touched]:border-destructive 
                 focus:data-[invalid]:data-[touched]:invalid:border-destructive"
                  required  
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter a Genre
              </Form.Message>
            </Form.Field>

         {/* Year Released  */}    
        <Form.Field name="year_released" className="mb-4">
            <Form.Label className="FormLabel text-foreground mb-1">
                Year Released</Form.Label>
              <Form.Control asChild>
                <input
                  name="year_released"
                  type="number"
                  min={0}
                  className="Input w-full px-3 py-2 rounded text-foreground bg-card border border-border
                 data-[invalid]:data-[touched]:border-destructive 
                 focus:data-[invalid]:data-[touched]:invalid:border-destructive"
                  required  
                />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter a Year
              </Form.Message>
              <Form.Message match="rangeUnderflow" className="text-destructive text-sm mt-1">
                Year must be greater than 0
            </Form.Message>
            </Form.Field>

         {/* Album */}    
        <Form.Field name="album" className="mb-4">
            <Form.Label className="FormLabel text-foreground mb-1">
              Album</Form.Label>
            <Form.Control asChild>
              <input
                name="album"
                className="Input w-full px-3 py-2 rounded text-foreground bg-card border border-border
                 data-[invalid]:data-[touched]:border-destructive 
                 focus:data-[invalid]:data-[touched]:invalid:border-destructive"
                required  />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter an album
              </Form.Message>
            </Form.Field>

         {/* Artist */}    
        <Form.Field name="artist" className="mb-4">
            <Form.Label className="FormLabel text-foreground mb-1">
              Artist</Form.Label>
            <Form.Control asChild>
              <input
                name="artist"
                className="Input w-full px-3 py-2 rounded text-foreground bg-card border border-border
                 data-[invalid]:data-[touched]:border-destructive 
                 focus:data-[invalid]:data-[touched]:invalid:border-destructive"
                required  />
              </Form.Control>
              <Form.Message match="valueMissing" className="FormMessage text-destructive text-sm mt-1">
                Please enter an artist
              </Form.Message>
            </Form.Field>
          
           {/* Buttons */}
           <Flex justify="end" gap="2" mt="4">
            <Button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 ${
                loading ? 'opacity-70 cursor-wait' : ''
                }`}>
                {loading ? 'Adding…' : 'Add Song'}
              </Button>
            </Flex>
          </form>
        </Form.Root>
        {message && (
          <Text size="2" mt="3" color="blue">
            {message}
          </Text> )}
      </Card>     
      </Box> 
        <Footer />
    </Box>
  )
}


