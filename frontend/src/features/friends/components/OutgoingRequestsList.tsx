import { Link } from 'react-router-dom'
import { Button } from '@radix-ui/themes'
import type { OutgoingRequest } from '../types'

interface OutgoingRequestsListProps {
  requests: OutgoingRequest[]
  searchQuery: string
  onCancel: (requestId: string) => void
  actionLoadingId: string | null
}

export default function OutgoingRequestsList({ requests, searchQuery, onCancel, actionLoadingId }: OutgoingRequestsListProps) {
  const filtered = requests.filter((r) =>
    r.addressee.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (requests.length === 0) {
    return (
      <div className="bg-secondary rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No outgoing friend requests.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-secondary rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No outgoing requests matching '{searchQuery}'</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {filtered.map((request) => (
        <li
          key={request.id}
          className="bg-secondary rounded-lg p-4 flex items-center justify-between"
        >
          <div>
            <Link
              to={`/user/${request.addressee.id}`}
              className="text-foreground font-medium hover:text-primary"
            >
              {request.addressee.username}
            </Link>
            <p className="text-muted-foreground text-sm mt-1">
              Sent {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button
            size="2"
            color="orange"
            variant="soft"
            onClick={() => onCancel(request.id)}
            disabled={actionLoadingId === request.id}
          >
            {actionLoadingId === request.id ? 'Cancelling...' : 'Cancel Request'}
          </Button>
        </li>
      ))}
    </ul>
  )
}
