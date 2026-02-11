export type FriendsTab = 'friends' | 'incoming' | 'outgoing'

export interface Friend {
  id: string
  username: string
}

export interface IncomingRequest {
  id: string
  requester_id: string
  created_at: string
  requester: {
    id: string
    username: string
  }
}

export interface OutgoingRequest {
  id: string
  addressee_id: string
  created_at: string
  addressee: {
    id: string
    username: string
  }
}
