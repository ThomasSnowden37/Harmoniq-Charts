import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button, Avatar } from '@radix-ui/themes'
import DeleteSongModal from '../features/songs/components/DeleteSongModal'
import EditSongModal from '../features/songs/components/EditSongModal'
import AddToPlaylistModal from '../features/playlists/components/AddToPlaylistModal'
import RatingSong from '../features/songs/components/RatingSong'
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
    album_id?: string
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
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)
    const [reviews, setReviews] = useState<{ id: string; content: string; created_at: string; user_id: string; users: { username: string } }[]>([])
    const [reviewText, setReviewText] = useState('')
    const [reviewError, setReviewError] = useState<string | null>(null)
    const [submittingReview, setSubmittingReview] = useState(false)
    const [albumLoading, setAlbumLoading] = useState<'listento' | 'listened' | null>(null);
    const [albumSuccess, setAlbumSuccess] = useState<'listento' | 'listened' | null>(null);
    const [albumPlaylistOpen, setAlbumPlaylistOpen] = useState(false)

    const MAX_CHARS = 500
    const userReview = reviews.find(r => r.user_id === user?.id)


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

          const likeRes = await fetch(`/api/likes/${id}/status`)
          const likeData = await likeRes.json()
          if (likeRes.ok) setLikeCount(likeData.count)

          const reviewsRes = await fetch(`/api/reviews/song/${id}`)
          if (reviewsRes.ok) setReviews(await reviewsRes.json())

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

        const likeStatusRes = await fetch(`/api/likes/${id}/status`, {
          headers: { 'x-user-id': userId }
        })
        const likeStatusData = await likeStatusRes.json()
        if (likeStatusRes.ok) {
          setLiked(likeStatusData.liked)
          setLikeCount(likeStatusData.count)
        }
    } catch (err) {
      console.error(err)
    }
  }
  fetchUserSongData()
}, [user, id])

