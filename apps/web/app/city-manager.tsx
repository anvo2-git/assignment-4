'use client'

import { useTransition, useRef, useState, useEffect } from 'react'
import { addCity, removeCity } from './actions'

interface PreviewData {
  city: string
  country: string
  temperature_f: number
  humidity: number
  wind_speed: number
  weather_code: number
}

function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 65) return '🌧️'
  if (code <= 75) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '❄️'
  return '⛈️'
}

interface Props {
  userCities: string[]
}

export default function CityManager({ userCities }: Props) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [pendingCity, setPendingCity] = useState<string | null>(null)

  async function detectLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county
          if (city) {
            startTransition(() => addCity(city))
          } else {
            setGeoError('Could not determine your city')
          }
        } catch {
          setGeoError('Could not detect location')
        } finally {
          setGeoLoading(false)
        }
      },
      () => {
        setGeoError('Location access denied')
        setGeoLoading(false)
      }
    )
  }

  // auto-detect on first sign-in
  useEffect(() => {
    if (userCities.length === 0) detectLocation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setPreview(null)
      setPreviewError(null)
      return
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await fetch(`/api/weather/${encodeURIComponent(trimmed)}`)
        if (!res.ok) {
          setPreview(null)
          setPreviewError('City not found')
        } else {
          const data: PreviewData = await res.json()
          setPreview(data)
          setPreviewError(null)
        }
      } catch {
        setPreviewError('Could not fetch preview')
      } finally {
        setPreviewLoading(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (pendingCity && userCities.includes(pendingCity)) {
      setPendingCity(null)
    }
  }, [pendingCity, userCities])

  function handleAdd(formData: FormData) {
    const city = (preview?.city ?? (formData.get('city') as string ?? '')).trim()
    if (!city) return
    setQuery('')
    setPendingCity(city)
    startTransition(() => addCity(city))
  }

  return (
    <div className="mt-10 border-t border-gray-100 pt-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">My Cities</h3>

      <form action={handleAdd} className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          name="city"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Add a city (e.g. Paris)"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          disabled={isPending}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isPending || (!preview && !query.trim())}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? '…' : 'Add'}
        </button>
      </form>

      {previewLoading && (
        <div className="text-xs text-gray-400 mb-4">Looking up {query}…</div>
      )}

      {previewError && (
        <div className="text-xs text-red-400 mb-4">{previewError}</div>
      )}

      {preview && !previewLoading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
          <span className="text-2xl">{weatherIcon(preview.weather_code)}</span>
          <div>
            <span className="font-medium text-gray-800">{preview.city}</span>
            <span className="text-gray-400 ml-1 text-xs">{preview.country}</span>
            <div className="text-gray-500 text-xs mt-0.5">
              {Math.round(preview.temperature_f)}°F · 💧{preview.humidity}% · 💨{Math.round(preview.wind_speed)} mph
            </div>
          </div>
          <span className="ml-auto text-xs text-blue-400">preview</span>
        </div>
      )}

      {pendingCity && !userCities.includes(pendingCity) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Saved {pendingCity}. The worker will add its weather after the next poll.
        </div>
      )}

      {userCities.length === 0 && (
        <div className="mb-4 text-xs text-gray-400">
          {geoLoading && <p>📍 Detecting your location…</p>}
          {geoError && (
            <div>
              <p className="text-red-400 mb-1">{geoError}</p>
              <button
                onClick={detectLocation}
                disabled={geoLoading || isPending}
                className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
              >
                Try again
              </button>
              <span className="ml-2 text-gray-300">or type a city above</span>
            </div>
          )}
          {!geoLoading && !geoError && <p>Your city will appear after the next poll (~30s).</p>}
        </div>
      )}

      {userCities.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {userCities.map(city => (
            <li key={city} className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm text-blue-700">
              {city}
              <button
                onClick={() => startTransition(() => removeCity(city))}
                disabled={isPending}
                className="text-blue-400 hover:text-blue-700 disabled:opacity-50 font-bold leading-none"
                aria-label={`Remove ${city}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
