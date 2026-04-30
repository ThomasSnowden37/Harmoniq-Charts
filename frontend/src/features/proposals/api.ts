import type {
  Proposal,
  ProposalPayload,
  ProposalReport,
  ProposalReviewFeed,
  ProposalType,
  ProposalVoteReasonCode,
  SubmitProposalResult,
  CandidateMatch,
} from './types'

type RequestOptions = {
  method?: string
  userId?: string | null
  body?: unknown
}

type QueryFilters = Record<string, string | undefined>

export class ProposalApiError extends Error {
  status: number
  candidateMatches?: CandidateMatch[]
  needsConfirmation?: boolean

  constructor(message: string, status: number, options?: { candidateMatches?: CandidateMatch[]; needsConfirmation?: boolean }) {
    super(message)
    this.name = 'ProposalApiError'
    this.status = status
    this.candidateMatches = options?.candidateMatches
    this.needsConfirmation = options?.needsConfirmation
  }
}

function buildQuery(filters?: QueryFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.userId) {
    headers['x-user-id'] = options.userId
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ProposalApiError(data.error ?? 'Request failed', response.status, {
      candidateMatches: data.candidateMatches,
      needsConfirmation: data.needsConfirmation,
    })
  }

  return data as T
}

export async function submitProposal(input: {
  userId: string
  type: ProposalType
  reason: string
  payload: ProposalPayload
  targetSongId?: string | null
  canonicalSongId?: string | null
  ignoreMatches?: boolean
}): Promise<SubmitProposalResult> {
  return request<SubmitProposalResult>('/api/proposals', {
    method: 'POST',
    userId: input.userId,
    body: {
      type: input.type,
      reason: input.reason,
      payload: input.payload,
      target_song_id: input.targetSongId ?? null,
      canonical_song_id: input.canonicalSongId ?? null,
      ignore_matches: input.ignoreMatches ?? false,
    },
  })
}

export async function fetchProposalFeed(filters?: QueryFilters, userId?: string | null): Promise<Proposal[]> {
  return request<Proposal[]>(`/api/proposals${buildQuery(filters)}`, { userId })
}

export async function fetchProposalReviewFeed(filters?: QueryFilters, userId?: string | null): Promise<ProposalReviewFeed> {
  return request<ProposalReviewFeed>(`/api/proposals/review-feed${buildQuery(filters)}`, { userId })
}

export async function fetchUserProposals(userId: string, viewerId?: string | null): Promise<Proposal[]> {
  return request<Proposal[]>(`/api/users/${userId}/proposals`, { userId: viewerId })
}

export async function voteOnProposal(
  proposalId: string,
  userId: string,
  value: 1 | -1,
  options?: { reason?: string; reasonCode?: ProposalVoteReasonCode | null },
): Promise<Proposal> {
  return request<Proposal>(`/api/proposals/${proposalId}/vote`, {
    method: 'POST',
    userId,
    body: {
      value,
      reason: options?.reason,
      reason_code: options?.reasonCode ?? null,
    },
  })
}

export async function reportProposal(proposalId: string, userId: string, category: string, details: string): Promise<void> {
  await request(`/api/proposals/${proposalId}/report`, {
    method: 'POST',
    userId,
    body: { category, details },
  })
}

export async function fetchAdminQueue(userId: string, filters?: QueryFilters): Promise<Proposal[]> {
  return request<Proposal[]>(`/api/admin/queue${buildQuery(filters)}`, { userId })
}

export async function fetchAdminReports(userId: string, status?: string): Promise<ProposalReport[]> {
  return request<ProposalReport[]>(`/api/admin/reports${buildQuery({ status })}`, { userId })
}

export async function runAdminProposalAction(
  proposalId: string,
  action: 'approve' | 'reject' | 'merge' | 'revert',
  userId: string,
  reason: string,
): Promise<Proposal> {
  return request<Proposal>(`/api/admin/proposals/${proposalId}/${action}`, {
    method: 'POST',
    userId,
    body: { reason },
  })
}