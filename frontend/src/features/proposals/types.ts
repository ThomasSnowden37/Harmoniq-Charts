export type ProposalType = 'song_add' | 'song_edit' | 'song_merge' | 'artist_link_spotify' | 'album_link_spotify' | 'playlist_song_add'
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'merged' | 'reverted'
export type ProposalVoteReasonCode = 'duplicate' | 'incorrect_metadata' | 'not_enough_context' | 'wrong_target' | 'bad_source' | 'other'

export interface CandidateMatch {
  songId: string
  title: string
  artistNames: string[]
  albumName: string | null
  spotifyId: string | null
  confidence: number
  reasons: string[]
}

export interface ProposalDiffEntry {
  field: string
  original: unknown
  proposed: unknown
}

export interface ProposalVote {
  proposal_id: string
  user_id: string
  value: 1 | -1
  weight: number
  reason?: string | null
  reason_code?: ProposalVoteReasonCode | null
}

export interface ProposalRejectionReasonSummary {
  code: ProposalVoteReasonCode
  label: string
  count: number
  reason: string | null
}

export interface ProposalVoteTotals {
  approvals: number
  rejections: number
  weightedApprovals: number
  weightedRejections: number
  weightedScore: number
}

export interface ProposalPayload {
  title?: string
  song_id?: string
  artist_name?: string
  artist_id?: string
  artists?: Array<{ id?: string; name: string }>
  album_name?: string
  album_id?: string
  genre?: string | null
  bpm?: number | null
  year_released?: number | null
  spotify_id?: string | null
  spotify_url?: string | null
  credits?: Array<{ artist_id?: string; artist_name: string; role: string }>
  playlist_id?: string
  playlist_name?: string
  position?: number | null
  canonical_song_id?: string
  candidate_song_ids?: string[]
  field_mappings?: Record<string, string>
}

export interface Proposal {
  id: string
  type: ProposalType
  target_song_id: string | null
  proposer_id: string
  status: ProposalStatus
  reason: string
  payload: ProposalPayload
  original_snapshot: Record<string, unknown> | null
  diff: ProposalDiffEntry[]
  canonical_song_id: string | null
  metadata: Record<string, unknown>
  reputation_delta: number
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
  voteTotals: ProposalVoteTotals
  currentUserVote: ProposalVote | null
  reportCount: number
  rejectionReasons: ProposalRejectionReasonSummary[]
}

export interface ProposalReport {
  id: string
  proposal_id: string
  reporter_id: string
  category: string
  details: string
  status: string
  created_at: string
  proposal?: Proposal | null
}

export interface SubmitProposalResult {
  proposal: Proposal
  candidateMatches: CandidateMatch[]
  needsConfirmation: false
}

export interface ProposalReviewFeed {
  proposals: Proposal[]
  totalPendingCount: number
  availableCount: number
  nextOffset: number | null
  hasMore: boolean
}