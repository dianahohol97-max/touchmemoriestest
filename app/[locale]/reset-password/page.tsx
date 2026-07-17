'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de']

/**
 * Password recovery, step 2: set the new password.
 *
 * The emailed link lands here with a ?code= that the global
 * OAuthCallbackHandler exchanges for a session (it knows to STAY on this
 * page instead of bouncing to /account). We wait for that session to
 * appear, then let the user set a new password via auth.updateUser.
 */
export default function ResetPasswordPage() {
  const pathname = usePathname()
  const router = useRouter()
  const seg = pathname?.split('/')[1] ?? ''
  const locale = LOCALES.includes(seg) ? seg : 'uk'

  // 'checking' → waiting for the recovery session; 'ready' → show the form;
  // 'no-session' → link expired/used; 'done' → password changed.
  const [phase, setPhase] = useState<'checking' | 'ready' | 'no-session' | 'done'>('checking')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    let cancelled = false
    // The code exchange happens asynchronously in OAuthCallbackHandler, so
    // poll briefly instead of checking once — a single early check would
    // race it and falsely report "expired link".
    const started = Date.now()
    const tick = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) { setPhase('ready'); return }
      if (Date.now() - started > 8000) { setPhase('no-session'); return }
      setTimeout(tick, 400)
    }
    tick()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const form = e.currentTarget
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value
    if (password.length < 8) {
      setError('Пароль має містити щонайменше 8 символів')
      return
    }
    if (password !== confirm) {
      setError('Паролі не збігаються')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError('Не вдалося змінити пароль. Спробуйте запросити нове посилання.')
    } else {
      setPhase('done')
      setTimeout(() => router.push(`/${locale}/account`), 2500)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '3px', padding: '48px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
          Новий пароль
        </h1>

        {phase === 'checking' && (
          <p style={{ color: '#64748b', textAlign: 'center' }}>
            Перевіряємо посилання...
          </p>
        )}

        {phase === 'no-session' && (
          <>
            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '16px', borderRadius: '3px', fontSize: '14px', lineHeight: 1.6, margin: '24px 0' }}>
              Посилання недійсне або його термін минув. Запросіть нове — це займе хвилину.
            </div>
            <p style={{ textAlign: 'center', fontSize: '14px' }}>
              <Link href={`/${locale}/forgot-password`} style={{ color: '#263A99', fontWeight: 600 }}>
                Надіслати нове посилання
              </Link>
            </p>
          </>
        )}

        {phase === 'done' && (
          <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '16px', borderRadius: '3px', fontSize: '14px', lineHeight: 1.6, marginTop: '24px', textAlign: 'center' }}>
            Пароль змінено. Зараз перенесемо вас до кабінету...
          </div>
        )}

        {phase === 'ready' && (
          <>
            <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '32px' }}>
              Придумайте новий пароль для вашого акаунту
            </p>
            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '3px', marginBottom: '16px', fontSize: '14px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Новий пароль
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Повторіть пароль
                </label>
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px', boxSizing: 'border-box' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '14px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '3px', fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Зберігаємо...' : 'Зберегти новий пароль'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
