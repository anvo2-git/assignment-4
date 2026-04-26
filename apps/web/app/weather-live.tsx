'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useItunesTrack, useAudioPlayer } from './use-itunes-track'
import { removeCity } from './actions'
import { useTransition } from 'react'

export type WeatherReading = {
  city: string
  temperature_f: number | null
  humidity: number | null
  wind_speed: number | null
  weather_code: number | null
  recorded_at: string | null
  timezone: string | null
  country_code: string | null
}

export type CityStats = {
  min_f: number | null
  max_f: number | null
  avg_f: number | null
}

type WeatherCardState = {
  reading: WeatherReading
  pending: boolean
}

function weatherIcon(code: number | null): string {
  if (code === null) return '🌡️'
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

function weatherLabel(code: number | null): string {
  if (code === null) return 'Unknown'
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 55) return 'Drizzle'
  if (code <= 65) return 'Rain'
  if (code <= 75) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ''
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

function LocalTime({ timezone }: { timezone: string }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }))
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [timezone])

  return <span>{time}</span>
}

function WeatherCard({
  reading,
  stats,
  isFavorite,
  pending,
  onRemove,
}: {
  reading: WeatherReading
  stats: CityStats | null
  isFavorite: boolean
  pending: boolean
  onRemove?: () => void
}) {
  const track = useItunesTrack(reading.weather_code, !pending)
  const { playing, toggle } = useAudioPlayer(track?.previewUrl)
  const hasStats = !pending && stats && (stats.min_f != null || stats.max_f != null)
  const flag = countryFlag(reading.country_code)

  return (
    <div className={`rounded-2xl border flex flex-col shadow-sm transition-shadow hover:shadow-md overflow-hidden select-none cursor-default ${pending ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-100' : 'bg-white'} ${isFavorite && !pending ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}>
      <div className="p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-800 truncate">
            {flag && <span className="mr-1.5">{flag}</span>}
            {reading.city}
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {isFavorite && <span className="text-xs text-blue-500 font-medium">★ saved</span>}
            {onRemove && (
              <button
                onClick={onRemove}
                className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none cursor-pointer"
                aria-label={`Remove ${reading.city}`}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {reading.timezone && reading.timezone !== 'GMT' && (
          <div className="text-xs text-gray-400">
            🕐 <LocalTime timezone={reading.timezone} />
          </div>
        )}

        <div className="text-4xl">{pending ? '⏳' : weatherIcon(reading.weather_code)}</div>
        <div className="text-2xl font-bold text-gray-900">
          {pending ? 'Waiting…' : reading.temperature_f != null ? `${Math.round(reading.temperature_f)}°F` : '—'}
        </div>
        <div className="text-sm text-gray-500">
          {pending ? 'Awaiting first worker poll' : weatherLabel(reading.weather_code)}
        </div>
        {!pending && (
          <div className="flex gap-3 text-xs text-gray-400 mt-1">
            <span>💧 {reading.humidity != null ? `${reading.humidity}%` : '—'}</span>
            <span>💨 {reading.wind_speed != null ? `${Math.round(reading.wind_speed)} mph` : '—'}</span>
          </div>
        )}
        {hasStats && (
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
            24h: {stats.min_f != null ? `${Math.round(stats.min_f)}°` : '—'}
            {' – '}
            {stats.max_f != null ? `${Math.round(stats.max_f)}°F` : '—'}
            {stats.avg_f != null && <span className="text-gray-300 ml-1">(avg {Math.round(stats.avg_f)}°)</span>}
          </div>
        )}
      </div>

      {track && (
        <div className="mt-auto border-t border-gray-100 flex items-center gap-3 px-4 py-3 bg-gray-50">
          <img src={track.artworkUrl} alt={track.trackName} className="w-10 h-10 rounded object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{track.trackName}</p>
            <p className="text-xs text-gray-400 truncate">{track.artistName}</p>
          </div>
          <button
            onClick={toggle}
            className="shrink-0 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 transition-colors text-xs cursor-pointer"
            aria-label={playing ? 'Pause preview' : 'Play preview'}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      )}
    </div>
  )
}

const HIDDEN_CITIES_KEY = 'weather-hidden-cities'
const SAVED_CITIES_EVENT = 'weather-user-cities-changed'

function loadHidden(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(HIDDEN_CITIES_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

interface Props {
  initialReadings: WeatherReading[]
  initialStats: Record<string, CityStats>
  userCities: string[]
  publicCities: readonly string[]
  isSignedIn: boolean
}

export default function WeatherLive({ initialReadings, initialStats, userCities, publicCities, isSignedIn }: Props) {
  const [byCity, setByCity] = useState<Map<string, WeatherReading>>(() => {
    const m = new Map<string, WeatherReading>()
    for (const r of initialReadings) m.set(r.city, r)
    return m
  })
  const [stats] = useState<Record<string, CityStats>>(initialStats)
  const [localSaved, setLocalSaved] = useState<Set<string>>(() => new Set(userCities))
  const [removed, setRemoved] = useState<Set<string>>(loadHidden)
  const [isPending, startTransition] = useTransition()
  const publicCitySet = useMemo(() => new Set(publicCities), [publicCities])
  const displayItems = useMemo<WeatherCardState[]>(() => {
    const cities = isSignedIn
      ? [...localSaved]
      : [...publicCitySet].filter(city => !removed.has(city))

    return cities
      .sort((a, b) => a.localeCompare(b))
      .map(city => {
        const reading = byCity.get(city)
        return {
          reading: reading ?? {
            city,
            temperature_f: null,
            humidity: null,
            wind_speed: null,
            weather_code: null,
            recorded_at: null,
            timezone: null,
            country_code: null,
          },
          pending: !reading,
        }
      })
  }, [byCity, isSignedIn, localSaved, publicCitySet, removed])

  useEffect(() => {
    setByCity(prev => {
      const m = new Map(prev)
      for (const r of initialReadings) {
        if (!m.has(r.city)) m.set(r.city, r)
      }
      return m
    })
  }, [initialReadings])

  useEffect(() => {
    setLocalSaved(new Set(userCities))
  }, [userCities])

  useEffect(() => {
    function handleSavedCitiesChange(event: Event) {
      const detail = (event as CustomEvent<{ city: string; action: 'add' | 'remove' }>).detail
      if (!detail?.city) return
      setLocalSaved(prev => {
        const next = new Set(prev)
        if (detail.action === 'add') next.add(detail.city)
        if (detail.action === 'remove') next.delete(detail.city)
        return next
      })
    }

    window.addEventListener(SAVED_CITIES_EVENT, handleSavedCitiesChange)
    return () => window.removeEventListener(SAVED_CITIES_EVENT, handleSavedCitiesChange)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_CITIES_KEY, JSON.stringify([...removed]))
    } catch { /* ignore */ }
  }, [removed])

  useEffect(() => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = sb
      .channel('weather-readings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_readings' },
        (payload) => {
          const r = payload.new as WeatherReading
          if (r?.city) setByCity(prev => new Map(prev).set(r.city, r))
        }
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  function handleRemove(city: string) {
    setRemoved(prev => new Set(prev).add(city))
    if (localSaved.has(city)) {
      setLocalSaved(prev => { const s = new Set(prev); s.delete(city); return s })
      startTransition(() => removeCity(city))
    }
  }

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 select-none">
        <div className="text-5xl mb-4">📍</div>
        <p className="text-lg">{isSignedIn ? 'Adding your city…' : 'Waiting for weather data…'}</p>
        <p className="text-sm mt-1">The worker polls every 30 seconds.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 select-none">Live Weather</h2>
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium select-none">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayItems.map(({ reading, pending }) => (
          <WeatherCard
            key={reading.city}
            reading={reading}
            stats={stats[reading.city] ?? null}
            isFavorite={localSaved.has(reading.city)}
            pending={pending}
            onRemove={isSignedIn ? () => handleRemove(reading.city) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
