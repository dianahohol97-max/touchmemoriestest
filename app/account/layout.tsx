'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AccountLayout({
  children
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      setUser(null)
      setLoading(false)
      return
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseKey)

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)
      setLoading(false)
    }

    getUser()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '16px',
        color: '#64748b'
      }}>
        Завантаження...
      </div>
    )
  }

  if (!user) return null

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Користувач'

  const avatarUrl = user?.user_metadata?.avatar_url
    || user?.user_metadata?.picture
    || null

  const firstLetter = displayName?.[0]?.toUpperCase() ?? 'U'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            width={48}
            height={48}
            style={{
              borderRadius: '50%',
              objectFit: 'cover',
              aspectRatio: '1 / 1',
              flexShrink: 0,
              width: '48px',
              height: '48px',
            }}
            alt={displayName}
          />
        ) : (
          <div style={{
            width: '48px',
            height: '48px',
            minWidth: '48px',
            borderRadius: '50%',
            backgroundColor: '#263A99',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {firstLetter}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#263A99' }}>
            Привіт, {displayName}! 👋
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>
            {user?.email ?? ''}
          </div>
        </div>
      </div>
      <div style={{ padding: '32px' }}>
        {children}
      </div>
    </div>
  )
}
