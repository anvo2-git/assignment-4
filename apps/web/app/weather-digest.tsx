'use client'

import { useState } from 'react'

interface Props {
  cities: string[]
}

export default function WeatherDigest({ cities }: Props) {
  const [digest, setDigest] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchDigest() {
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/weather-digest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cities }),
        }
      )
      const data = await res.json()
      setDigest(data.digest ?? 'No digest available.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 flex items-start gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700 mb-1">Weather Digest</p>
        {digest ? (
          <p className="text-sm text-gray-600">{digest}</p>
        ) : (
          <p className="text-sm text-gray-400">Click to generate a plain-English summary of current conditions.</p>
        )}
      </div>
      <button
        onClick={fetchDigest}
        disabled={loading || cities.length === 0}
        className="shrink-0 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? '…' : digest ? 'Refresh' : 'Get Digest'}
      </button>
    </div>
  )
}
