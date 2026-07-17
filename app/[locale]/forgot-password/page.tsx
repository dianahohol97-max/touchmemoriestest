'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de']

/**
 * Password recovery, step 1: request the reset email.
 *
 * Until this page existed the store had NO way to recover a forgotten
 * password — an account with a lost password was lost forever. The email
 * links back to /<locale>/reset-password where the new password is set.
 */
export default function ForgotPasswordPage() {
  const pathname = usePathname()
  const seg = pathname?.split('/')[1] ?? ''
  const locale = LOCALES.includes(seg) ? seg : 'uk'

  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim()

    // Same canonical-origin rule as the OAuth login: never bake an ephemeral
    // preview URL into the email link.
    const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${canonicalOrigin}/${locale}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError('Не вдалося надіслати лист. Перевірте адресу і спробуйте ще раз.')
    } else {
      // Always show success — do not reveal whether the email exists.
      setSent(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '3px', padding: '48px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
          Відновлення пароля
        </h1>
        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '32px' }}>
          Вкажіть email вашого акаунту, і ми надішлемо посилання для створення нового пароля
        </p>

        {sent ? (
          <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '16px', borderRadius: '3px', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            Якщо акаунт з такою адресою існує, лист із посиланням уже в дорозі.
            Перевірте вхідні та папку «Спам» — посилання дійсне обмежений час.
          </div>
        ) : (
          <>
            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '3px', marginBottom: '16px', fontSize: '14px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="ваша@пошта.com"
                  style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px', boxSizing: 'border-box' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '14px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '3px', fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
              >
                {loading ? 'Надсилаємо...' : 'Надіслати посилання'}
              </button>
            </form>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
          Згадали пароль?{' '}
          <Link href={`/${locale}/login`} style={{ color: '#263A99', fontWeight: 600 }}>
            Увійти
          </Link>
        </p>
      </div>
    </div>
  )
}
