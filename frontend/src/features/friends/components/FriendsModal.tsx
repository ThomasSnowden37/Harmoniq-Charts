import { useEffect, useState, useCallback } from 'react'
import { Dialog } from '@radix-ui/themes'
import { X } from 'lucide-react'
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

  const tabs: { key: FriendsTab; label: string; count: number }[] = [
    { key: 'friends', label: 'Friends', count: friends.length },
    { key: 'incoming', label: 'Incoming', count: incoming.length },
    { key: 'outgoing', label: 'Outgoing', count: outgoing.length },
  ]

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="500px" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between">
          <Dialog.Title mb="0">Friends</Dialog.Title>
          <Dialog.Close>
            <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5">
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
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="bg-destructive/20 border border-destructive rounded-lg p-3 mb-4">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading...</p>
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
      </Dialog.Content>
    </Dialog.Root>
  )
}
