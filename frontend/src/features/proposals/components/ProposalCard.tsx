import { useMemo, useState } from 'react'
import { Badge, Button, Card, Dialog, Flex, Text } from '@radix-ui/themes'
import { Check, ExternalLink, Flag, GitMerge, Sparkles, Undo2, X } from 'lucide-react'
import { runAdminProposalAction, voteOnProposal } from '../api'
import type { Proposal, ProposalPayload, ProposalVoteReasonCode } from '../types'
import ReportProposalModal from './ReportProposalModal'

interface ProposalCardProps {
  proposal: Proposal
  currentUserId?: string | null
  showVoting?: boolean
  showAdminActions?: boolean
  showReportAction?: boolean
  onUpdated?: (proposal: Proposal) => void
  onReviewed?: (proposal: Proposal) => void
}

function typeLabel(type: Proposal['type']): string {
  if (type === 'song_add') return 'Song Suggestion'
  if (type === 'song_edit') return 'Edit Suggestion'
  if (type === 'song_merge') return 'Merge Suggestion'
  if (type === 'artist_link_spotify') return 'Artist Edit Suggestion'
  if (type === 'album_link_spotify') return 'Album Edit Suggestion'
  return 'Playlist Song Add'
}

function statusTone(status: Proposal['status']): 'gray' | 'green' | 'red' | 'orange' | 'blue' {
  if (status === 'approved' || status === 'merged') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'reverted') return 'orange'
  return 'blue'
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty'
  if (Array.isArray(value)) {
    const parts = value.map((entry) => stringifyValue(entry)).filter((entry) => entry !== 'empty')
    return parts.length > 0 ? parts.join(' • ') : 'empty'
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const name = typeof record.name === 'string'
      ? record.name
      : typeof record.artist_name === 'string'
        ? record.artist_name
        : null
    const role = typeof record.role === 'string' ? record.role : null
    if (name && role) return `${name} (${role})`
    if (name) return name
    return JSON.stringify(value)
  }
  return String(value)
}

function diffFieldLabel(field: string): string {
  if (field === 'album_name') return 'Album'
  if (field === 'artist_name') return 'Artist'
  if (field === 'artists') return 'Artists'
  if (field === 'bpm') return 'BPM'
  if (field === 'candidate_song_ids') return 'Candidates'
  if (field === 'canonical_song_id') return 'Canonical song'
  if (field === 'credits') return 'Credits'
  if (field === 'field_mappings') return 'Field mapping'
  if (field === 'genre') return 'Genre'
  if (field === 'position') return 'Position'
  if (field === 'song') return 'Song'
  if (field === 'spotify_id') return 'Spotify'
  if (field === 'title') return 'Title'
  if (field === 'year_released') return 'Year'
  return field.replace(/_/g, ' ')
}

function spotifyUrl(type: 'track' | 'artist' | 'album', id: string): string {
  return `https://open.spotify.com/${type}/${encodeURIComponent(id)}`
}

function proposalSpotifyLink(proposal: Proposal): { label: string; href: string } | null {
  const spotifyId = typeof proposal.payload.spotify_id === 'string' ? proposal.payload.spotify_id.trim() : ''
  if (!spotifyId) return null

  if (proposal.type === 'artist_link_spotify') {
    return { label: 'Open Spotify artist', href: spotifyUrl('artist', spotifyId) }
  }

  if (proposal.type === 'album_link_spotify') {
    return { label: 'Open Spotify album', href: spotifyUrl('album', spotifyId) }
  }

  return { label: 'Open Spotify track', href: spotifyUrl('track', spotifyId) }
}

