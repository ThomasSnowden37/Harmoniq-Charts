import { useEffect, useState } from 'react'
import { Text } from '@radix-ui/themes'
import { Disc3, ExternalLink, Loader2, Mic2, Music2, Search, Unlink2 } from 'lucide-react'
import type { SpotifyEntitySearchResult, SpotifyEntityType, SpotifyLookupItem } from '../types'

interface InlineSpotifyPickerProps {
  entityType: SpotifyEntityType
  userId?: string | null
  value: SpotifyLookupItem | null
  onChange: (item: SpotifyLookupItem | null) => void
  currentSpotifyId?: string | null
  resolveCurrentFromId?: boolean
  label: string
  description: string
  placeholder: string
  suggestedQuery?: string
  disabled?: boolean
}

function entityIcon(entityType: SpotifyEntityType) {
  if (entityType === 'artist') return Mic2
  if (entityType === 'album') return Disc3
  return Music2
}

export function InlineSpotifyPicker({
  entityType,
  userId,
  value,
  onChange,
  currentSpotifyId,
  resolveCurrentFromId = false,
  label,
  description,
  placeholder,
  suggestedQuery,
  disabled = false,
}: InlineSpotifyPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyLookupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [resolvedCurrent, setResolvedCurrent] = useState<SpotifyLookupItem | null>(null)

  const selectedItem = value ?? resolvedCurrent
  const Icon = entityIcon(entityType)

  useEffect(() => {
    if (!suggestedQuery || query.trim() || selectedItem) return
    setQuery(suggestedQuery)
  }, [suggestedQuery, query, selectedItem])

  useEffect(() => {
    let cancelled = false

    async function loadCurrentItem() {
      if (!currentSpotifyId || value || disabled || !resolveCurrentFromId) {
        if (!value) {
          setResolvedCurrent(null)
        }
        return
      }

      try {
        const response = await fetch(`/api/spotify/entities/${entityType}/${currentSpotifyId}`, {
          headers: userId ? { 'x-user-id': userId } : undefined,
        })

        if (!response.ok) {
          throw new Error('Failed to load Spotify entity')
        }

        const item = await response.json() as SpotifyLookupItem
        if (!cancelled) {
          setResolvedCurrent(item)
        }
      } catch {
        if (!cancelled) {
          setResolvedCurrent(null)
        }
      }
    }

    void loadCurrentItem()

    return () => {
      cancelled = true
    }
  }, [currentSpotifyId, entityType, userId, value, disabled, resolveCurrentFromId])

  useEffect(() => {
    if (value) {
      setResolvedCurrent(value)
    }
  }, [value])

  useEffect(() => {
    let cancelled = false
    const trimmedQuery = query.trim()

    if (!menuOpen || disabled || trimmedQuery.length < 2) {
      setResults([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/spotify/search/entities?type=${entityType}&q=${encodeURIComponent(trimmedQuery)}&limit=6`,
          { headers: userId ? { 'x-user-id': userId } : undefined },
        )

        if (!response.ok) {
          throw new Error('Spotify search failed')
        }

        const data = await response.json() as SpotifyEntitySearchResult
        if (!cancelled) {
          setResults(data.items ?? [])
        }
      } catch {
        if (!cancelled) {
          setResults([])
          setError('Failed to search Spotify right now.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query, entityType, userId, menuOpen, disabled])

  function selectItem(item: SpotifyLookupItem) {
    setResolvedCurrent(item)
    onChange(item)
    setQuery(item.name)
    setMenuOpen(false)
    setResults([])
    setError(null)
  }

  function clearItem() {
    setResolvedCurrent(null)
    onChange(null)
    setQuery('')
    setResults([])
    setError(null)
  }

  return (
    <div className="space-y-2">
      <div>
        <Text size="2" weight="medium">{label}</Text>
        <Text size="1" color="gray" className="mt-1 block">
          {description}
        </Text>
      </div>

      <div className="relative">
        <div className="flex items-center rounded-2xl border border-border bg-background px-3 py-2.5">
          <Search className="mr-2 h-4 w-4 text-foreground/50" />
          <input
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value)
              setMenuOpen(true)
            }}
            onFocus={() => setMenuOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setMenuOpen(false), 120)
            }}
            className="w-full bg-transparent text-sm text-foreground outline-none"
            placeholder={placeholder}
          />
          {selectedItem && (
            <span className="mr-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
              linked
            </span>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />}
        </div>

        {menuOpen && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 rounded-2xl border border-border bg-card p-2 shadow-xl">
            {results.map((item) => {
              const ResultIcon = entityIcon(item.type)
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => selectItem(item)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-background"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-secondary/60">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ResultIcon className="h-4 w-4 text-foreground/60" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.name}</div>
                    <div className="truncate text-xs text-foreground/60">{item.subtitle || 'Spotify result'}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-foreground/45">spotify</span>
                </button>
              )
            })}

            {!loading && !error && results.length === 0 && (
              <div className="rounded-xl px-3 py-2 text-sm text-foreground/60">
                No matches found.
              </div>
            )}

            {error && (
              <div className="rounded-xl px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedItem ? (
        <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-secondary/70">
                {selectedItem.image_url ? (
                  <img src={selectedItem.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon className="h-4 w-4 text-foreground/60" />
                )}
              </div>
              <div className="min-w-0">
                <Text weight="medium" className="block truncate text-foreground">{selectedItem.name}</Text>
                <Text size="2" color="gray" className="mt-1 block truncate">
                  {selectedItem.subtitle || 'Spotify selection'}
                </Text>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedItem.spotify_url && (
                <a
                  href={selectedItem.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 px-2.5 py-1 text-xs text-emerald-200 transition hover:border-emerald-400/40 hover:text-emerald-100"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
              )}
              <button
                type="button"
                onClick={clearItem}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground/70 transition hover:bg-secondary"
              >
                <Unlink2 className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
          Search Spotify inline or paste a Spotify link or ID.
        </div>
      )}
    </div>
  )
}
