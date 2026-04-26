'use client'

import { useState, useEffect } from 'react'

export type MetArt = {
  title: string
  artist: string
  imageUrl: string
  objectUrl: string
}

function weatherKeyword(code: number | null): string {
  if (code === null) return 'landscape'
  if (code === 0) return 'sunshine'
  if (code <= 3) return 'clouds'
  if (code <= 48) return 'fog'
  if (code <= 55) return 'rain'
  if (code <= 65) return 'rain'
  if (code <= 75) return 'snow'
  if (code <= 82) return 'rain'
  if (code <= 86) return 'snow'
  return 'storm'
}

const MET_CULTURE: Record<string, string> = {
  US: 'American',
  GB: 'British',
  JP: 'Japanese',
  FR: 'French',
  DE: 'German',
  IT: 'Italian',
  ES: 'Spanish',
  NL: 'Dutch',
  BE: 'Flemish',
  AU: 'Australian',
  CN: 'Chinese',
  IN: 'Indian',
  BR: 'Brazilian',
  MX: 'Mexican',
  CA: 'Canadian',
  AT: 'Austrian',
  RU: 'Russian',
  GR: 'Greek',
  EG: 'Egyptian',
  TR: 'Turkish',
  VN: 'Vietnamese',
  KR: 'Korean',
  TH: 'Thai',
  PL: 'Polish',
  SE: 'Swedish',
  NO: 'Norwegian',
  DK: 'Danish',
  PT: 'Portuguese',
}

// module-level caches
const idCache = new Map<string, number[]>()
const pendingIds = new Map<string, Promise<number[]>>()
const artCache = new Map<number, MetArt>()

async function fetchObjectIds(key: string, q: string, culture?: string): Promise<number[]> {
  const res = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(q)}&hasImages=true&medium=Paintings`
  )
  const data = await res.json()
  const ids: number[] = (data.objectIDs ?? []).slice(0, 80)

  if (ids.length === 0 && culture) {
    return getObjectIds(q.replace(culture + ' ', ''))
  }

  idCache.set(key, ids)
  return ids
}

async function getObjectIds(keyword: string, culture?: string): Promise<number[]> {
  const key = culture ? `${culture}:${keyword}` : keyword
  if (idCache.has(key)) return idCache.get(key)!

  // deduplicate concurrent fetches for the same key
  if (!pendingIds.has(key)) {
    const q = culture ? `${culture} ${keyword}` : keyword
    const p = fetchObjectIds(key, q, culture).finally(() => pendingIds.delete(key))
    pendingIds.set(key, p)
  }
  return pendingIds.get(key)!
}

async function getArt(objectId: number): Promise<MetArt | null> {
  if (artCache.has(objectId)) return artCache.get(objectId)!
  const res = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`
  )
  const data = await res.json()
  const imageUrl = data.primaryImageSmall || data.primaryImage
  if (!imageUrl) return null
  const art: MetArt = {
    title: data.title ?? 'Untitled',
    artist: data.artistDisplayName || 'Unknown artist',
    imageUrl,
    objectUrl: data.objectURL ?? `https://www.metmuseum.org/art/collection/search/${objectId}`,
  }
  artCache.set(objectId, art)
  return art
}

export function useMetArt(weatherCode: number | null, countryCode?: string | null) {
  const [art, setArt] = useState<MetArt | null>(null)

  useEffect(() => {
    let cancelled = false
    const keyword = weatherKeyword(weatherCode)
    const culture = countryCode ? MET_CULTURE[countryCode.toUpperCase()] : undefined

    async function load() {
      const ids = await getObjectIds(keyword, culture)
      if (!ids.length || cancelled) return

      // shuffle once so every attempt hits a unique ID
      const shuffled = ids.slice().sort(() => Math.random() - 0.5).slice(0, 20)
      for (const id of shuffled) {
        if (cancelled) return
        const result = await getArt(id)
        if (result) {
          setArt(result)
          return
        }
      }
    }

    setArt(null)
    load()
    return () => { cancelled = true }
  }, [weatherCode, countryCode])

  return art
}
