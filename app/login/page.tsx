'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://touchmemoriestest-ajha3c1uy-dianahohol97-7159s-projects.vercel.app/auth/callback'
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
      router.push('/account')
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
        borderRadius: '3px',
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
            borderRadius: '3px',
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
                borderRadius: '3px',
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
                borderRadius: '3px',
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
              borderRadius: '3px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '16px'
            }}
          >
            {loading ? 'Завантаження...' : 'Увійти'}
          </button>
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
            borderRadius: '3px',
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
