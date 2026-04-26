import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ city: string }> }
) {
  const { city } = await params
  const name = decodeURIComponent(city).trim()
  if (!name) return NextResponse.json({ error: 'city required' }, { status: 400 })

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`
  )
  const geoData = await geoRes.json()
  const place = geoData.results?.[0]

  if (!place) {
    return NextResponse.json({ error: 'City not found' }, { status: 404 })
  }

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&temperature_unit=fahrenheit`
  )
  const weatherData = await weatherRes.json()
  const c = weatherData.current

  return NextResponse.json({
    city: place.name,
    country: place.country_code,
    temperature_f: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    wind_speed: c.wind_speed_10m,
    weather_code: c.weather_code,
  })
}
