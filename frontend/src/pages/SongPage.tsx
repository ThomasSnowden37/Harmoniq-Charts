import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import DeleteSongModal from '../features/songs/components/DeleteSongModal'
import EditSongModal from '../features/songs/components/EditSongModal'
import AddToPlaylistModal from '../features/playlists/components/AddToPlaylistModal'
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'



/**
 * SongPage.tsx
 *
 * Description:
 * This UI displays the song and information
 *  
 * Author: 
 * 
 */

interface Song {
    id: string
    title: string
    bpm: number
    genre: string
    year_released: number
    user_id: string
}

export default function SongPage() {
    const { user } = useAuth()
    const { id } = useParams()
    const [loading, setLoading] = useState(true)
    const [song, setSong] = useState<Song | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [playlistOpen, setPlaylistOpen] = useState(false)
    const [listenedCount, setListenedCount] = useState(0)
    const [listened, setListened] = useState(false)
    const [listento, setListento] = useState(false)


    useEffect(() => {
       if (!id) return

      async function fetchSong() {
        setLoading(true)
        try {
          const res = await fetch(`http://localhost:3001/api/songs/${id}`)
          const data = await res.json()

          if (!res.ok) {
            setError(data.error || 'Failed to load song')
            return
          }

          setSong(data)

          const countRes = await fetch(
            `http://localhost:3001/api/songs/${id}/listened/count`
          )
          const countData = await countRes.json()
          if (countRes.ok) setListenedCount(countData.total)

        } catch (err) {
          setError('Failed to fetch song')
          console.error(err)
        } finally {
          setLoading(false)
        }
      }

      fetchSong()
    }, [id])

    useEffect(() => {
      if (!user || !id) return

      const userId = user.id

      async function fetchUserSongData() {
      try {
        const resLis = await fetch(
          `http://localhost:3001/api/songs/${id}/listened`,
          { headers: { 'x-user-id': userId } }
        )
        const listenedData = await resLis.json()
        if (resLis.ok) setListened(listenedData.listened)

        const toLis = await fetch(
          `http://localhost:3001/api/songs/${id}/listento`,
          { headers: { 'x-user-id': userId } }
        )
        const listentoData = await toLis.json()
        if (toLis.ok) setListento(listentoData.listento)
    } catch (err) {
      console.error(err)
    }
  }
  fetchUserSongData()
}, [user, id])

  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col"><Navbar /><main className="text-red-400 p-6 text-center">{error}</main><Footer /></div>
  if (!song) return <div className="min-h-screen flex flex-col"><Navbar /><main className="text-red-400 p-6 text-center">Song not found</main><Footer /></div>

  return (
    <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className='flex-1 flex flex-col items-center justify-center p-6 text-center'>
      <h1 className="text-2xl font-bold mb-4">{song.title}</h1>

      <p>BPM: {song.bpm}</p>
      <p>Genre: {song.genre}</p>
      <p>Year: {song.year_released}</p>

      {/*  Total listeners */}
      <p> Listeners: {listenedCount}</p>

      {/* Delete button only if user created song*/}
      {user && user.id == song.user_id && ( //User must be logged in and created for it to show up
        <>
      <button
        onClick={() => setDeleteOpen(true)}
        className="mt-6 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500"
      >
        Delete Song
      </button>
      {/* Edit button only if user created song*/}
      <button
        onClick={() => setEditOpen(true)}
        className="mt-6 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
      >
        Edit Song
      </button>
        </>
      )}

      {/* Add to Playlist button */}
      {user && ( //User must be logged in for it to show up
      <button
        onClick={() => setPlaylistOpen(true)}
        className="mt-6 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500"
      >
        Add to Playlist
      </button>
      )}
      {user &&  ( //User must be logged in for it to show up
        <>
      <DeleteSongModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        songId={song.id}
        songTitle={song.title}
        onDeleted={() => setSong(null)}
      />
      <EditSongModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        song={song}
        onUpdated={(updated) => setSong(updated)}
      />
      <AddToPlaylistModal
        isOpen={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        songId={song.id}
      />
      </>
      )}
    {user && ( //User must be logged in for it to show up
    <>
    <button
      onClick={async () => {
      if (!user) return alert("You must be logged in to mark as listened")
      try {
      const method = listened ? 'DELETE' : 'POST'
      const res = await fetch(`http://localhost:3001/api/songs/${id}/listened`, {
        method,
        headers: { 'x-user-id': user.id }
      })
      const data = await res.json()   
      if (res.ok) {
        setListened(!listened)
      } else {
        console.error(data.error)
      }
    } catch (err: any) {
      console.error(err.message)
    }
  }}
  className={`mt-4 px-4 py-2 rounded-lg text-black font-semibold ${
     listened ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}
>
    {listened ? 'Listened' : 'Mark as Listened'}
  </button>
  <button
      onClick={async () => {
      if (!user) return alert("You must be logged in to mark as listen to")
      try {
      const method = listento? 'DELETE' : 'POST'
      const res = await fetch(`http://localhost:3001/api/songs/${id}/listento`, {
        method,
        headers: { 'x-user-id': user.id }
      })
      const data = await res.json()   
      if (res.ok) {
        setListento(!listento)
      } else {
        console.error(data.error)
      }
    } catch (err: any) {
      console.error(err.message)
    }
  }}
  className={`mt-4 px-4 py-2 rounded-lg text-black font-semibold ${
     listento ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}
>
    {listento ? 'Listen To' : 'Mark as Listen To'}
  </button>
      </>
  )}
  </main>
  <Footer />
    </div>
  )
}