function renderDiffValue(field: string, value: unknown, proposal: Proposal, tone: 'original' | 'proposed') {
  const text = stringifyValue(value)

  if (field === 'spotify_id' && typeof value === 'string' && value.trim()) {
    const spotifyLink = proposalSpotifyLink({
      ...proposal,
      payload: {
        ...proposal.payload,
        spotify_id: value.trim(),
      },
    })

    if (spotifyLink) {
      return (
        <a
          href={spotifyLink.href}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1 break-all no-underline ${tone === 'original' ? 'text-red-100/85 hover:text-red-50' : 'text-emerald-100 hover:text-emerald-50'}`}
        >
          <span>{text}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      )
    }
  }

  return <span className="break-words">{text}</span>
}

function payloadArtistNames(payload: ProposalPayload): string[] {
  if (payload.artists && payload.artists.length > 0) {
    return payload.artists.map((artist) => artist.name).filter(Boolean)
  }

  return String(payload.artist_name ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function snapshotField(snapshot: Proposal['original_snapshot'], key: string): unknown {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined
  return (snapshot as Record<string, unknown>)[key]
}

function snapshotArtistNames(snapshot: Proposal['original_snapshot']): string[] {
  const raw = snapshotField(snapshot, 'artist_names')
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value ?? '').trim()).filter(Boolean)
  }

  if (typeof raw === 'string') {
    return raw.split(',').map((value) => value.trim()).filter(Boolean)
  }

  return []
}

function proposalHeadline(proposal: Proposal): { title: string; artists: string; details: string[]; href: string | null } {
  if (proposal.type === 'artist_link_spotify') {
    return {
      title: proposal.payload.artist_name || 'Artist Spotify link',
      artists: 'Artist profile edit',
      details: [],
      href: proposal.payload.artist_id ? `/artists/${proposal.payload.artist_id}` : null,
    }
  }

  if (proposal.type === 'album_link_spotify') {
    const artists = payloadArtistNames(proposal.payload)
    return {
      title: proposal.payload.album_name || 'Album Spotify link',
      artists: artists.join(', ') || 'Album metadata edit',
      details: [],
      href: proposal.payload.album_id ? `/albums/${proposal.payload.album_id}` : null,
    }
  }

  if (proposal.type === 'playlist_song_add') {
    return {
      title: proposal.payload.title || 'Playlist song addition',
      artists: proposal.payload.artist_name || 'Choose a song and position',
      details: [proposal.payload.position != null ? `Position ${proposal.payload.position}` : null].filter(Boolean) as string[],
      href: proposal.payload.song_id ? `/songs/${proposal.payload.song_id}` : null,
    }
  }

  if (proposal.type === 'song_merge') {
    return {
      title: 'Merge candidate songs',
      artists: proposal.reason || 'Review canonical song choice and merged metadata.',
      details: proposal.canonical_song_id ? ['Canonical target selected'] : [],
      href: proposal.canonical_song_id ? `/songs/${proposal.canonical_song_id}` : null,
    }
  }

  const title = proposal.payload.title
    || String(snapshotField(proposal.original_snapshot, 'title') ?? '').trim()
    || 'Untitled song'
  const artists = payloadArtistNames(proposal.payload)
  const fallbackArtists = snapshotArtistNames(proposal.original_snapshot)
  const artistLabel = (artists.length > 0 ? artists : fallbackArtists).join(', ') || 'Unknown artist'
  const album = proposal.payload.album_name
    || String(snapshotField(proposal.original_snapshot, 'album_name') ?? '').trim()
  const year = proposal.payload.year_released ?? snapshotField(proposal.original_snapshot, 'year_released')
  const details = [album, year ? String(year) : null].filter(Boolean) as string[]

  return {
    title,
    artists: artistLabel,
    details,
    href: proposal.target_song_id ? `/songs/${proposal.target_song_id}` : null,
  }
}

function rejectionReasonRequiresText(code: ProposalVoteReasonCode | null): boolean {
  return code === 'other'
}

export default function ProposalCard({ proposal, currentUserId, showVoting = true, showAdminActions = false, showReportAction = true, onUpdated, onReviewed }: ProposalCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState(proposal.currentUserVote?.value === -1 ? proposal.currentUserVote.reason ?? '' : '')
  const [rejectReasonCode, setRejectReasonCode] = useState<ProposalVoteReasonCode | null>(proposal.currentUserVote?.value === -1 ? proposal.currentUserVote.reason_code ?? null : null)

  const canVote = Boolean(currentUserId && showVoting && proposal.status === 'pending' && proposal.proposer_id !== currentUserId)
  const summary = useMemo(() => proposalHeadline(proposal), [proposal])
  const spotifyLink = useMemo(() => proposalSpotifyLink(proposal), [proposal])
  const canSubmitReject = Boolean(
    rejectReason.trim() || (rejectReasonCode && !rejectionReasonRequiresText(rejectReasonCode)),
  )

  async function handleVote(value: 1 | -1, options?: { reason?: string; reasonCode?: ProposalVoteReasonCode | null }) {
    if (!currentUserId) return
    setLoadingAction(value > 0 ? 'approve-vote' : 'reject-vote')
    setError(null)

    try {
      const updated = await voteOnProposal(proposal.id, currentUserId, value, options)
      onUpdated?.(updated)
      onReviewed?.(updated)
      if (value === -1) {
        setRejectOpen(false)
      }
    } catch (voteError) {
      const message = voteError instanceof Error ? voteError.message : 'Failed to submit vote'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleAdminAction(action: 'approve' | 'reject' | 'merge' | 'revert') {
    if (!currentUserId) return
    const reason = window.prompt(`Reason for ${action}:`, proposal.reason) ?? ''
    if (!reason.trim()) return

    setLoadingAction(action)
    setError(null)

    try {
      const updated = await runAdminProposalAction(proposal.id, action, currentUserId, reason.trim())
      onUpdated?.(updated)
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Failed to update proposal'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <>
      <Card size="3" className="border border-border/70 bg-card/80 backdrop-blur-sm">
        <div className="space-y-4">
          <Flex justify="between" align="start" gap="3">
            <div className="min-w-0 flex-1">
              <Flex wrap="wrap" gap="2" align="center">
                <Badge color={statusTone(proposal.status)}>{proposal.status}</Badge>
                <Badge color="gray">{typeLabel(proposal.type)}</Badge>
              </Flex>
              <div className="mt-3 min-w-0">
                {summary.href ? (
                  <a href={summary.href} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-foreground no-underline hover:text-primary">
                    <span className="truncate">{summary.title}</span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                ) : (
                  <Text weight="bold" className="block truncate text-foreground">{summary.title}</Text>
                )}
                <Text size="2" color="gray" className="mt-1 block truncate">{summary.artists}</Text>
                {summary.details.length > 0 && (
                  <Text size="1" color="gray" className="mt-1 block uppercase tracking-[0.18em]">
                    {summary.details.join(' • ')}
                  </Text>
                )}
                {proposal.reason && (
                  <Text size="2" color="gray" className="mt-2 block leading-6">
                    {proposal.reason}
                  </Text>
                )}
              </div>
              <Text size="2" color="gray" className="block mt-1">
                Submitted {new Date(proposal.created_at).toLocaleString()}
              </Text>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-right min-w-36 shrink-0">
              <Text size="1" color="gray" className="block">Weighted score</Text>
              <Text weight="bold" className="block text-foreground">{proposal.voteTotals.weightedScore.toFixed(2)}</Text>
              <Text size="1" color="gray" className="block mt-1">
                +{proposal.voteTotals.weightedApprovals.toFixed(2)} / -{proposal.voteTotals.weightedRejections.toFixed(2)}
              </Text>
            </div>
          </Flex>

          {error && <Text color="red" size="2">{error}</Text>}

          <div className="rounded-2xl border border-border/60 bg-background/55 px-3 py-3">
            {proposal.diff.length === 0 ? (
              <Text size="2" color="gray">No field diff was captured for this proposal.</Text>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card/65">
                <div className="hidden grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)] gap-px border-b border-border/50 bg-border/50 md:grid">
                  <div className="bg-background/70 px-3 py-2">
                    <Text size="1" className="uppercase tracking-[0.18em] text-muted-foreground">Field</Text>
                  </div>
                  <div className="bg-red-500/5 px-3 py-2">
                    <Text size="1" className="font-mono uppercase tracking-[0.18em] text-red-300">- was</Text>
                  </div>
                  <div className="bg-emerald-500/5 px-3 py-2">
                    <Text size="1" className="font-mono uppercase tracking-[0.18em] text-emerald-300">+ proposed</Text>
                  </div>
                </div>

                <div className="divide-y divide-border/50">
                  {proposal.diff.map((entry) => (
                    <div
                      key={`${proposal.id}-${entry.field}-preview`}
                      className="grid gap-px bg-border/50 md:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <div className="bg-background/70 px-3 py-2.5">
                        <Text size="1" className="block uppercase tracking-[0.18em] text-muted-foreground md:hidden">Field</Text>
                        <Text size="2" weight="medium" className="block text-foreground">{diffFieldLabel(entry.field)}</Text>
                      </div>
                      <div className="bg-red-500/5 px-3 py-2.5">
                        <Text size="1" className="font-mono uppercase tracking-[0.16em] text-red-300 md:hidden">- was</Text>
                        <Text size="2" className="block whitespace-pre-wrap font-mono text-red-100/85">
                          {renderDiffValue(entry.field, entry.original, proposal, 'original')}
                        </Text>
                      </div>
                      <div className="bg-emerald-500/5 px-3 py-2.5">
                        <Text size="1" className="font-mono uppercase tracking-[0.16em] text-emerald-300 md:hidden">+ proposed</Text>
                        <Text size="2" className="block whitespace-pre-wrap font-mono text-emerald-100">
                          {renderDiffValue(entry.field, entry.proposed, proposal, 'proposed')}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Flex wrap="wrap" gap="2" align="center" justify="between">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{proposal.voteTotals.approvals} approvals</span>
              <span>{proposal.voteTotals.rejections} rejections</span>
              <span>{proposal.reportCount} reports</span>
              {proposal.currentUserVote && (
                <span>
                  Your vote: {proposal.currentUserVote.value > 0 ? 'approve' : 'reject'} ({proposal.currentUserVote.weight.toFixed(2)})
                </span>
              )}
              {proposal.proposer_id === currentUserId && proposal.status === 'pending' && (
                <span>You cannot vote on your own contribution</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canVote && (
                <>
                  <Button variant={proposal.currentUserVote?.value === 1 ? 'solid' : 'soft'} onClick={() => handleVote(1)} disabled={Boolean(loadingAction)}>
                    <Check className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button variant={proposal.currentUserVote?.value === -1 ? 'solid' : 'soft'} color="red" onClick={() => setRejectOpen(true)} disabled={Boolean(loadingAction)}>
                    <X className="w-4 h-4" />
                    Reject
                  </Button>
                </>
              )}

              {!showAdminActions && showReportAction && currentUserId && (
                <Button variant="ghost" color="gray" onClick={() => setReportOpen(true)}>
                  <Flag className="w-4 h-4" />
                  Report
                </Button>
              )}

              {showAdminActions && currentUserId && proposal.type !== 'song_merge' && proposal.status === 'pending' && (
                <>
                  <Button color="green" onClick={() => handleAdminAction('approve')} disabled={Boolean(loadingAction)}>
                    <Sparkles className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button color="red" variant="soft" onClick={() => handleAdminAction('reject')} disabled={Boolean(loadingAction)}>
                    <X className="w-4 h-4" />
                    Reject
                  </Button>
                </>
              )}

              {showAdminActions && currentUserId && proposal.type === 'song_merge' && (proposal.status === 'pending' || proposal.status === 'approved') && (
                <>
                  <Button color="green" onClick={() => handleAdminAction('merge')} disabled={Boolean(loadingAction)}>
                    <GitMerge className="w-4 h-4" />
                    Execute Merge
                  </Button>
                  <Button color="red" variant="soft" onClick={() => handleAdminAction('reject')} disabled={Boolean(loadingAction)}>
                    <X className="w-4 h-4" />
                    Reject
                  </Button>
                </>
              )}

              {showAdminActions && currentUserId && (proposal.status === 'approved' || proposal.status === 'merged') && (
                <Button color="orange" variant="soft" onClick={() => handleAdminAction('revert')} disabled={Boolean(loadingAction)}>
                  <Undo2 className="w-4 h-4" />
                  Revert
                </Button>
              )}
            </div>
          </Flex>
        </div>
      </Card>

      {canVote && (
        <Dialog.Root open={rejectOpen} onOpenChange={setRejectOpen}>
          <Dialog.Content maxWidth="560px">
            <Dialog.Title>Reject contribution</Dialog.Title>
            <Dialog.Description size="2" color="gray">
              Rejections need a reason. You can agree with an existing rejection reason or write your own.
            </Dialog.Description>

            <div className="mt-4 space-y-4">
              {proposal.rejectionReasons.length > 0 && (
                <div className="space-y-2">
                  <Text size="2" weight="medium">Existing rejection reasons</Text>
                  <div className="flex flex-wrap gap-2">
                    {proposal.rejectionReasons.map((entry) => (
                      <button
                        key={`${proposal.id}-${entry.code}`}
                        type="button"
                        onClick={() => {
                          setRejectReasonCode(entry.code)
                          if (!rejectReason.trim() && entry.reason) {
                            setRejectReason(entry.reason)
                          }
                        }}
                        className={`rounded-full border px-3 py-1.5 text-left text-sm transition-colors ${rejectReasonCode === entry.code ? 'border-red-400 bg-red-500/10 text-red-200' : 'border-border/70 bg-card/70 text-foreground hover:bg-card'}`}
                      >
                        {entry.label} ({entry.count})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="block space-y-2">
                <Text size="2" weight="medium">Reasoning</Text>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={4}
                  placeholder="Explain what should change before this contribution can be accepted."
                  className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground"
                />
              </label>
            </div>

            <Flex justify="end" gap="2" mt="4">
              <Button variant="soft" color="gray" onClick={() => setRejectOpen(false)} disabled={Boolean(loadingAction)}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => handleVote(-1, { reason: rejectReason, reasonCode: rejectReasonCode })}
                disabled={Boolean(loadingAction) || !canSubmitReject}
              >
                {loadingAction === 'reject-vote' ? 'Submitting...' : 'Submit rejection'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {currentUserId && (
        <ReportProposalModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          proposalId={proposal.id}
          userId={currentUserId}
        />
      )}
    </>
  )
}