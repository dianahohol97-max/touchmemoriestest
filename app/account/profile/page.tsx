'use client';
import { Settings } from 'lucide-react';

export default function ProfilePage() {
    return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Settings size={32} color="#94a3b8" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Редагування профілю</h2>
            <p style={{ color: '#64748b' }}>Цей розділ знаходиться у розробці. Незабаром ви зможете змінити свої дані тут.</p>
        </div>
    );
}
