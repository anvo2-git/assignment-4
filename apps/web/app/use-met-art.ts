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
const artCache = new Map<number, MetArt>()

async function getObjectIds(keyword: string, culture?: string): Promise<number[]> {
  const key = culture ? `${culture}:${keyword}` : keyword
  if (idCache.has(key)) return idCache.get(key)!

  const q = culture ? `${culture} ${keyword}` : keyword
  const res = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(q)}&hasImages=true&medium=Paintings`
  )
  const data = await res.json()
  const ids: number[] = (data.objectIDs ?? []).slice(0, 80)

  // fallback to keyword-only if country+keyword returns nothing
  if (ids.length === 0 && culture) {
    const fallback = await getObjectIds(keyword)
    idCache.set(key, fallback)
    return fallback
  }

  idCache.set(key, ids)
  return ids
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

      for (let attempt = 0; attempt < 15; attempt++) {
        const id = ids[Math.floor(Math.random() * ids.length)]
        const result = await getArt(id)
        if (result && !cancelled) {
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
