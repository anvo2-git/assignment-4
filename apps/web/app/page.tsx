import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import WeatherLive, { type WeatherReading, type CityStats } from './weather-live'
import CityManager from './city-manager'
import WeatherDigest from './weather-digest'
import { getUserCities } from './actions'

const PUBLIC_CITY_NAMES = ['Chicago', 'New York', 'Los Angeles', 'London', 'Tokyo'] as const
const PUBLIC_CITY_SET = new Set<string>(PUBLIC_CITY_NAMES)

export default async function Home() {
  const { userId } = await auth()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: readings } = await sb
    .from('weather_readings')
    .select('city,temperature_f,humidity,wind_speed,weather_code,recorded_at,timezone,country_code')
    .order('city')

  const userCities = userId ? await getUserCities() : []
  const allReadings = (readings ?? []) as WeatherReading[]
  const visibleReadings = userId
    ? allReadings.filter(r => userCities.includes(r.city))
    : allReadings.filter(r => PUBLIC_CITY_SET.has(r.city))

  const cities = visibleReadings.map(r => r.city)

  const statsResults = await Promise.all(
    cities.map(city =>
      sb.rpc('city_stats', { p_city: city }).single()
    )
  )

  const statsMap: Record<string, CityStats> = {}
  cities.forEach((city, i) => {
    const row = statsResults[i].data as CityStats | null
    if (row) statsMap[city] = row
  })

  return (
    <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
      <WeatherDigest cities={cities} />
      <WeatherLive
        initialReadings={visibleReadings}
        initialStats={statsMap}
        userCities={userCities}
        publicCities={PUBLIC_CITY_NAMES}
        isSignedIn={!!userId}
      />
      {userId && <CityManager userCities={userCities} />}
      {!userId && (
        <p className="mt-10 text-center text-sm text-gray-400">
          Sign in to save custom cities and track them live.
        </p>
      )}
    </main>
  )
}
