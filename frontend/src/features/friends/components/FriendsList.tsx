import { Link } from 'react-router-dom'
import type { Friend } from '../types'

interface FriendsListProps {
  friends: Friend[]
  searchQuery: string
  onUnfriend: (friendId: string) => void
  actionLoadingId: string | null
}

export default function FriendsList({ friends, searchQuery, onUnfriend, actionLoadingId }: FriendsListProps) {
  const filtered = friends.filter((f) =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (friends.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No friends yet.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No friends matching '{searchQuery}'</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {filtered.map((friend) => (
        <li
          key={friend.id}
          className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
        >
          <Link
            to={`/user/${friend.id}`}
            className="text-white font-medium hover:text-blue-400"
          >
            {friend.username}
          </Link>
          <button
            onClick={() => onUnfriend(friend.id)}
            disabled={actionLoadingId === friend.id}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {actionLoadingId === friend.id ? 'Removing...' : 'Unfriend'}
          </button>
        </li>
      ))}
    </ul>
  )
}
