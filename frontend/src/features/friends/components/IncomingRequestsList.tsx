import { Link } from 'react-router-dom'
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
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No incoming friend requests.</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No incoming requests matching '{searchQuery}'</p>
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
              to={`/user/${request.requester.id}`}
              className="text-white font-medium hover:text-blue-400"
            >
              {request.requester.username}
            </Link>
            <p className="text-gray-500 text-sm mt-1">
              Sent {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(request.id)}
              disabled={actionLoadingId === request.id}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {actionLoadingId === request.id ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={() => onReject(request.id)}
              disabled={actionLoadingId === request.id}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {actionLoadingId === request.id ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
