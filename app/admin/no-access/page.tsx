'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function NoAccessPage() {
    return (
        <div style={{
            height: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px'
        }}>
            <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '40px',
                backgroundColor: '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px',
                boxShadow: '0 20px 40px rgba(239, 68, 68, 0.1)'
            }}>
                <ShieldAlert size={64} />
            </div>

            <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#263A99', marginBottom: '16px' }}>
                Доступ обмежено
            </h1>

            <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '500px', marginBottom: '48px', lineHeight: '1.6' }}>
                У вас немає достатніх прав для перегляду цього розділу.
                Будь ласка, зверніться до адміністратора, якщо вважаєте, що це помилка.
            </p>

            <div style={{ display: 'flex', gap: '16px' }}>
                <button
                    onClick={() => window.history.back()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '14px 28px', backgroundColor: 'white', border: '1px solid #e2e8f0',
                        borderRadius: '16px', fontWeight: 700, color: '#475569', cursor: 'pointer'
                    }}
                >
                    <ArrowLeft size={20} />
                    Назад
                </button>
                <Link
                    href="/admin"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '14px 28px', backgroundColor: '#263A99', color: 'white',
                        borderRadius: '16px', fontWeight: 700, textDecoration: 'none',
                        boxShadow: '0 10px 20px rgba(30, 41, 59, 0.2)'
                    }}
                >
                    <Home size={20} />
                    На головну
                </Link>
            </div>
        </div>
    );
}
