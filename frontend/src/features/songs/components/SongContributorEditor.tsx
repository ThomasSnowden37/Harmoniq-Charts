import { useEffect, useState } from 'react'
import { Button, Flex, Text } from '@radix-ui/themes'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

type ArtistOption = {
  id: string
  name: string
}

export type ArtistSelection = {
  id?: string
  name: string
}

export type SongCreditDraft = {
  artist: ArtistSelection | null
  role: string
}

export const SONG_FORM_LIMITS = {
  title: 180,
  album: 180,
  genre: 80,
  reason: 1200,
  artistName: 120,
  artistCount: 100,
  creditCount: 100,
  creditRole: 80,
  bpm: 400,
  year: 3000,
} as const

function normalizedArtistName(value: string): string {
  return value.trim().toLowerCase()
}

function isSameArtist(left: ArtistSelection, right: ArtistSelection): boolean {
  if (left.id && right.id) {
    return left.id === right.id
  }

  return normalizedArtistName(left.name) === normalizedArtistName(right.name)
}

function normalizeArtistSelection(value: ArtistSelection | null): ArtistSelection | null {
  if (!value) return null

  const name = value.name.trim().slice(0, SONG_FORM_LIMITS.artistName)
  if (!name) return null

  return value.id ? { id: value.id, name } : { name }
}

export function serializeProposalArtists(artists: ArtistSelection[]): Array<{ id?: string; name: string }> {
  return artists
    .map((artist) => normalizeArtistSelection(artist))
    .filter((artist): artist is ArtistSelection => Boolean(artist))
}

export function serializeProposalCredits(credits: SongCreditDraft[]): Array<{ artist_id?: string; artist_name: string; role: string }> {
  return credits
    .map((credit) => {
      const artist = normalizeArtistSelection(credit.artist)
      const role = credit.role.trim().slice(0, SONG_FORM_LIMITS.creditRole)
      if (!artist || !role) return null

      return artist.id
        ? { artist_id: artist.id, artist_name: artist.name, role }
        : { artist_name: artist.name, role }
    })
    .filter((credit): credit is { artist_id?: string; artist_name: string; role: string } => Boolean(credit))
}

export function artistNamesText(artists: ArtistSelection[]): string {
  return serializeProposalArtists(artists).map((artist) => artist.name).join(', ')
}

type ArtistLookupInputProps = {
  value: ArtistSelection | null
  onChange: (value: ArtistSelection | null) => void
  placeholder: string
  disabled?: boolean
  onResolve?: (artist: ArtistSelection) => void
}

