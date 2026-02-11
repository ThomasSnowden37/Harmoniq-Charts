import { Link } from 'react-router-dom'
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
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No outgoing friend requests.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No outgoing requests matching '{searchQuery}'</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {filtered.map((request) => (
        <li
          key={request.id}
          className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
        >
          <div>
            <Link
              to={`/user/${request.addressee.id}`}
              className="text-white font-medium hover:text-blue-400"
            >
              {request.addressee.username}
            </Link>
            <p className="text-gray-500 text-sm mt-1">
              Sent {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => onCancel(request.id)}
            disabled={actionLoadingId === request.id}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {actionLoadingId === request.id ? 'Cancelling...' : 'Cancel Request'}
          </button>
        </li>
      ))}
    </ul>
  )
}
