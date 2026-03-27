'use client'

import React from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface ExportProgressModalProps {
  open: boolean
  current: number
  total: number
  label?: string
  done?: boolean
}

/**
 * Blocking overlay shown while print-ready files are being exported.
 * Prevents navigation and shows per-file/page progress.
 */
export default function ExportProgressModal({
  open,
  current,
  total,
  label,
  done = false,
}: ExportProgressModalProps) {
  if (!open) return null

  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '40px 48px',
          maxWidth: '440px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {done ? (
          <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
        ) : (
          <Loader2
            size={48}
            className="animate-spin"
            style={{ color: '#263A99', margin: '0 auto 16px' }}
          />
        )}

        <h2
          style={{
            fontSize: '20px',
            fontWeight: 900,
            color: '#0f172a',
            marginBottom: '8px',
            fontFamily: 'var(--font-heading, Inter, sans-serif)',
          }}
        >
          {done ? 'Файли готові!' : 'Підготовка до друку…'}
        </h2>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
          {done
            ? 'Переходимо до кошика…'
            : label
            ? label
            : total > 1
            ? `Обробка сторінки ${current} з ${total}…`
            : 'Генерація файлу для друку…'}
        </p>

        {/* Progress bar */}
        <div
          style={{
            height: '6px',
            backgroundColor: '#f1f5f9',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${done ? 100 : percent}%`,
              backgroundColor: done ? '#10b981' : '#263A99',
              borderRadius: '999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {total > 1 && (
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
            {done ? total : current} / {total}
          </p>
        )}
      </div>
    </div>
  )
}
