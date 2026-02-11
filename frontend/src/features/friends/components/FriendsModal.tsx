import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MOCK_CURRENT_USER_ID } from '../../../lib/auth'
import type { FriendsTab, Friend, IncomingRequest, OutgoingRequest } from '../types'
import FriendsList from './FriendsList'
import IncomingRequestsList from './IncomingRequestsList'
import OutgoingRequestsList from './OutgoingRequestsList'

interface FriendsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
  const [activeTab, setActiveTab] = useState<FriendsTab>('friends')
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const headers = { 'x-user-id': MOCK_CURRENT_USER_ID }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
        fetch('/api/friend-requests/friends', { headers }),
        fetch('/api/friend-requests/incoming', { headers }),
        fetch('/api/friend-requests/outgoing', { headers }),
      ])
      if (!friendsRes.ok || !incomingRes.ok || !outgoingRes.ok) {
        throw new Error('Failed to fetch friends data')
      }
      const [friendsData, incomingData, outgoingData] = await Promise.all([
        friendsRes.json(),
        incomingRes.json(),
        outgoingRes.json(),
      ])
      setFriends(friendsData)
      setIncoming(incomingData)
      setOutgoing(outgoingData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchAll()
    }
  }, [isOpen, fetchAll])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  function switchTab(tab: FriendsTab) {
    setActiveTab(tab)
    setSearchQuery('')
  }

  async function handleAccept(requestId: string) {
    setActionLoadingId(requestId)
    try {
      const res = await fetch(`/api/friend-requests/${requestId}/accept`, {
        method: 'PATCH',
        headers,
      })
      if (!res.ok) throw new Error('Failed to accept request')
      setIncoming((prev) => prev.filter((r) => r.id !== requestId))
      // Re-fetch friends so the new friend appears
      const friendsRes = await fetch('/api/friend-requests/friends', { headers })
      if (friendsRes.ok) {
        setFriends(await friendsRes.json())
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleReject(requestId: string) {
    setActionLoadingId(requestId)
    try {
      const res = await fetch(`/api/friend-requests/${requestId}/reject`, {
        method: 'PATCH',
        headers,
      })
      if (!res.ok) throw new Error('Failed to reject request')
      setIncoming((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleCancel(requestId: string) {
    setActionLoadingId(requestId)
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Failed to cancel request')
      setOutgoing((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleUnfriend(friendId: string) {
    setActionLoadingId(friendId)
    try {
      const res = await fetch(`/api/friend-requests/unfriend/${friendId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Failed to unfriend')
      setFriends((prev) => prev.filter((f) => f.id !== friendId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  if (!isOpen) return null

  const tabs: { key: FriendsTab; label: string; count: number }[] = [
    { key: 'friends', label: 'Friends', count: friends.length },
    { key: 'incoming', label: 'Incoming', count: incoming.length },
    { key: 'outgoing', label: 'Outgoing', count: outgoing.length },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-bold text-white">Friends</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs bg-gray-700 text-gray-300 rounded-full px-2 py-0.5">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'friends' && (
                <FriendsList
                  friends={friends}
                  searchQuery={searchQuery}
                  onUnfriend={handleUnfriend}
                  actionLoadingId={actionLoadingId}
                />
              )}
              {activeTab === 'incoming' && (
                <IncomingRequestsList
                  requests={incoming}
                  searchQuery={searchQuery}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  actionLoadingId={actionLoadingId}
                />
              )}
              {activeTab === 'outgoing' && (
                <OutgoingRequestsList
                  requests={outgoing}
                  searchQuery={searchQuery}
                  onCancel={handleCancel}
                  actionLoadingId={actionLoadingId}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