function ArtistLookupInput({ value, onChange, placeholder, disabled = false, onResolve }: ArtistLookupInputProps) {
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([])
  const [artistMenuOpen, setArtistMenuOpen] = useState(false)
  const [artistLoading, setArtistLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const query = value?.name.trim() ?? ''

    if (query.length < 2) {
      setArtistOptions([])
      setArtistLoading(false)
      return () => {
        cancelled = true
      }
    }

    setArtistLoading(true)

    const timeoutId = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(6)

      if (cancelled) return

      if (error) {
        setArtistOptions([])
      } else {
        setArtistOptions((data ?? []) as ArtistOption[])
      }

      setArtistLoading(false)
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [value?.name])

  const query = value?.name ?? ''
  const trimmedQuery = query.trim().slice(0, SONG_FORM_LIMITS.artistName)
  const exactArtistMatch = artistOptions.some((option) => normalizedArtistName(option.name) === normalizedArtistName(trimmedQuery))

  function resolveArtist(nextArtist: ArtistSelection) {
    const normalized = normalizeArtistSelection(nextArtist)
    if (!normalized) return

    if (onResolve) {
      onResolve(normalized)
      onChange(null)
    } else {
      onChange(normalized)
    }

    setArtistMenuOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center rounded-2xl border border-border bg-background px-3 py-2.5">
        <Search className="mr-2 h-4 w-4 text-foreground/50" />
        <input
          value={query}
          disabled={disabled}
          maxLength={SONG_FORM_LIMITS.artistName}
          onChange={(event) => {
            const nextValue = event.target.value.slice(0, SONG_FORM_LIMITS.artistName)
            onChange(nextValue ? { name: nextValue } : null)
            setArtistMenuOpen(true)
          }}
          onFocus={() => setArtistMenuOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setArtistMenuOpen(false), 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && trimmedQuery) {
              event.preventDefault()
              resolveArtist(value?.id ? { id: value.id, name: trimmedQuery } : { name: trimmedQuery })
            }
          }}
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder={placeholder}
        />
        {value?.id && trimmedQuery && (
          <span className="mr-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
            linked
          </span>
        )}
        {artistLoading && <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />}
      </div>

      {artistMenuOpen && trimmedQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 rounded-2xl border border-border bg-card p-2 shadow-xl">
          {artistOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={() => resolveArtist({ id: option.id, name: option.name })}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-background"
            >
              <span>{option.name}</span>
              <span className="text-xs uppercase tracking-[0.22em] text-foreground/45">existing</span>
            </button>
          ))}

          {!exactArtistMatch && trimmedQuery && (
            <button
              type="button"
              onMouseDown={() => resolveArtist({ name: trimmedQuery })}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-400/10"
            >
              <span>Create &quot;{trimmedQuery}&quot; on approval</span>
              <span className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">new</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface SongContributorEditorProps {
  artists: ArtistSelection[]
  onArtistsChange: (artists: ArtistSelection[]) => void
  credits: SongCreditDraft[]
  onCreditsChange: (credits: SongCreditDraft[]) => void
  compact?: boolean
  showCredits?: boolean
}

export default function SongContributorEditor({ artists, onArtistsChange, credits, onCreditsChange, compact = false, showCredits = true }: SongContributorEditorProps) {
  const [artistDraft, setArtistDraft] = useState<ArtistSelection | null>(null)

  function addArtist(nextArtist: ArtistSelection) {
    const normalized = normalizeArtistSelection(nextArtist)
    if (!normalized) return
    if (artists.length >= SONG_FORM_LIMITS.artistCount) return
    if (artists.some((artist) => isSameArtist(artist, normalized))) {
      setArtistDraft(null)
      return
    }

    onArtistsChange([...artists, normalized])
    setArtistDraft(null)
  }

  function removeArtist(index: number) {
    onArtistsChange(artists.filter((_, currentIndex) => currentIndex !== index))
  }

  function updateCreditArtist(index: number, artist: ArtistSelection | null) {
    onCreditsChange(
      credits.map((credit, currentIndex) => (currentIndex === index ? { ...credit, artist } : credit)),
    )
  }

  function updateCreditRole(index: number, role: string) {
    onCreditsChange(
      credits.map((credit, currentIndex) => (
        currentIndex === index
          ? { ...credit, role: role.slice(0, SONG_FORM_LIMITS.creditRole) }
          : credit
      )),
    )
  }

  function addCreditRow() {
    if (credits.length >= SONG_FORM_LIMITS.creditCount) return
    onCreditsChange([...credits, { artist: null, role: '' }])
  }

  function removeCreditRow(index: number) {
    onCreditsChange(credits.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="space-y-2">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <div>
            <Text size="2" weight="medium">Artists</Text>
            <Text size="1" color="gray" className="mt-1 block">
              Add primary artists. New names are created only after approval.
            </Text>
          </div>
          <Text size="1" color="gray">{artists.length}/{SONG_FORM_LIMITS.artistCount}</Text>
        </Flex>

        {artists.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/55 p-3">
            {artists.map((artist, index) => (
              <span key={`${artist.id ?? artist.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-sm text-foreground shadow-sm">
                <span>{artist.name}</span>
                {artist.id && <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">id</span>}
                <button
                  type="button"
                  aria-label={`Remove ${artist.name}`}
                  onClick={() => removeArtist(index)}
                  className="rounded-full text-foreground/55 transition hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <Flex gap="2" align="start" wrap="wrap">
          <div className="min-w-[260px] flex-1">
            <ArtistLookupInput
              value={artistDraft}
              onChange={setArtistDraft}
              onResolve={addArtist}
              placeholder="Search artists or create a new one"
              disabled={artists.length >= SONG_FORM_LIMITS.artistCount}
            />
          </div>
          <Button
            type="button"
            variant="soft"
            disabled={!normalizeArtistSelection(artistDraft) || artists.length >= SONG_FORM_LIMITS.artistCount}
            onClick={() => {
              if (artistDraft) addArtist(artistDraft)
            }}
          >
            <Plus className="h-4 w-4" />
            Add artist
          </Button>
        </Flex>
      </div>

      {showCredits && (
        <div className="space-y-3">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <div>
            <Text size="2" weight="medium">Credits</Text>
            <Text size="1" color="gray" className="mt-1 block">
              Optional structured credits. Pair each artist with a plain-text role like Lyricist, Composer, Producer, or Recording Engineer.
            </Text>
          </div>
          <Flex gap="2" align="center">
            <Text size="1" color="gray">{credits.length}/{SONG_FORM_LIMITS.creditCount}</Text>
            <Button type="button" variant="soft" disabled={credits.length >= SONG_FORM_LIMITS.creditCount} onClick={addCreditRow}>
              <Plus className="h-4 w-4" />
              Add credit
            </Button>
          </Flex>
        </Flex>

        {credits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-4 text-sm text-muted-foreground">
            No credits added yet. Leave this blank if you do not know them.
          </div>
        ) : (
          <div className="space-y-3">
            {credits.map((credit, index) => (
              <div key={`credit-row-${index}`} className="rounded-2xl border border-border/70 bg-background/55 p-4">
                <Flex justify="between" align="center" gap="3" wrap="wrap">
                  <Text size="1" className="uppercase tracking-[0.24em] text-foreground/55">Credit {index + 1}</Text>
                  <button
                    type="button"
                    aria-label={`Remove credit ${index + 1}`}
                    onClick={() => removeCreditRow(index)}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-foreground/60 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </Flex>

                <div className="mt-3 grid gap-3 md:grid-cols-[1.25fr_0.8fr]">
                  <div className="space-y-1.5">
                    <Text size="2" weight="medium">Artist</Text>
                    <ArtistLookupInput
                      value={credit.artist}
                      onChange={(artist) => updateCreditArtist(index, artist)}
                      placeholder="Search artists or create a new one"
                    />
                  </div>

                  <label className="space-y-1.5">
                    <Text size="2" weight="medium">Role</Text>
                    <input
                      value={credit.role}
                      maxLength={SONG_FORM_LIMITS.creditRole}
                      onChange={(event) => updateCreditRole(index, event.target.value)}
                      className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      placeholder="Lyricist, Composer, Producer..."
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}
    </div>
  )
}