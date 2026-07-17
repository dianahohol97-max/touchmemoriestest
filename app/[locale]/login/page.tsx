'use client'

import { Suspense, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Inner component uses useSearchParams(), which forces client-side rendering.
// Next.js requires any component reading useSearchParams() to sit inside a
// <Suspense> boundary, otherwise the whole page fails to prerender at build
// time ("useSearchParams() should be wrapped in a suspense boundary") — which
// aborts `next build` and blocks every deploy. The default export below
// provides that boundary.
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/account'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleGoogleLogin = async () => {
    // Return to the current localized page on the CANONICAL domain. Avoids two
    // bugs: (1) window.location.origin can be an ephemeral Vercel preview URL
    // that 404s after the next deploy; (2) "/auth/callback" has no locale, but
    // the callback route only exists under [locale]. The global
    // OAuthCallbackHandler picks up the ?code= here and routes to /account.
    const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${canonicalOrigin}${window.location.pathname}`
      }
    })
    if (error) {
      setError(error.message)
      return
    }
    if (data?.url) {
      window.location.href = data.url
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Невірний email або пароль')
      setLoading(false)
    } else {
      router.push(nextUrl)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: "3px",
        padding: '48px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Увійти
        </h1>
        <p style={{
          color: '#64748b',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          Раді бачити вас знову
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '12px',
            borderRadius: "3px",
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: 600,
              display: 'block',
              marginBottom: '6px'
            }}>
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="ваша@пошта.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: "3px",
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: 600,
              display: 'block',
              marginBottom: '6px'
            }}>
              Пароль
            </label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: "3px",
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#263A99',
              color: 'white',
              border: 'none',
              borderRadius: "3px",
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? 'Завантаження...' : 'Увійти'}
          </button>
          <p style={{ textAlign: 'right', fontSize: '14px', margin: '0 0 16px' }}>
            <Link href="/forgot-password" style={{ color: '#64748b', fontWeight: 500 }}>
              Забули пароль?
            </Link>
          </p>
        </form>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '8px 0 16px'
        }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e2e8f0' }} />
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>або</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e2e8f0' }} />
        </div>

        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: 'white',
            color: '#263A99',
            border: '1px solid #e2e8f0',
            borderRadius: "3px",
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '24px'
          }}
        >
          <img
            src="https://www.google.com/favicon.ico"
            width="20"
            height="20"
            alt="Google"
          />
          Увійти через Google
        </button>

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
          Ще не маєте акаунту?{' '}
          <Link href="/register" style={{ color: '#263A99', fontWeight: 600 }}>
            Зареєструватись
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
