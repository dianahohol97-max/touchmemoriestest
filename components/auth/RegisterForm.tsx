'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, User, Mail, Phone, Lock, Gift } from 'lucide-react';

export default function RegisterForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        birthday_day: '',
        birthday_month: '',
    });

    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const months = [
        { value: 1, label: 'Січень' },
        { value: 2, label: 'Лютий' },
        { value: 3, label: 'Березень' },
        { value: 4, label: 'Квітень' },
        { value: 5, label: 'Травень' },
        { value: 6, label: 'Червень' },
        { value: 7, label: 'Липень' },
        { value: 8, label: 'Серпень' },
        { value: 9, label: 'Вересень' },
        { value: 10, label: 'Жовтень' },
        { value: 11, label: 'Листопад' },
        { value: 12, label: 'Грудень' },
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (formData.password !== formData.confirmPassword) {
            toast.error('Паролі не співпадають');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Пароль повинен містити мінімум 6 символів');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    name: formData.name,
                    phone: formData.phone || null,
                    birthday_day: formData.birthday_day ? parseInt(formData.birthday_day) : null,
                    birthday_month: formData.birthday_month ? parseInt(formData.birthday_month) : null,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Реєстрація успішна! Вітаємо! ');
                // Redirect to login or auto-login
                setTimeout(() => {
                    router.push('/account/orders');
                }, 1500);
            } else {
                toast.error(data.error || 'Помилка реєстрації');
            }
        } catch (err) {
            toast.error('Не вдалося зареєструватись');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={formStyle}>
            <h2 style={titleStyle}>Створити акаунт</h2>
            <p style={subtitleStyle}>Приєднуйтесь до нашої спільноти</p>

            {/* Name */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <User size={16} /> Ім'я та Прізвище
                </label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Іван Іваненко"
                    style={inputStyle}
                />
            </div>

            {/* Email */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <Mail size={16} /> Email
                </label>
                <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="ivan@example.com"
                    style={inputStyle}
                />
            </div>

            {/* Phone */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <Phone size={16} /> Телефон (необов'язково)
                </label>
                <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+380 XX XXX XX XX"
                    style={inputStyle}
                />
            </div>

            {/* Password */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <Lock size={16} /> Пароль
                </label>
                <div style={{ position: 'relative' }}>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        placeholder="Мінімум 6 символів"
                        style={inputStyle}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={eyeButtonStyle}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>

            {/* Confirm Password */}
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <Lock size={16} /> Підтвердження пароля
                </label>
                <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Повторіть пароль"
                    style={inputStyle}
                />
            </div>

            {/* Birthday */}
            <div style={birthdaySectionStyle}>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>
                    <Gift size={16} />  День народження (необов'язково)
                </label>
                <p style={birthdayHintStyle}>
                    Отримайте подарунок у свій день народження!
                </p>
                <div style={birthdayInputsStyle}>
                    <select
                        name="birthday_day"
                        value={formData.birthday_day}
                        onChange={handleChange}
                        style={selectStyle}
                    >
                        <option value="">День </option>
                        {days.map(day => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>
                    <select
                        name="birthday_month"
                        value={formData.birthday_month}
                        onChange={handleChange}
                        style={selectStyle}
                    >
                        <option value="">Місяць </option>
                        {months.map(month => (
                            <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={loading}
                style={submitButtonStyle}
            >
                {loading ? 'Реєстрація...' : 'Зареєструватись'}
            </button>

            <p style={loginLinkStyle}>
                Вже є акаунт? <a href="/login" style={linkStyle}>Увійти</a>
            </p>
        </form>
    );
}

const formStyle: React.CSSProperties = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '40px 32px',
    backgroundColor: 'white',
    borderRadius: "3px",
    boxShadow: '0 4px 25px rgba(0,0,0,0.08)',
    border: '1px solid #f1f5f9'
};

const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 900,
    color: '#263A99',
    marginBottom: '8px',
    textAlign: 'center'
};

const subtitleStyle: React.CSSProperties = {
    fontSize: '15px',
    color: '#64748b',
    marginBottom: '32px',
    textAlign: 'center'
};

const fieldStyle: React.CSSProperties = {
    marginBottom: '20px'
};

const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: "3px",
    border: '1.5px solid #e2e8f0',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.2s'
};

const selectStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: "3px",
    border: '1.5px solid #e2e8f0',
    fontSize: '15px',
    outline: 'none',
    backgroundColor: 'white',
    cursor: 'pointer'
};

const eyeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px'
};

const birthdaySectionStyle: React.CSSProperties = {
    padding: '20px',
    backgroundColor: '#f0f9ff',
    borderRadius: "3px",
    border: '1.5px solid #bae6fd',
    marginBottom: '24px'
};

const birthdayHintStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#263A99',
    marginBottom: '12px'
};

const birthdayInputsStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
};

const submitButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: "3px",
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const loginLinkStyle: React.CSSProperties = {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#64748b'
};

const linkStyle: React.CSSProperties = {
    color: 'var(--primary)',
    fontWeight: 700,
    textDecoration: 'none'
};
