import { Link } from 'react-router-dom'
import { Button } from '@radix-ui/themes'
import type { IncomingRequest } from '../types'

interface IncomingRequestsListProps {
  requests: IncomingRequest[]
  searchQuery: string
  onAccept: (requestId: string) => void
  onReject: (requestId: string) => void
  actionLoadingId: string | null
}

export default function IncomingRequestsList({ requests, searchQuery, onAccept, onReject, actionLoadingId }: IncomingRequestsListProps) {
  const filtered = requests.filter((r) =>
    r.requester.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (requests.length === 0) {
    return (
      <div className="bg-secondary rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No incoming friend requests.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-secondary rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No incoming requests matching '{searchQuery}'</p>
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
              to={`/user/${request.requester.id}`}
              className="text-foreground font-medium hover:text-primary"
            >
              {request.requester.username}
            </Link>
            <p className="text-muted-foreground text-sm mt-1">
              Sent {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="2"
              color="green"
              onClick={() => onAccept(request.id)}
              disabled={actionLoadingId === request.id}
            >
              {actionLoadingId === request.id ? 'Accepting...' : 'Accept'}
            </Button>
            <Button
              size="2"
              color="red"
              variant="soft"
              onClick={() => onReject(request.id)}
              disabled={actionLoadingId === request.id}
            >
              {actionLoadingId === request.id ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
