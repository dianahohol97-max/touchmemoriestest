'use client';
export const dynamic = 'force-dynamic';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <SettingsIcon size={32} color="#94a3b8" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Налаштування акаунту</h2>
            <p style={{ color: '#64748b' }}>Цей розділ знаходиться у розробці. Незабаром ви зможете налаштувати свій акаунт тут.</p>
        </div>
    );
}
