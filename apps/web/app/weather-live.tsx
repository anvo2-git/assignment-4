'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useMetArt } from './use-met-art'

export type WeatherReading = {
  city: string
  temperature_f: number | null
  humidity: number | null
  wind_speed: number | null
  weather_code: number | null
  recorded_at: string | null
}

export type CityStats = {
  min_f: number | null
  max_f: number | null
  avg_f: number | null
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

function WeatherCard({
  reading,
  stats,
  isFavorite,
}: {
  reading: WeatherReading
  stats: CityStats | null
  isFavorite: boolean
}) {
  const updatedAt = reading.recorded_at
    ? new Date(reading.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—'

  const hasStats = stats && (stats.min_f != null || stats.max_f != null)
  const art = useMetArt(reading.weather_code)

  return (
    <div className={`rounded-2xl border flex flex-col bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden ${isFavorite ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}>
      <div className="p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-800 truncate">{reading.city}</span>
          {isFavorite && <span className="text-xs text-blue-500 font-medium">★ saved</span>}
        </div>
        <div className="text-4xl">{weatherIcon(reading.weather_code)}</div>
        <div className="text-2xl font-bold text-gray-900">
          {reading.temperature_f != null ? `${Math.round(reading.temperature_f)}°F` : '—'}
        </div>
        <div className="text-sm text-gray-500">{weatherLabel(reading.weather_code)}</div>
        <div className="flex gap-3 text-xs text-gray-400 mt-1">
          <span>💧 {reading.humidity != null ? `${reading.humidity}%` : '—'}</span>
          <span>💨 {reading.wind_speed != null ? `${Math.round(reading.wind_speed)} mph` : '—'}</span>
        </div>
        {hasStats && (
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
            24h: {stats.min_f != null ? `${Math.round(stats.min_f)}°` : '—'}
            {' – '}
            {stats.max_f != null ? `${Math.round(stats.max_f)}°F` : '—'}
            {stats.avg_f != null && <span className="text-gray-300 ml-1">(avg {Math.round(stats.avg_f)}°)</span>}
          </div>
        )}
        <div className="text-xs text-gray-300 mt-auto">Updated {updatedAt}</div>
      </div>

      {art && (
        <a
          href={art.objectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative group"
        >
          <img
            src={art.imageUrl}
            alt={art.title}
            className="w-full h-32 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
            <div className="text-white">
              <p className="text-xs font-medium leading-tight truncate">{art.title}</p>
              <p className="text-xs opacity-70 truncate">{art.artist}</p>
            </div>
          </div>
        </a>
      )}
    </div>
  )
}

interface Props {
  initialReadings: WeatherReading[]
  initialStats: Record<string, CityStats>
  userCities: string[]
}

export default function WeatherLive({ initialReadings, initialStats, userCities }: Props) {
  const [byCity, setByCity] = useState<Map<string, WeatherReading>>(() => {
    const m = new Map<string, WeatherReading>()
    for (const r of initialReadings) m.set(r.city, r)
    return m
  })

  const [stats] = useState<Record<string, CityStats>>(initialStats)

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

  const readings = [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city))
  const userCitySet = new Set(userCities)

  if (readings.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-5xl mb-4">🌐</div>
        <p className="text-lg">Waiting for weather data…</p>
        <p className="text-sm mt-1">The worker polls every 30 seconds.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Live Weather</h2>
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {readings.map(r => (
          <WeatherCard
            key={r.city}
            reading={r}
            stats={stats[r.city] ?? null}
            isFavorite={userCitySet.has(r.city)}
          />
        ))}
      </div>
    </div>
  )
}
