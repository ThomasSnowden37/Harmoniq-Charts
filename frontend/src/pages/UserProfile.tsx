import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import FriendsModal from '../features/friends/components/FriendsModal'
import SettingsModal from '../features/settings/components/SettingsModal'
import PlaylistSection from '../features/playlists/components/PlaylistSection'
import DeleteUserModal from '../features/users/components/DeleteUserModal'
import type { PrivacySetting } from '../features/settings/types'
import type { Playlist } from '../features/playlists/types'
import type { SpotifyConnectionStatus } from '../features/spotify/types'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Link,
  Separator,
  Tabs,
  Text,
} from '@radix-ui/themes'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

type RelationshipStatus = 'none' | 'friends' | 'outgoing_pending' | 'incoming_pending'

interface ProfileUser {
  id: string
  username: string
  privacy: PrivacySetting
  restricted?: boolean
}

interface RelationshipData {
  status: RelationshipStatus
  request?: { id: string }
}

/**
 * UserProfile.tsx
 *
 * Description:
 * This defines the UI for user's profile. Manages being able to see another user's profile page
 * See the comments on the functions for more implementation details.
 *
 * Author: Tristan Sze
 *
 */

// TODO: I need to replace all the mock info with the user tables info

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null)
  const [relationship, setRelationship] = useState<RelationshipData>({ status: 'none' })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [friendCount, setFriendCount] = useState(0)
  const [deleteUserModal, setDeleteUserModal] = useState(false)
  const [spotifyInfo, setSpotifyInfo] = useState<SpotifyConnectionStatus | null>(null)
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null)

  const isOwnProfile = userId === MOCK_CURRENT_USER_ID

  // Handle Spotify OAuth callback query params
  useEffect(() => {
    const spotifyConnected = searchParams.get('spotify_connected')
    const spotifyError = searchParams.get('spotify_error')
    
    if (spotifyConnected === 'true') {
      setSpotifyMessage('Spotify connected successfully!')
      setSearchParams({}) // Clear query params
      fetchSpotifyInfo() // Refresh spotify info
      setTimeout(() => setSpotifyMessage(null), 5000)
    } else if (spotifyError) {
      setSpotifyMessage(`Spotify connection failed: ${spotifyError}`)
      setSearchParams({})
      setTimeout(() => setSpotifyMessage(null), 5000)
    }
  }, [searchParams])

  // TODO: Replace with real data from API
  const stats = {
    reviews: 0,
    friends: friendCount,
    playlists: playlists.length,
  }

  useEffect(() => {
    if (!userId) return
    fetchProfile()
    fetchPlaylists()
    fetchFriendCount()
    fetchSpotifyInfo()
    if (!isOwnProfile) {
      fetchRelationship()
    }
  }, [userId])

  // Hits the get endpoint for the profiles information
  async function fetchProfile() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (!res.ok) throw new Error('User not found')
      const data = await res.json()
      setProfileUser(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchFriendCount() {
    try {
      const res = await fetch('/api/friend-requests/friends', {
        headers: { 'x-user-id': userId! },
      })
      if (res.ok) {
        const data = await res.json()
        setFriendCount(data.length)
      }
    } catch (err) {
      console.error('Failed to fetch friend count:', err)
    }
  }

  async function fetchPlaylists() {
    try {
      const res = await fetch(`/api/playlists/user/${userId}`)
      if (res.ok) setPlaylists(await res.json())
    } catch (err) {
      console.error('Failed to fetch playlists:', err)
    }
  }

  async function fetchSpotifyInfo() {
    try {
      const res = await fetch(`/api/users/${userId}/spotify`, {
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (res.ok) {
        const data = await res.json()
        setSpotifyInfo(data)
      }
    } catch (err) {
      console.error('Failed to fetch Spotify info:', err)
    }
  }

  // Find specific information on a relationship (might be needed I'm not sure at the moment)
  async function fetchRelationship() {
    try {
      const res = await fetch(`/api/friend-requests/status/${userId}`, {
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (!res.ok) throw new Error('Failed to fetch relationship')
      const data = await res.json()
      setRelationship(data)
    } catch (err: any) {
      console.error('Failed to fetch relationship:', err)
    }
  }

  // Function to send a friend req to another user
  async function sendFriendRequest() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': MOCK_CURRENT_USER_ID,
        },
        body: JSON.stringify({ addressee_id: userId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      await fetchRelationship()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // This is an important feat allowing users to cancel their pending friend request
  async function cancelRequest() {
    if (!relationship.request) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/friend-requests/${relationship.request.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (!res.ok) throw new Error('Failed to cancel request')
      setRelationship({ status: 'none' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Ability to accept the friend requests
  async function acceptRequest() {
    if (!relationship.request) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/friend-requests/${relationship.request.id}/accept`, {
        method: 'PATCH',
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (!res.ok) throw new Error('Failed to accept request')
      await fetchRelationship()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Ability to remove a friend from your following
  async function unfriend() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/friend-requests/unfriend/${userId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': MOCK_CURRENT_USER_ID },
      })
      if (!res.ok) throw new Error('Failed to unfriend')
      setRelationship({ status: 'none' })
      setFriendCount(c => Math.max(0, c - 1))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  function renderActionButtons() {
    if (isOwnProfile) {
      return (
        <Flex gap="2">
          <Button onClick={() => setShowFriendsModal(true)}>
            Manage Friends
          </Button>
          <Button variant="outline" onClick={() => setShowSettingsModal(true)}>
            Settings
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/songs/listento'}>
            Listen To
          </Button>
        </Flex>
      )
    }

    switch (relationship.status) {
      case 'none':
        return (
          <Button onClick={sendFriendRequest} disabled={actionLoading}>
            {actionLoading ? 'Sending...' : 'Add Friend'}
          </Button>
        )
      case 'outgoing_pending':
        return (
          <Button variant="soft" color="orange" onClick={cancelRequest} disabled={actionLoading}>
            {actionLoading ? 'Cancelling...' : 'Pending - Cancel Request'}
          </Button>
        )
      case 'incoming_pending':
        return (
          <Button color="green" onClick={acceptRequest} disabled={actionLoading}>
            {actionLoading ? 'Accepting...' : 'Accept Friend Request'}
          </Button>
        )
      case 'friends':
        return (
          <Button color="red" variant="soft" onClick={unfriend} disabled={actionLoading}>
            {actionLoading ? 'Unfollowing...' : 'Unfollow'}
          </Button>
        )
    }
  }

  function handlePrivacyChange(privacy: PrivacySetting) {
    if (profileUser) {
      setProfileUser({ ...profileUser, privacy })
    }
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" className="min-h-screen">
        <Text color="gray">Loading profile...</Text>
      </Flex>
    )
  }

  if (error && !profileUser) {
    return (
      <Flex align="center" justify="center" className="min-h-screen">
        <Text color="red">{error}</Text>
      </Flex>
    )
  }

  const isRestricted = !isOwnProfile && profileUser?.restricted
  const initials = profileUser?.username?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <Box className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      {/* Spotify connection notification */}
      {spotifyMessage && (
        <Box 
          p="3" 
          style={{ 
            backgroundColor: spotifyMessage.includes('failed') ? 'var(--red-3)' : 'var(--green-3)',
            borderBottom: '1px solid var(--gray-6)'
          }}
        >
          <Text 
            size="2" 
            color={spotifyMessage.includes('failed') ? 'red' : 'green'}
            align="center"
            style={{ display: 'block' }}
          >
            {spotifyMessage}
          </Text>
        </Box>
      )}
      
      <Box className="max-w-3xl w-full mx-auto flex-grow" p="4" pt="6">
        {/* Profile Header */}
        <Card size="3">
          <Flex align="center" gap="5">
            <Avatar
              size="7"
              fallback={initials}
              variant="solid"
            />
            <Box className="flex-1 min-w-0">
              <Flex align="center" gap="3" wrap="wrap">
                <Heading size="6">{profileUser?.username}</Heading>
                <Badge
                  variant="soft"
                  color={profileUser?.privacy === 'private' ? 'gray' : 'blue'}
                >
                  {profileUser?.privacy === 'private' ? 'Private' : 'Public'}
                </Badge>
                {relationship.status === 'friends' && (
                  <Badge variant="soft" color="green">Friends</Badge>
                )}
                {spotifyInfo?.connected && (
                  <Link
                    href={spotifyInfo.profileUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Badge
                      variant="soft"
                      color="green"
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      {spotifyInfo.displayName || 'Spotify'}
                    </Badge>
                  </Link>
                )}
              </Flex>
              <Box mt="3">
                {renderActionButtons()}
              </Box>
            </Box>
          </Flex>

          {error && (
            <Box mt="4" p="3" className="rounded-lg border border-destructive/30 bg-destructive/10">
              <Text className="text-destructive" size="2">{error}</Text>
            </Box>
          )}

          <Separator size="4" my="5" />

          {/* Stats Row */}
          <Flex justify="center" gap="8">
            <Box className="text-center">
              <Text size="7" weight="bold" as="p">{stats.reviews}</Text>
              <Text size="2" color="gray">Reviews</Text>
            </Box>
            <Box className="text-center">
              <Text size="7" weight="bold" as="p">{stats.friends}</Text>
              <Text size="2" color="gray">Friends</Text>
            </Box>
            <Box className="text-center">
              <Text size="7" weight="bold" as="p">{stats.playlists}</Text>
              <Text size="2" color="gray">Playlists</Text>
            </Box>
          </Flex>
        </Card>

        {/* Restricted message */}
        {isRestricted ? (
          <Card size="3" mt="5">
            <Flex direction="column" align="center" py="8">
              <Text size="4" weight="medium" color="gray">This account is private</Text>
              <Text size="2" color="gray" mt="1">Send a friend request to see their content.</Text>
            </Flex>
          </Card>
        ) : (
          /* Reviews & Playlists Tabs */
          <Tabs.Root defaultValue="reviews" className="mt-5">
            <Tabs.List>
              <Tabs.Trigger value="reviews">Reviews</Tabs.Trigger>
              <Tabs.Trigger value="playlists">Playlists</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="reviews">
              <Card size="3" mt="3">
                <Heading size="4" mb="4">Reviews</Heading>
                {stats.reviews === 0 ? (
                  <Flex direction="column" align="center" py="6">
                    <Text color="gray">No reviews yet.</Text>
                    {isOwnProfile && (
                      <Text size="2" color="gray" mt="1">
                        Share your thoughts on your favorite music!
                      </Text>
                    )}
                  </Flex>
                ) : (
                  <Flex direction="column" gap="4">
                    {/* TODO: Map over real reviews here */}
                  </Flex>
                )}
              </Card>
            </Tabs.Content>

            <Tabs.Content value="playlists">
              <PlaylistSection
                playlists={playlists}
                setPlaylists={setPlaylists}
                isOwnProfile={isOwnProfile}
              />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Box>

      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
      />

      {profileUser && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentPrivacy={profileUser.privacy}
          onPrivacyChange={handlePrivacyChange}
          // Add these two new props:
          currentUsername={profileUser.username}
          onUsernameChange={(newUsername) => setProfileUser({ ...profileUser, username: newUsername })}
          onDeleteAccount={() => {
            setShowSettingsModal(false)
            setDeleteUserModal(true)
          }}
        />
      )}

      <DeleteUserModal
          isOpen={deleteUserModal}
          onClose={() => setDeleteUserModal(false)}
          onDeleted={() => {
            window.location.href = '/'
          }}
        />
      <Footer />
    </Box>
  )
}
