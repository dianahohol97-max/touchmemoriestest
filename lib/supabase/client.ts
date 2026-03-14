import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Supabase env vars missing:', { url: !!url, key: !!key })
    throw new Error(`supabaseKey is required. URL: ${url}, Key: ${key}`)
  }

  return createBrowserClient(url, key)
}
