import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import FriendsModal from '../features/friends/components/FriendsModal'
import SettingsModal from '../features/settings/components/SettingsModal'
import PlaylistSection from '../features/playlists/components/PlaylistSection'
import DeleteUserModal from '../features/users/components/DeleteUserModal'
import type { PrivacySetting } from '../features/settings/types'
import type { Playlist } from '../features/playlists/types'
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

  const isOwnProfile = userId === MOCK_CURRENT_USER_ID

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
          <Button variant="outline" color="red" onClick={() => setDeleteUserModal(true)}>
            Delete Account
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
    <Box className="min-h-screen">
      <Navbar />
      <Box className="max-w-3xl mx-auto" p="4" pt="6">
        {/* Profile Header */}
        <Card size="3">
          <Flex align="center" gap="5">
            <Avatar
              size="7"
              fallback={initials}
              color="indigo"
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
              </Flex>
              <Box mt="3">
                {renderActionButtons()}
              </Box>
            </Box>
          </Flex>

          {error && (
            <Box mt="4" p="3" className="rounded-lg border border-red-200 bg-red-50">
              <Text color="red" size="2">{error}</Text>
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
        />
      )}

      <DeleteUserModal
          isOpen={deleteUserModal}
          onClose={() => setDeleteUserModal(false)}
          onDeleted={() => {
            window.location.href = '/'
          }}
        />
      <Box mt="8">
        <Footer />
      </Box>
    </Box>
  )
}