const handleAddAlbum = async (target: 'listento' | 'listened') => {
        if (!user || !song?.album_id) return;
        
        setAlbumLoading(target);
        setAlbumSuccess(null);

        try {
            const res = await fetch(`http://localhost:3001/api/songs/album/${song.album_id}/bulk-add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.id
                },
                body: JSON.stringify({ targetTable: target })
            });

            if (res.ok) {
                if (target === 'listento') setListento(true);
                if (target === 'listened') setListened(true);
                
                setAlbumSuccess(target);
                // Clear success message after 3 seconds
                setTimeout(() => setAlbumSuccess(null), 3000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAlbumLoading(null);
        }
  };

  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">{error}</main><Footer /></div>
  if (!song) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">Song not found</main><Footer /></div>

  return (
    <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className='flex-1 flex flex-col items-center justify-center p-6 text-center'>
      <h1 className="text-2xl font-bold mb-4">{song.title}</h1>

      <p>BPM: {song.bpm}</p>
      <p>Genre: {song.genre}</p>
      <p>Year: {song.year_released}</p>

      {/*  Total listeners */}
      <p>Listeners: {listenedCount}</p>
      <p>Likes: {likeCount}</p>

      <RatingSong id = {song.id} />

      {/* Delete button only if user created song*/}
      {user && user.id == song.user_id && ( //User must be logged in and created for it to show up
        <>
      <Button
        size="2"
        color="red"
        onClick={() => setDeleteOpen(true)}
        className="mt-6"
      >
        Delete Song
      </Button>
      {/* Edit button only if user created song*/}
      <Button
        size="2"
        onClick={() => setEditOpen(true)}
        className="mt-6"
      >
        Edit Song
      </Button>
        </>
      )}

      {/* Add to Playlist button */}
      {user && ( //User must be logged in for it to show up
      <Button
        size="2"
        color="green"
        onClick={() => setPlaylistOpen(true)}
        className="mt-6"
      >
        Add to Playlist
      </Button>
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
      {song.album_id && (
                <AddToPlaylistModal
                    isOpen={albumPlaylistOpen}
                    onClose={() => setAlbumPlaylistOpen(false)}
                    albumId={song.album_id} 
                />
      )}
      </>
      )}
    {user && ( //User must be logged in for it to show up
    <>
    <Button
      size="2"
      variant={listened ? 'solid' : 'soft'}
      color={listened ? 'green' : 'gray'}
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
  className="mt-4"
>
    {listened ? 'Listened' : 'Mark as Listened'}
  </Button>
  <Button
      size="2"
      variant={listento ? 'solid' : 'soft'}
      color={listento ? 'green' : 'gray'}
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
  className="mt-4"
>
    {listento ? 'Listen To' : 'Mark as Listen To'}
  </Button>
  <Button
    size="2"
    variant={liked ? 'solid' : 'soft'}
    color={liked ? 'red' : 'gray'}
    onClick={async () => {
      try {
        const method = liked ? 'DELETE' : 'POST'
        const res = await fetch(`/api/likes/${id}`, {
          method,
          headers: { 'x-user-id': user.id }
        })
        if (res.ok) {
          setLiked(!liked)
          setLikeCount(c => liked ? c - 1 : c + 1)
        }
      } catch (err: any) {
        console.error(err.message)
      }
    }}
    className="mt-4"
  >
    {liked ? '♥ Liked' : '♡ Like'}
  </Button>
      </>
  )}
  {/* Album Actions Section */}
  {user && song.album_id && (
    <div className="mb-12 p-6 rounded-2xl border border-dashed border-border bg-card/50 max-w-md w-full">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Full Album Actions</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center">
          <Button 
            variant="outline" 
            color={albumSuccess === 'listento' ? 'green' : 'blue'}
            disabled={albumLoading !== null}
            onClick={() => handleAddAlbum('listento')}
            className="w-full sm:w-auto"
          >
            {albumLoading === 'listento' ? 'Adding...' : 
            albumSuccess === 'listento' ? 'Album Added!' : 
            '+ Album to "Listen To"'}
          </Button>
                            
          <Button 
          variant="outline" 
          color={albumSuccess === 'listened' ? 'green' : 'indigo'}
          disabled={albumLoading !== null}
          onClick={() => handleAddAlbum('listened')}
          className="w-full sm:w-auto"
        >
          {albumLoading === 'listened' ? 'Adding...' : 
          albumSuccess === 'listened' ? 'Album Added!' : 
          '+ Album to "Listened"'}
        </Button>

        <Button 
          variant="outline" 
          color="orange" 
          onClick={() => setAlbumPlaylistOpen(true)}
          className="w-full sm:w-auto"
        >
          + Album to Playlist
        </Button>
      </div>
    </div>                                                                      
  )}                                  
  </main>

  {/* Reviews Section */}
  <section className="max-w-2xl mx-auto w-full px-6 pb-16">
    <h2 className="text-xl font-bold mb-6">Reviews</h2>

    {/* Review form — only shown if logged in and hasn't reviewed yet */}
    {user && !userReview && (
      <div className="mb-8 p-4 rounded-xl border border-border bg-card">
        <h3 className="text-sm font-medium mb-2">Leave a Review</h3>
        <textarea
          value={reviewText}
          onChange={e => { setReviewText(e.target.value); setReviewError(null) }}
          placeholder="What did you think of this song?"
          rows={4}
          maxLength={MAX_CHARS}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs ${reviewText.length >= MAX_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}>
            {reviewText.length}/{MAX_CHARS}
          </span>
          <div className="flex items-center gap-3">
            {reviewError && <span className="text-xs text-destructive">{reviewError}</span>}
            <Button
              size="2"
              disabled={submittingReview || !reviewText.trim()}
              onClick={async () => {
                setSubmittingReview(true)
                setReviewError(null)
                try {
                  const res = await fetch(`/api/reviews/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
                    body: JSON.stringify({ content: reviewText.trim() }),
                  })
                  const data = await res.json()
                  if (!res.ok) { setReviewError(data.error); return }
                  setReviews(prev => [data, ...prev])
                  setReviewText('')
                } catch {
                  setReviewError('Failed to submit review')
                } finally {
                  setSubmittingReview(false)
                }
              }}
            >
              {submittingReview ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Review list */}
    {reviews.length === 0 ? (
      <p className="text-muted-foreground text-sm text-center py-8">No reviews yet. Be the first!</p>
    ) : (
      <div className="space-y-4">
        {reviews.map(review => (
          <div key={review.id} className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Link to={`/user/${review.user_id}`}>
                  <Avatar 
                    size="2" 
                    radius="full" 
                    fallback={review.users?.username?.slice(0, 2).toUpperCase() || '??'} 
                    className="hover:opacity-80 transition-opacity"
                  />
                </Link>
                <Link to={`/user/${review.user_id}`} className="text-sm font-medium text-foreground hover:text-primary no-underline">
                  {review.users.username}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
                {user?.id === review.user_id && (
                  <button
                    className="text-xs text-destructive hover:underline cursor-pointer"
                    onClick={async () => {
                      const res = await fetch(`/api/reviews/${review.id}`, {
                        method: 'DELETE',
                        headers: { 'x-user-id': user.id },
                      })
                      if (res.ok) setReviews(prev => prev.filter(r => r.id !== review.id))
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{review.content}</p>
          </div>
        ))}
      </div>
    )}
  </section>

  <Footer />
    </div>
  )
}


