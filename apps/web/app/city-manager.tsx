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

  function handleAdd(formData: FormData) {
    const city = (preview?.city ?? (formData.get('city') as string ?? '')).trim()
    if (!city) return
    setQuery('')
    setPreview(null)
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

      {userCities.length === 0 ? (
        <p className="text-sm text-gray-400">No saved cities yet. Add one above and it will appear after the next poll (~30s).</p>
      ) : (
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
