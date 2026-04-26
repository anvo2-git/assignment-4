'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase-server'

const DEFAULT_NAMES = new Set(['Chicago', 'New York', 'Los Angeles', 'London', 'Tokyo'].map(c => c.toLowerCase()))

async function geocode(name: string): Promise<{ lat: number; lon: number; country: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`
  const res = await fetch(url)
  const data = await res.json()
  const r = data.results?.[0]
  if (!r) return null
  return { lat: r.latitude, lon: r.longitude, country: r.country_code ?? '' }
}

async function fetchWeather(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&temperature_unit=fahrenheit&timezone=auto`
  const res = await fetch(url)
  return res.json()
}

async function seedCityWeather(city: string) {
  if (DEFAULT_NAMES.has(city.toLowerCase())) return

  const coords = await geocode(city)
  if (!coords) {
    console.warn(`Could not geocode city for seed: ${city}`)
    return
  }

  const data = await fetchWeather(coords.lat, coords.lon)
  const c = data.current
  if (!c) {
    console.warn(`Could not fetch weather for seed: ${city}`)
    return
  }

  const sb = getServerClient()
  const row = {
    city,
    temperature_f: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    wind_speed: c.wind_speed_10m,
    weather_code: c.weather_code,
    recorded_at: c.time,
    timezone: data.timezone ?? null,
    country_code: coords.country ?? null,
  }

  const [{ error: upsertErr }, { error: insertErr }] = await Promise.all([
    sb.from('weather_readings').upsert(row, { onConflict: 'city' }),
    sb.from('weather_history').insert(row),
  ])

  if (upsertErr) console.warn(`Could not seed weather_readings for ${city}:`, upsertErr.message)
  if (insertErr) console.warn(`Could not seed weather_history for ${city}:`, insertErr.message)
}

export async function getUserCities(): Promise<string[]> {
  const { userId } = await auth()
  if (!userId) return []
  const sb = getServerClient()
  const { data } = await sb
    .from('user_cities')
    .select('city')
    .eq('clerk_id', userId)
  return (data ?? []).map((r: { city: string }) => r.city)
}

export async function addCity(city: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const trimmed = city.trim()
  if (!trimmed) return
  const sb = getServerClient()
  const { error } = await sb
    .from('user_cities')
    .upsert({ clerk_id: userId, city: trimmed }, { onConflict: 'clerk_id,city' })
  if (error) throw new Error(error.message)
  await seedCityWeather(trimmed).catch(err => {
    console.warn(`Could not seed weather for ${trimmed}:`, err instanceof Error ? err.message : err)
  })
  revalidatePath('/')
}

export async function removeCity(city: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const sb = getServerClient()
  const { error } = await sb
    .from('user_cities')
    .delete()
    .eq('clerk_id', userId)
    .eq('city', city)
  if (error) throw new Error(error.message)
  revalidatePath('/')
}
