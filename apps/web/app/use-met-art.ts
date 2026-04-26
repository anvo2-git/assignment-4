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

// module-level cache: keyword → array of object IDs
const idCache = new Map<string, number[]>()
// module-level cache: objectId → MetArt
const artCache = new Map<number, MetArt>()

async function getObjectIds(keyword: string): Promise<number[]> {
  if (idCache.has(keyword)) return idCache.get(keyword)!
  const res = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(keyword)}&hasImages=true&medium=Paintings`
  )
  const data = await res.json()
  const ids: number[] = (data.objectIDs ?? []).slice(0, 80)
  idCache.set(keyword, ids)
  return ids
}

async function getArt(objectId: number): Promise<MetArt | null> {
  if (artCache.has(objectId)) return artCache.get(objectId)!
  const res = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`
  )
  const data = await res.json()
  if (!data.primaryImageSmall) return null
  const art: MetArt = {
    title: data.title ?? 'Untitled',
    artist: data.artistDisplayName || 'Unknown artist',
    imageUrl: data.primaryImageSmall,
    objectUrl: data.objectURL ?? `https://www.metmuseum.org/art/collection/search/${objectId}`,
  }
  artCache.set(objectId, art)
  return art
}

export function useMetArt(weatherCode: number | null) {
  const [art, setArt] = useState<MetArt | null>(null)

  useEffect(() => {
    let cancelled = false
    const keyword = weatherKeyword(weatherCode)

    async function load() {
      const ids = await getObjectIds(keyword)
      if (!ids.length || cancelled) return

      // try up to 5 random picks until we get one with an image
      for (let attempt = 0; attempt < 5; attempt++) {
        const id = ids[Math.floor(Math.random() * ids.length)]
        const result = await getArt(id)
        if (result && !cancelled) {
          setArt(result)
          return
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [weatherCode])

  return art
}
