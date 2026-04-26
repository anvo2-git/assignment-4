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

// iTunes store codes — falls back to US for unmapped countries
const ITUNES_COUNTRY: Record<string, string> = {
  US: 'us', GB: 'gb', JP: 'jp', FR: 'fr', DE: 'de', IT: 'it',
  ES: 'es', NL: 'nl', AU: 'au', CN: 'cn', IN: 'in', BR: 'br',
  MX: 'mx', CA: 'ca', AT: 'at', RU: 'ru', GR: 'gr', TR: 'tr',
  KR: 'kr', TH: 'th', SE: 'se', NO: 'no', DK: 'dk', PL: 'pl',
  VN: 'vn', BE: 'be', PT: 'pt',
}

const trackCache = new Map<string, ItunesTrack[]>()
const pendingFetches = new Map<string, Promise<ItunesTrack[]>>()

async function fetchTracks(mood: string, countryCode: string): Promise<ItunesTrack[]> {
  const store = ITUNES_COUNTRY[countryCode.toUpperCase()] ?? 'us'
  const key = `${store}:${mood}`
  if (trackCache.has(key)) return trackCache.get(key)!
  if (pendingFetches.has(key)) return pendingFetches.get(key)!

  const promise = (async () => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(mood)}&country=${store}&media=music&limit=25&entity=song`
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

    // fallback to US store if country store returned nothing
    if (tracks.length === 0 && store !== 'us') {
      const fallback = await fetchTracks(mood, 'US')
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
