import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_CITIES = [
  { name: 'Chicago',     lat: 41.8781,  lon: -87.6298  },
  { name: 'New York',    lat: 40.7128,  lon: -74.0060  },
  { name: 'Los Angeles', lat: 34.0522,  lon: -118.2437 },
  { name: 'London',      lat: 51.5074,  lon: -0.1278   },
  { name: 'Tokyo',       lat: 35.6762,  lon: 139.6503  },
]

const DEFAULT_NAMES = new Set(DEFAULT_CITIES.map(c => c.name.toLowerCase()))

async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`
  const res = await fetch(url)
  const data = await res.json()
  const r = data.results?.[0]
  if (!r) return null
  return { lat: r.latitude, lon: r.longitude }
}

async function getUserCities() {
  const { data, error } = await supabase
    .from('user_cities')
    .select('city')
  if (error) {
    console.error('Error fetching user_cities:', error.message)
    return []
  }
  const unique = [...new Set((data ?? []).map(r => r.city as string))]
  return unique.filter(c => !DEFAULT_NAMES.has(c.toLowerCase()))
}

async function fetchWeather(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&temperature_unit=fahrenheit`
  const res = await fetch(url)
  return res.json()
}

async function fetchAndStore() {
  console.log(`[${new Date().toISOString()}] polling Open-Meteo...`)

  const userCityNames = await getUserCities()
  const userCities: { name: string; lat: number; lon: number }[] = []
  for (const name of userCityNames) {
    const coords = await geocode(name)
    if (coords) userCities.push({ name, ...coords })
    else console.warn(`  Could not geocode: ${name}`)
  }

  const cities = [...DEFAULT_CITIES, ...userCities]

  for (const city of cities) {
    const data = await fetchWeather(city.lat, city.lon)
    const c = data.current

    const row = {
      city: city.name,
      temperature_f: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      wind_speed: c.wind_speed_10m,
      weather_code: c.weather_code,
      recorded_at: c.time,
    }

    const [{ error: upsertErr }, { error: insertErr }] = await Promise.all([
      supabase.from('weather_readings').upsert(row, { onConflict: 'city' }),
      supabase.from('weather_history').insert(row),
    ])

    if (upsertErr) console.error(`  Error upserting ${city.name}:`, upsertErr.message)
    if (insertErr) console.error(`  Error inserting history ${city.name}:`, insertErr.message)
    if (!upsertErr && !insertErr) console.log(`  ${city.name}: ${c.temperature_2m}°F`)
  }
}

const interval = parseInt(process.env.POLL_INTERVAL_MS ?? '30000')
fetchAndStore()
setInterval(fetchAndStore, interval)
