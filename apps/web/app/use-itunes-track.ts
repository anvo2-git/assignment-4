'use client'

import { useState, useEffect } from 'react'

export type ItunesTrack = {
  trackName: string
  artistName: string
  artworkUrl: string
  previewUrl: string
  trackViewUrl: string
}

function weatherMood(code: number | null): string {
  if (code === null) return 'chill'
  if (code === 0) return 'upbeat'
  if (code <= 3) return 'chill'
  if (code <= 48) return 'ambient'
  if (code <= 55) return 'indie'
  if (code <= 65) return 'rainy day'
  if (code <= 75) return 'acoustic'
  if (code <= 82) return 'lo-fi'
  if (code <= 86) return 'cozy'
  return 'intense'
}

// nationality adjectives for search terms — always queries the US store
// so results are artists FROM that country, not what's popular there
const NATIONALITY: Record<string, string> = {
  US: 'American', GB: 'British', JP: 'Japanese', FR: 'French',
  DE: 'German', IT: 'Italian', ES: 'Spanish', NL: 'Dutch',
  AU: 'Australian', CN: 'Chinese', IN: 'Indian', BR: 'Brazilian',
  MX: 'Mexican', CA: 'Canadian', AT: 'Austrian', RU: 'Russian',
  GR: 'Greek', TR: 'Turkish', KR: 'Korean', TH: 'Thai',
  SE: 'Swedish', NO: 'Norwegian', DK: 'Danish', PL: 'Polish',
  VN: 'Vietnamese', BE: 'Belgian', PT: 'Portuguese',
}

const trackCache = new Map<string, ItunesTrack[]>()
const pendingFetches = new Map<string, Promise<ItunesTrack[]>>()

async function fetchTracks(mood: string, countryCode: string): Promise<ItunesTrack[]> {
  const nationality = NATIONALITY[countryCode.toUpperCase()]
  const term = nationality ? `${nationality} ${mood}` : mood
  const key = `${countryCode.toLowerCase()}:${mood}`
  if (trackCache.has(key)) return trackCache.get(key)!
  if (pendingFetches.has(key)) return pendingFetches.get(key)!

  const promise = (async () => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=us&media=music&limit=25&entity=song`
    const res = await fetch(url)
    const data = await res.json()
    const tracks: ItunesTrack[] = (data.results ?? [])
      .filter((r: { previewUrl?: string }) => !!r.previewUrl)
      .map((r: {
        trackName: string
        artistName: string
        artworkUrl100: string
        previewUrl: string
        trackViewUrl: string
      }) => ({
        trackName: r.trackName,
        artistName: r.artistName,
        artworkUrl: r.artworkUrl100?.replace('100x100', '300x300') ?? '',
        previewUrl: r.previewUrl,
        trackViewUrl: r.trackViewUrl,
      }))

    // fallback to mood-only if nationality search returned nothing
    if (tracks.length === 0 && nationality) {
      const fallback = await fetchTracks(mood, '')
      trackCache.set(key, fallback)
      return fallback
    }

    trackCache.set(key, tracks)
    return tracks
  })()

  pendingFetches.set(key, promise)
  promise.finally(() => pendingFetches.delete(key))
  return promise
}

export function useItunesTrack(weatherCode: number | null, countryCode?: string | null) {
  const [track, setTrack] = useState<ItunesTrack | null>(null)

  useEffect(() => {
    let cancelled = false
    const mood = weatherMood(weatherCode)
    const country = countryCode ?? 'US'

    fetchTracks(mood, country).then(tracks => {
      if (!cancelled && tracks.length > 0) {
        setTrack(tracks[Math.floor(Math.random() * tracks.length)])
      }
    })

    return () => { cancelled = true }
  }, [weatherCode, countryCode])

  return track
}
