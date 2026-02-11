import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import FriendsModal from '../features/friends/components/FriendsModal'
import SettingsModal from '../features/settings/components/SettingsModal'
import type { PrivacySetting } from '../features/settings/types'

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

  const isOwnProfile = userId === MOCK_CURRENT_USER_ID

  useEffect(() => {
    if (!userId) return
    fetchProfile()
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
      setRelationship({ status: 'none' }) // Clear the relation between the users
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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Render the buttons for own profile (Manage Friends + Settings)
  function renderOwnProfileButtons() {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setShowFriendsModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Manage Friends
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
        >
          Settings
        </button>
      </div>
    )
  }

  // Render the button based on the status of friendship
  function renderFriendButton() {
    if (isOwnProfile) return renderOwnProfileButtons()

    switch (relationship.status) {
      case 'none':
        return (
          <button onClick={sendFriendRequest} disabled={actionLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
            {actionLoading ? 'Sending...' : 'Add Friend'}
          </button>
        )
      case 'outgoing_pending':
        return (
          <button onClick={cancelRequest} disabled={actionLoading}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg disabled:opacity-50">
            {actionLoading ? 'Cancelling...' : 'Pending - Cancel Request'}
          </button>
        )
      case 'incoming_pending':
        return (
          <button onClick={acceptRequest} disabled={actionLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
            {actionLoading ? 'Accepting...' : 'Accept Friend Request'}
          </button>
        )
      case 'friends':
        return (
          <button onClick={unfriend} disabled={actionLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
            {actionLoading ? 'Unfollowing...' : 'Unfollow'}
          </button>
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    )
  }

  if (error && !profileUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  const isRestricted = !isOwnProfile && profileUser?.restricted

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{profileUser?.username}</h1>
            <p className="text-gray-400 mt-1">
              {profileUser?.privacy === 'private' ? 'Private Account' : 'Public Account'}
            </p>
          </div>
          {renderFriendButton()}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {isRestricted ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-lg mb-2">This account is private</p>
            <p className="text-gray-500 text-sm">Send a friend request to see their content.</p>
          </div>
        ) : (
          <>
            {relationship.status === 'friends' && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-4">
                <p className="text-green-300 text-sm">You are friends with this user</p>
              </div>
            )}
          </>
        )}
      </div>

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
    </div>
  )
}
