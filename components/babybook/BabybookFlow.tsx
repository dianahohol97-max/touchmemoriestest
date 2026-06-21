'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Sparkles, User, Palette, Loader2, Check, Plus, Trash2, Upload, X } from 'lucide-react';

type Scenario = 'self' | 'designer';

interface CharacterDraft {
    name: string;
    appearance: string;
    photo_path: string | null;
    uploading?: boolean;
}

const THEME_PRESETS = [
    'Космічна пригода', 'Підводний світ', 'Чарівний ліс', 'Принцеси та замки',
    'Динозаври', 'Супергерої', 'Казкові тварини', 'Подорож у часі',
];

export default function BabybookFlow() {
    const [scenario, setScenario] = useState<Scenario | null>(null);
    const [orderId] = useState<string | null>(null); // set after order creation (payment step wires this later)

    // Child
    const [childName, setChildName] = useState('');
    const [childAge, setChildAge] = useState('');
    const [childGender, setChildGender] = useState('');

    // Story
    const [theme, setTheme] = useState('');
    const [dedication, setDedication] = useState('');
    const [personalDetails, setPersonalDetails] = useState<string[]>(['']);

    // Photos & characters
    const [childPhotos, setChildPhotos] = useState<string[]>([]);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [characters, setCharacters] = useState<CharacterDraft[]>([]);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    // NOTE: order creation + Monobank payment is wired in a later step; this
    // flow currently saves the brief against an existing order_id. For now the
    // submit calls the brief API with whatever orderId we hold (the checkout
    // integration passes it in). Photo upload also needs an order_id, so until
    // payment-first wiring lands we upload lazily on submit when we have one.

    const uploadPhoto = async (file: File, kind: 'child' | 'character'): Promise<string | null> => {
        if (!orderId) {
            // No order yet — store a local object URL placeholder path is not
            // useful server-side, so we defer. Return null and let submit handle.
            setError('Спочатку оформіть замовлення, щоб завантажити фото.');
            return null;
        }
        const fd = new FormData();
        fd.append('order_id', orderId);
        fd.append('kind', kind);
        fd.append('file', file);
        const res = await fetch('/api/babybook/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Не вдалося завантажити фото'); return null; }
        return data.path as string;
    };

    const onChildPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setPhotoUploading(true);
        setError('');
        for (const f of files.slice(0, 3 - childPhotos.length)) {
            const path = await uploadPhoto(f, 'child');
            if (path) setChildPhotos(prev => [...prev, path]);
        }
        setPhotoUploading(false);
    };

    const addCharacter = () => {
        if (characters.length >= 5) return;
        setCharacters(prev => [...prev, { name: '', appearance: '', photo_path: null }]);
    };
    const updateCharacter = (i: number, patch: Partial<CharacterDraft>) =>
        setCharacters(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
    const removeCharacter = (i: number) => setCharacters(prev => prev.filter((_, idx) => idx !== i));

    const updateDetail = (i: number, v: string) =>
        setPersonalDetails(prev => prev.map((d, idx) => idx === i ? v : d));
    const addDetail = () => setPersonalDetails(prev => prev.length < 10 ? [...prev, ''] : prev);
    const removeDetail = (i: number) => setPersonalDetails(prev => prev.filter((_, idx) => idx !== i));

    const submit = async () => {
        setError('');
        if (!childName.trim()) { setError('Вкажіть імʼя дитини'); return; }
        if (!scenario) { setError('Оберіть варіант створення'); return; }
        if (!orderId) {
            // Until payment-first wiring is in place, guide the user.
            setError('Оформлення замовлення та оплата підключаються на наступному кроці інтеграції.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/babybook/brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    scenario,
                    child_name: childName,
                    child_age: childAge,
                    child_gender: childGender,
                    theme,
                    dedication,
                    personal_details: personalDetails.map(d => d.trim()).filter(Boolean),
                    additional_characters: characters.map(c => ({
                        name: c.name, appearance: c.appearance, photo_path: c.photo_path,
                    })),
                    child_photos: childPhotos,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Сталася помилка'); setSubmitting(false); return; }
            setDone(true);
        } catch {
            setError('Сталася помилка. Спробуйте ще раз.');
        }
        setSubmitting(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 110, paddingBottom: 80 }}>
                <div className="container" style={{ maxWidth: 720 }}>
                    {done ? (
                        <div style={{ maxWidth: 520, margin: '40px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '48px 36px', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <Check size={32} color="#16a34a" />
                            </div>
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 12 }}>Анкету збережено!</h1>
                            <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, margin: 0 }}>
                                {scenario === 'designer'
                                    ? 'Наш дизайнер скоро візьметься за вашу казку. Ми повідомимо вас про готові етапи на пошту.'
                                    : 'Дякуємо! Тепер можна перейти до створення казки.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: 36 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#eef3ff', color: '#3d56d6', fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 20, marginBottom: 14 }}>
                                    <Sparkles size={15} /> Персоналізована казка
                                </div>
                                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 900, color: '#1e2d7d', margin: '0 0 10px' }}>
                                    Казка з вашою дитиною
                                </h1>
                                <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
                                    18 сторінок, 9 розворотів. Розкажіть про дитину — і вона стане героєм власної історії.
                                </p>
                            </div>

                            {/* Scenario choice */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
                                <ScenarioCard
                                    active={scenario === 'self'}
                                    icon={<Sparkles size={22} />}
                                    title="Створю сам"
                                    desc="Заповнюєте анкету та отримуєте казку, згенеровану автоматично. Швидко і самостійно."
                                    onClick={() => setScenario('self')}
                                />
                                <ScenarioCard
                                    active={scenario === 'designer'}
                                    icon={<Palette size={22} />}
                                    title="Хочу з дизайнером"
                                    desc="Наш дизайнер створить казку за вас, проходячи з вами кожен етап. Більше уваги до деталей."
                                    onClick={() => setScenario('designer')}
                                />
                            </div>

                            {scenario && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Child */}
                                    <Card title="Про дитину" icon={<User size={18} />}>
                                        <Field label="Імʼя дитини" required>
                                            <input value={childName} onChange={e => setChildName(e.target.value)} placeholder="Як звати героя казки?" style={inputStyle} />
                                        </Field>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Field label="Вік">
                                                <input value={childAge} onChange={e => setChildAge(e.target.value)} placeholder="Напр.: 4 роки" style={inputStyle} />
                                            </Field>
                                            <Field label="Стать">
                                                <select value={childGender} onChange={e => setChildGender(e.target.value)} style={inputStyle}>
                                                    <option value="">Оберіть</option>
                                                    <option value="girl">Дівчинка</option>
                                                    <option value="boy">Хлопчик</option>
                                                    <option value="other">Інше</option>
                                                </select>
                                            </Field>
                                        </div>
                                        <Field label="Фото дитини (1–3)">
                                            <PhotoUploader
                                                photos={childPhotos}
                                                uploading={photoUploading}
                                                onAdd={onChildPhoto}
                                                onRemove={(i) => setChildPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                max={3}
                                            />
                                        </Field>
                                    </Card>

                                    {/* Story */}
                                    <Card title="Про казку" icon={<Sparkles size={18} />}>
                                        <Field label="Тема казки">
                                            <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="Опишіть тему або оберіть нижче" style={inputStyle} />
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                                {THEME_PRESETS.map(t => (
                                                    <button key={t} type="button" onClick={() => setTheme(t)}
                                                        style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer',
                                                            background: theme === t ? '#263A99' : '#fff', color: theme === t ? '#fff' : '#475569', borderColor: theme === t ? '#263A99' : '#e2e8f0' }}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </Field>

                                        <Field label="Персональні деталі">
                                            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Улюблена іграшка, фраза, друг, тощо — додають казці теплоти.</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {personalDetails.map((d, i) => (
                                                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                                                        <input value={d} onChange={e => updateDetail(i, e.target.value)} placeholder="Напр.: улюблена іграшка — ведмедик Тедді" style={inputStyle} />
                                                        {personalDetails.length > 1 && (
                                                            <button type="button" onClick={() => removeDetail(i)} style={iconBtn}><Trash2 size={16} /></button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {personalDetails.length < 10 && (
                                                <button type="button" onClick={addDetail} style={addBtn}><Plus size={14} /> Додати деталь</button>
                                            )}
                                        </Field>

                                        <Field label="Присвята (на першій сторінці)">
                                            <input value={dedication} onChange={e => setDedication(e.target.value)} placeholder="Напр.: Для нашої улюбленої Софійки" style={inputStyle} />
                                        </Field>
                                    </Card>

                                    {/* Additional characters */}
                                    <Card title="Додаткові персонажі" icon={<User size={18} />}>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Брат, сестра, друг, домашній улюбленець — за бажанням.</div>
                                        {characters.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                                                {characters.map((c, i) => (
                                                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d' }}>Персонаж {i + 1}</span>
                                                            <button type="button" onClick={() => removeCharacter(i)} style={iconBtn}><Trash2 size={15} /></button>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            <input value={c.name} onChange={e => updateCharacter(i, { name: e.target.value })} placeholder="Імʼя" style={inputStyle} />
                                                            <input value={c.appearance} onChange={e => updateCharacter(i, { appearance: e.target.value })} placeholder="Зовнішність (напр.: руде волосся, окуляри)" style={inputStyle} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {characters.length < 5 && (
                                            <button type="button" onClick={addCharacter} style={addBtn}><Plus size={14} /> Додати персонажа</button>
                                        )}
                                    </Card>

                                    {error && <p style={{ fontSize: 14, color: '#ef4444', margin: 0 }}>{error}</p>}

                                    <button onClick={submit} disabled={submitting}
                                        style={{ width: '100%', padding: 16, background: submitting ? '#9ca3af' : '#263A99', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        {submitting && <Loader2 size={18} className="animate-spin" />}
                                        {submitting ? 'Збереження…' : scenario === 'designer' ? 'Відправити дизайнеру' : 'Створити казку'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff',
};
const iconBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626',
    cursor: 'pointer', padding: '0 10px', display: 'flex', alignItems: 'center',
};
const addBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 14px',
    background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
    color: '#3d56d6', cursor: 'pointer',
};

function ScenarioCard({ active, icon, title, desc, onClick }: { active: boolean; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
    return (
        <button onClick={onClick} type="button"
            style={{ textAlign: 'left', background: '#fff', border: `2px solid ${active ? '#263A99' : '#e2e8f0'}`, borderRadius: 14, padding: '22px 20px', cursor: 'pointer', transition: 'border-color .15s' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: active ? '#263A99' : '#eef3ff', color: active ? '#fff' : '#3d56d6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                {icon}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e2d7d', marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{desc}</div>
        </button>
    );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ color: '#263A99' }}>{icon}</div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>{title}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            {children}
        </div>
    );
}

function PhotoUploader({ photos, uploading, onAdd, onRemove, max }: {
    photos: string[]; uploading: boolean; onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void; onRemove: (i: number) => void; max: number;
}) {
    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {photos.map((_, i) => (
                    <div key={i} style={{ width: 72, height: 72, borderRadius: 10, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid #c7d2fe' }}>
                        <Check size={20} color="#16a34a" />
                        <button type="button" onClick={() => onRemove(i)}
                            style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={12} />
                        </button>
                    </div>
                ))}
                {photos.length < max && (
                    <label style={{ width: 72, height: 72, borderRadius: 10, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
                        {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                        <input type="file" accept="image/*" multiple onChange={onAdd} style={{ display: 'none' }} />
                    </label>
                )}
            </div>
        </div>
    );
}
