import { Link } from 'react-router-dom'
import { Button } from '@radix-ui/themes'
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
      <div className="bg-secondary rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No friends yet.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-secondary rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No friends matching '{searchQuery}'</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {filtered.map((friend) => (
        <li
          key={friend.id}
          className="bg-secondary rounded-lg p-4 flex items-center justify-between"
        >
          <Link
            to={`/user/${friend.id}`}
            className="text-foreground font-medium hover:text-primary"
          >
            {friend.username}
          </Link>
          <Button
            size="2"
            color="red"
            onClick={() => onUnfriend(friend.id)}
            disabled={actionLoadingId === friend.id}
          >
            {actionLoadingId === friend.id ? 'Removing...' : 'Unfriend'}
          </Button>
        </li>
      ))}
    </ul>
  )
}
