import { useEffect, useState } from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { ProposalApiError, submitProposal } from '../api'
import SongContributorEditor, {
  SONG_FORM_LIMITS,
  artistNamesText,
  serializeProposalArtists,
  type ArtistSelection,
} from '../../songs/components/SongContributorEditor'
import { InlineSpotifyPicker } from '../../spotify/components/InlineSpotifyPicker'
import type { SpotifyLookupItem } from '../../spotify/types'
import ProposalThanksDialog from './ProposalThanksDialog'

const EMPTY_ARTISTS: ArtistSelection[] = []

type EntityType = 'artist' | 'album'

interface LinkSpotifyEntityProposalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId?: string | null
  entityType: EntityType
  entityId: string
  entityName: string
  currentSpotifyId?: string | null
  currentArtists?: ArtistSelection[]
  onSubmitted?: () => void
}

function inputClassName(changed: boolean): string {
  return `w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition ${changed
    ? 'border-amber-400/80 bg-amber-400/5 ring-1 ring-amber-300/25 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/35'
    : 'border-border focus:border-sky-300/50 focus:ring-2 focus:ring-sky-300/20'}`
}

function sectionClassName(changed: boolean): string {
  return `rounded-2xl border p-3 transition ${changed
    ? 'border-amber-400/80 bg-amber-400/5 ring-1 ring-amber-300/20'
    : 'border-border/70 bg-background/35'}`
}

function sameSerializedValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export default function LinkSpotifyEntityProposalModal({
  open,
  onOpenChange,
  currentUserId,
  entityType,
  entityId,
  entityName,
  currentSpotifyId,
  currentArtists = EMPTY_ARTISTS,
  onSubmitted,
}: LinkSpotifyEntityProposalModalProps) {
  const [name, setName] = useState(entityName)
  const [artists, setArtists] = useState<ArtistSelection[]>(currentArtists)
  const [spotifySelection, setSpotifySelection] = useState<SpotifyLookupItem | null | undefined>(undefined)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanksOpen, setThanksOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(entityName)
    setArtists([...currentArtists])
    setSpotifySelection(undefined)
    setReason('')
    setSubmitting(false)
    setError(null)
    setThanksOpen(false)
  }, [open, entityName, currentSpotifyId])

  const spotifyId = spotifySelection === undefined ? (currentSpotifyId ?? '') : (spotifySelection?.id ?? '')
  const trimmedName = name.trim().slice(0, entityType === 'artist' ? SONG_FORM_LIMITS.artistName : SONG_FORM_LIMITS.album)
  const currentArtistsValue = serializeProposalArtists(artists)
  const originalArtistsValue = serializeProposalArtists(currentArtists)
  const nameChanged = trimmedName !== entityName.trim()
  const artistsChanged = entityType === 'album' && !sameSerializedValue(currentArtistsValue, originalArtistsValue)
  const spotifyChanged = spotifyId !== (currentSpotifyId ?? '')
  const canSubmit = entityType === 'artist'
    ? Boolean(currentUserId && trimmedName && spotifyId)
    : Boolean(currentUserId && trimmedName && artists.length > 0 && spotifyId)

  const handleSubmit = async () => {
    if (!currentUserId) {
      setError('Sign in to submit a contribution')
      return
    }

    if (!trimmedName) {
      setError(entityType === 'artist' ? 'Artist name is required' : 'Album title is required')
      return
    }

    if (entityType === 'album' && artists.length === 0) {
      setError('Add at least one artist for the album')
      return
    }

    if (!spotifyId) {
      setError(`Enter a Spotify ${entityType} id or ${entityType} URL`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await submitProposal({
        userId: currentUserId,
        type: entityType === 'artist' ? 'artist_link_spotify' : 'album_link_spotify',
        reason: reason.trim(),
        payload: entityType === 'artist'
          ? { artist_id: entityId, artist_name: trimmedName, spotify_id: spotifyId }
          : {
              album_id: entityId,
              album_name: trimmedName,
              artist_name: artistNamesText(artists),
              artists: currentArtistsValue,
              spotify_id: spotifyId,
            },
      })

      onSubmitted?.()
      onOpenChange(false)
      setThanksOpen(true)
    } catch (err) {
      if (err instanceof ProposalApiError) {
        setError(err.message)
      } else {
        setError('Failed to submit contribution')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="780px">
          <div className="flex items-center justify-between">
            <Dialog.Title mb="0">Suggest an edit</Dialog.Title>
            <Dialog.Close>
              <button className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <Text size="2" color="gray">
              This creates a proposal only. The live record will not change until the suggestion is approved.
            </Text>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <Text size="2" weight="medium">{entityType === 'artist' ? 'Artist name' : 'Album title'}</Text>
                <input
                  value={name}
                  maxLength={entityType === 'artist' ? SONG_FORM_LIMITS.artistName : SONG_FORM_LIMITS.album}
                  onChange={(event) => setName(event.target.value.slice(0, entityType === 'artist' ? SONG_FORM_LIMITS.artistName : SONG_FORM_LIMITS.album))}
                  className={inputClassName(nameChanged)}
                />
              </label>

              <div className="space-y-1">
                <div className={sectionClassName(spotifyChanged)}>
                  <InlineSpotifyPicker
                    entityType={entityType}
                    userId={currentUserId}
                    value={spotifySelection ?? null}
                    onChange={setSpotifySelection}
                    currentSpotifyId={currentSpotifyId ?? null}
                    resolveCurrentFromId={spotifySelection === undefined}
                    label={`Spotify ${entityType}`}
                    description={`Search Spotify inline or paste a Spotify ${entityType} link or ID.`}
                    placeholder={entityType === 'artist' ? 'Search Spotify artists or paste a link' : 'Search Spotify albums or paste a link'}
                    suggestedQuery={entityType === 'artist' ? trimmedName : [trimmedName, artistNamesText(artists)].filter(Boolean).join(' ')}
                  />
                </div>
              </div>

              {entityType === 'album' && (
                <div className="md:col-span-2">
                  <div className={sectionClassName(Boolean(artistsChanged))}>
                    <SongContributorEditor
                      compact
                      artists={artists}
                      onArtistsChange={setArtists}
                      credits={[]}
                      onCreditsChange={() => undefined}
                      showCredits={false}
                    />
                  </div>
                </div>
              )}
            </div>

            <label className="block space-y-1">
              <Text size="2" weight="medium">Reasoning / sources (optional)</Text>
              <textarea
                value={reason}
                maxLength={SONG_FORM_LIMITS.reason}
                onChange={(event) => setReason(event.target.value.slice(0, SONG_FORM_LIMITS.reason))}
                rows={4}
                placeholder="Add context for reviewers if it helps."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-sky-300/50 focus:ring-2 focus:ring-sky-300/20"
              />
            </label>

            {spotifyId ? <Text size="1" color="gray">Selected Spotify id: {spotifyId}</Text> : null}
            {error ? <Text color="red" size="2">{error}</Text> : null}

            <Flex justify="end" gap="2">
              <Button variant="soft" color="gray" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
                {submitting ? 'Submitting...' : 'Submit suggestion'}
              </Button>
            </Flex>
          </div>
        </Dialog.Content>
      </Dialog.Root>

      <ProposalThanksDialog
        open={thanksOpen}
        onOpenChange={setThanksOpen}
        description={entityType === 'artist'
          ? 'Your artist edit proposal was submitted. Reviewers can compare it and vote on whether it should go live.'
          : 'Your album edit proposal was submitted. Reviewers can compare it and vote on whether it should go live.'}
      />
    </>
  )
}