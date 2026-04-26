import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import WeatherLive, { type WeatherReading, type CityStats } from './weather-live'
import CityManager from './city-manager'
import WeatherDigest from './weather-digest'
import { getUserCities } from './actions'

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

  const cities = (readings ?? []).map(r => r.city as string)

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

  const userCities = userId ? await getUserCities() : []

  return (
    <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
      <WeatherDigest cities={cities} />
      <WeatherLive
        initialReadings={(readings ?? []) as WeatherReading[]}
        initialStats={statsMap}
        userCities={userCities}
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
