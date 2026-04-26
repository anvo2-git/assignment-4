'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase-server'

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
  await sb
    .from('user_cities')
    .upsert({ clerk_id: userId, city: trimmed }, { onConflict: 'clerk_id,city' })
  revalidatePath('/')
}

export async function removeCity(city: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const sb = getServerClient()
  await sb
    .from('user_cities')
    .delete()
    .eq('clerk_id', userId)
    .eq('city', city)
  revalidatePath('/')
}
