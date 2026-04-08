import * as spotify from './spotify.js'

export function extractTempoFromAudioFeatures(af: any): number | null {
  if (!af) return null
  if (typeof af.tempo === 'number') return af.tempo
  if (af?.body && typeof af.body.tempo === 'number') return af.body.tempo
  if (af?.audio_features && typeof af.audio_features.tempo === 'number') return af.audio_features.tempo
  if (af?.audio_features?.body && typeof af.audio_features.body.tempo === 'number') return af.audio_features.body.tempo
  return null
}

export async function fetchReccoBeatsTempo(trackId: string): Promise<number | null> {
  try {
    const rbRes = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${encodeURIComponent(trackId)}`)
    if (!rbRes.ok) return null
    const rbJson: any = await rbRes.json()
    const content = rbJson?.content
    if (!Array.isArray(content) || content.length === 0) return null
    const found = content.find((c: any) => {
      if (typeof c?.href === 'string') return c.href.includes(`/track/${trackId}`)
      if (typeof c?.id === 'string') return c.id === trackId
      return false
    }) || content[0]
    if (found && typeof found.tempo === 'number') return found.tempo
    return null
  } catch (err) {
    console.error('ReccoBeats tempo fetch failed:', err)
    return null
  }
}

export async function determineTrackTempo(trackId: string, accessToken?: string): Promise<number | null> {
  // Try Spotify audio features first when access token available
  if (accessToken) {
    try {
      const audioFeatures = await spotify.getTrackAudioFeatures(trackId, accessToken).catch(() => null)
      const tempo = extractTempoFromAudioFeatures(audioFeatures)
      if (tempo !== null) return tempo
    } catch (e) {
      // ignore
    }
  }

  // Fallback to ReccoBeats
  return await fetchReccoBeatsTempo(trackId)
}
