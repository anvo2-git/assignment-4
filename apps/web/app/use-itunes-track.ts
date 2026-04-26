'use client'

import { useState, useEffect, useRef } from 'react'

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

const trackCache = new Map<string, ItunesTrack[]>()
const pendingFetches = new Map<string, Promise<ItunesTrack[]>>()

async function fetchTracks(mood: string): Promise<ItunesTrack[]> {
  if (trackCache.has(mood)) return trackCache.get(mood)!
  if (pendingFetches.has(mood)) return pendingFetches.get(mood)!

  const promise = (async () => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(mood)}&country=us&media=music&limit=25&entity=song`
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
    trackCache.set(mood, tracks)
    return tracks
  })()

  pendingFetches.set(mood, promise)
  promise.finally(() => pendingFetches.delete(mood))
  return promise
}

export function useItunesTrack(weatherCode: number | null, enabled = true) {
  const [track, setTrack] = useState<ItunesTrack | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      setTrack(null)
      return () => { cancelled = true }
    }
    fetchTracks(weatherMood(weatherCode)).then(tracks => {
      if (!cancelled && tracks.length > 0)
        setTrack(tracks[Math.floor(Math.random() * tracks.length)])
    })
    return () => { cancelled = true }
  }, [weatherCode, enabled])

  return track
}

export function useAudioPlayer(previewUrl: string | undefined) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function toggle() {
    if (!previewUrl) return
    if (!audioRef.current) {
      const audio = new Audio(previewUrl)
      audio.onended = () => setPlaying(false)
      audioRef.current = audio
      audio.play()
      setPlaying(true)
    } else if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  return { playing, toggle }
}
