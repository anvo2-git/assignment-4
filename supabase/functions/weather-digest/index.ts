import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { cities } = await req.json() as { cities: string[] }

  if (!cities || cities.length === 0) {
    return new Response(
      JSON.stringify({ digest: 'No cities to summarise.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: readings } = await supabase
    .from('weather_readings')
    .select('city, temperature_f, weather_code')
    .in('city', cities)

  if (!readings || readings.length === 0) {
    return new Response(
      JSON.stringify({ digest: 'No weather data available yet.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const sorted = [...readings].sort((a, b) => (a.temperature_f ?? 0) - (b.temperature_f ?? 0))
  const coldest = sorted[0]
  const warmest = sorted[sorted.length - 1]

  function label(code: number | null): string {
    if (code === null) return 'unknown conditions'
    if (code === 0) return 'clear skies'
    if (code <= 3) return 'partly cloudy skies'
    if (code <= 48) return 'fog'
    if (code <= 55) return 'drizzle'
    if (code <= 65) return 'rain'
    if (code <= 75) return 'snow'
    if (code <= 82) return 'showers'
    if (code <= 86) return 'snow showers'
    return 'thunderstorms'
  }

  let digest: string

  if (coldest.city === warmest.city) {
    digest = `${coldest.city} is sitting at ${Math.round(coldest.temperature_f ?? 0)}°F with ${label(coldest.weather_code)}.`
  } else {
    digest =
      `Your coldest city is ${coldest.city} at ${Math.round(coldest.temperature_f ?? 0)}°F with ${label(coldest.weather_code)}. ` +
      `${warmest.city} is the warmest at ${Math.round(warmest.temperature_f ?? 0)}°F with ${label(warmest.weather_code)}.`
  }

  return new Response(
    JSON.stringify({ digest }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
