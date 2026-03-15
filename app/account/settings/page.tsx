'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SettingsPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [user, setUser] = useState<any>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setUser(session.user);
        };
        fetchUser();
    }, []);

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');
        if (!newPassword || newPassword.length < 6) {
            setPasswordError('Новий пароль має містити мінімум 6 символів.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Паролі не збігаються.');
            return;
        }
        setSavingPassword(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setSavingPassword(false);
        if (error) {
            setPasswordError(error.message);
        } else {
            setPasswordSuccess('Пароль успішно змінено!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(''), 4000);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '14px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        color: '#1e293b',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        marginBottom: '6px',
        color: '#475569',
    };

    const isGoogleUser = user?.app_metadata?.provider === 'google';

    return (
        <div style={{ maxWidth: '560px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#1e293b' }}>
                Налаштування акаунту
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>
                {user?.email}
            </p>

            {/* Password change section */}
            <div style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', color: '#1e293b' }}>
                    Зміна паролю
                </h3>

                {isGoogleUser ? (
                    <p style={{ fontSize: '14px', color: '#64748b', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                        Ваш акаунт пов&apos;язаний через Google. Зміна паролю недоступна.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {passwordSuccess && (
                            <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                                ✓ {passwordSuccess}
                            </div>
                        )}
                        {passwordError && (
                            <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                                ⚠ {passwordError}
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Новий пароль</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                style={inputStyle}
                                placeholder="Мінімум 6 символів"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Підтвердіть пароль</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={inputStyle}
                                placeholder="Повторіть новий пароль"
                            />
                        </div>
                        <button
                            onClick={handleChangePassword}
                            disabled={savingPassword}
                            style={{
                                padding: '12px 28px',
                                backgroundColor: '#1e293b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: 700,
                                cursor: savingPassword ? 'not-allowed' : 'pointer',
                                alignSelf: 'flex-start',
                                opacity: savingPassword ? 0.7 : 1,
                            }}
                        >
                            {savingPassword ? 'Збереження...' : 'Змінити пароль'}
                        </button>
                    </div>
                )}
            </div>

            {/* Sign out section */}
            <div style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>
                    Вийти з акаунту
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                    Ви будете перенаправлені на сторінку входу.
                </p>
                <button
                    onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                    }}
                    style={{
                        padding: '12px 28px',
                        backgroundColor: 'white',
                        color: '#dc2626',
                        border: '2px solid #fecaca',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    Вийти
                </button>
            </div>
        </div>
    );
}
