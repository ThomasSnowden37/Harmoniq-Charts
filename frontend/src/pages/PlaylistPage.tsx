import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Box, Button, Card, Flex, Heading, Text, TextArea } from '@radix-ui/themes'
import type { PlaylistWithSongs, PlaylistComment, PlaylistLike } from '../features/playlists/types'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'


/**
 * PlaylistPage.tsx
 *
 * Description:
 * This UI displays the playlist and information
 *  
 * Author: Brice
 * 
 */

export default function PlaylistPage() {
  const { playlistId } = useParams()
  const [playlist, setPlaylist] = useState<PlaylistWithSongs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Likes state
  const [likes, setLikes] = useState<PlaylistLike[]>([])
  const [liked, setLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)

  // Comments state
  const [comments, setComments] = useState<PlaylistComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  useEffect(() => {
    if (!playlistId) return
    fetchPlaylist()
    fetchLikes()
    checkLiked()
    fetchComments()
  }, [playlistId])

  async function fetchPlaylist() {
    setLoading(true)
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID }
      })
      if (res.status === 403) {
        const data = await res.json()
        throw new Error(data.error || 'This playlist is private')
      }
      if (!res.ok) throw new Error('Playlist not found')
      setPlaylist(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLikes() {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/likes`)
      if (res.ok) setLikes(await res.json())
    } catch {}
  }

  async function checkLiked() {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/likes/check`, {
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID }
      })
      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
      }
    } catch {}
  }

  async function toggleLike() {
    setLikeLoading(true)
    try {
      if (liked) {
        await fetch(`/api/playlists/${playlistId}/likes`, {
          method: 'DELETE',
          headers: { 'x-user-id': MOCK_CURRENT_USER_ID }
        })
        setLiked(false)
        setLikes(prev => prev.filter(l => l.user_id !== MOCK_CURRENT_USER_ID))
      } else {
        const res = await fetch(`/api/playlists/${playlistId}/likes`, {
          method: 'POST',
          headers: { 'x-user-id': MOCK_CURRENT_USER_ID }
        })
        if (res.ok) {
          setLiked(true)
          fetchLikes()
        }
      }
    } catch {}
    setLikeLoading(false)
  }

  async function fetchComments() {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/comments`)
      if (res.ok) setComments(await res.json())
    } catch {}
  }

  async function submitComment() {
    if (!newComment.trim()) return
    setCommentLoading(true)
    try {
      const res = await fetch(`/api/playlists/${playlistId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID
        },
        body: JSON.stringify({ content: newComment })
      })
      if (res.ok) {
        const comment = await res.json()
        setComments(prev => [comment, ...prev])
        setNewComment('')
      }
    } catch {}
    setCommentLoading(false)
  }

  async function deleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID }
      })
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId))
      }
    } catch {}
  }

  if (loading) {
    return (
      <Box className="min-h-screen flex flex-col">
        <Navbar />
        <Flex className="max-w-3xl mx-auto flex-1" p="6" justify="center" align="center">
          <Text color="gray">Loading...</Text>
        </Flex>
      </Box>
    )
  }

  if (error || !playlist) {
    return (
      <Box className="min-h-screen flex flex-col">
        <Navbar />
        <Flex className="max-w-3xl mx-auto flex-1" p="6" justify="center" align="center">
          <Text color="red">{error || 'Playlist not found'}</Text>
        </Flex>
        <Footer />
      </Box>
    )
  }

  return (
    <Box className="min-h-screen flex flex-col">
      <Navbar />
      <Box className="max-w-3xl mx-auto flex-1 w-full" p="6">
        <Box mb="5">
          <Flex justify="between" align="start">
            <div>
              <Heading size="7" mb="1">{playlist.name}</Heading>
              {playlist.users?.username && (
                <Link to={`/user/${playlist.user_id}`}>
                  <Text size="2" color="gray" className="hover:underline">
                    by {playlist.users.username}
                  </Text>
                </Link>
              )}
              <Text size="2" color="gray" as="p" mt="1">
                {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
              </Text>
            </div>
            <Button
              variant={liked ? 'solid' : 'outline'}
              onClick={toggleLike}
              disabled={likeLoading}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {likes.length}
            </Button>
          </Flex>
        </Box>

        {playlist.songs.length === 0 ? (
          <Card size="3">
            <Flex direction="column" align="center" py="6">
              <Text color="gray">This playlist is empty.</Text>
            </Flex>
          </Card>
        ) : (
          <Flex direction="column" gap="2">
            {playlist.songs.map((song, idx) => (
              <Link
                key={song.id}
                to={`/songs/${song.id}`}
                className="flex items-center gap-4 p-4 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--gray-a3)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--gray-a4)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--gray-a3)'}
              >
                <Text color="gray" className="w-6 text-right">{idx + 1}</Text>
                <div className="flex-1 min-w-0">
                  <Text weight="medium" className="truncate block">{song.title}</Text>
                  <Text size="2" color="gray">
                    {song.genre} • {song.year_released} • {song.bpm} BPM
                  </Text>
                </div>
              </Link>
            ))}
          </Flex>
        )}

        {/* Comments Section */}
        <Box mt="8">
          <Heading size="4" mb="4">Comments</Heading>
          
          {/* Add Comment */}
          <Card mb="4">
            <Flex direction="column" gap="3" p="3">
              <TextArea
                placeholder="Add a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                disabled={commentLoading}
              />
              <Flex justify="end">
                <Button onClick={submitComment} disabled={commentLoading || !newComment.trim()}>
                  {commentLoading ? 'Posting...' : 'Post Comment'}
                </Button>
              </Flex>
            </Flex>
          </Card>

          {/* Comments List */}
          {comments.length === 0 ? (
            <Text color="gray">No comments yet. Be the first to comment!</Text>
          ) : (
            <Flex direction="column" gap="3">
              {comments.map(comment => (
                <Card key={comment.id}>
                  <Flex direction="column" gap="2" p="3">
                    <Flex justify="between" align="center">
                      <Link to={`/user/${comment.user_id}`}>
                        <Text size="2" weight="medium" className="hover:underline">
                          {comment.users?.username || 'Unknown User'}
                        </Text>
                      </Link>
                      <Flex align="center" gap="2">
                        <Text size="1" color="gray">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </Text>
                        {comment.user_id === MOCK_CURRENT_USER_ID && (
                          <Button
                            size="1"
                            variant="ghost"
                            color="red"
                            onClick={() => deleteComment(comment.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </Flex>
                    </Flex>
                    <Text>{comment.content}</Text>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Box>
      </Box>
      <Footer />
    </Box>
  )
}
