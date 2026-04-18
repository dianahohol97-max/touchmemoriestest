'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { toast } from 'sonner';

const TOPICS = [
  { id: 'intro', label: 'Передмова — хто вона є', icon: '✨' },
  { id: 'friendship', label: 'Дружба', icon: '🤝' },
  { id: 'family', label: "Сім'я і дім", icon: '🏡' },
  { id: 'love', label: 'Любов і стосунки', icon: '💫' },
  { id: 'favourites', label: 'Улюблені речі', icon: '🎀' },
  { id: 'strength', label: 'Сила і характер', icon: '🦋' },
  { id: 'memories', label: 'Спільні спогади', icon: '📸' },
  { id: 'future', label: 'Побажання на майбутнє', icon: '🌟' },
];

const RELATIONSHIPS = ['подруга', 'мама', 'партнер / кохана людина', 'сестра', 'донька', 'колега', 'я сама', 'інше'];
const TONES = [
  { id: 'warm', label: 'Ніжний і теплий', desc: 'Щиро, від серця' },
  { id: 'humor', label: 'З легким гумором', desc: 'Тепло і з іронією' },
  { id: 'poetic', label: 'Поетичний', desc: 'Образний і красивий' },
  { id: 'mix', label: 'Суміш', desc: 'Тепло + трохи гумору' },
];
const LANGUAGES = [
  { id: 'uk', label: '🇺🇦 Українська' },
  { id: 'en', label: '🇬🇧 English' },
  { id: 'pl', label: '🇵🇱 Polski' },
  { id: 'ro', label: '🇷🇴 Română' },
];

const inp = { width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, lineHeight: 1.5 };
const textarea = { ...inp, minHeight: 90, resize: 'vertical' as const };
const label = { fontSize: 14, fontWeight: 700, color: '#1e2d7d', display: 'block', marginBottom: 6 };
const hint = { fontSize: 12, color: '#9ca3af', marginTop: 4 };

export default function MagazineBriefPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    subject_name: '',
    relationship: '',
    subject_age: '',
    subject_city: '',
    three_words: '',
    what_amazes: '',
    in_hard_moments: '',
    superpower: '',
    never_does: '',
    unforgettable_moment: '',
    when_you_feel_bad: '',
    funny_situation: '',
    loves: '',
    small_habit: '',
    morning_ritual: '',
    music_film: '',
    how_she_laughs: '',
    page_topics: ['intro', 'friendship', 'strength', 'favourites'] as string[],
    tone: 'warm',
    language: 'uk',
    customer_email: '',
    customer_name: '',
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const toggleTopic = (id: string) => {
    const cur = form.page_topics;
    if (cur.includes(id)) {
      if (cur.length <= 2) return toast.error('Мінімум 2 теми');
      set('page_topics', cur.filter(t => t !== id));
    } else {
      if (cur.length >= 8) return toast.error('Максимум 8 тем');
      set('page_topics', [...cur, id]);
    }
  };

  const submit = async () => {
    if (!form.subject_name || !form.relationship || !form.customer_email) {
      return toast.error('Заповніть обовʼязкові поля');
    }
    if (form.page_topics.length < 2) return toast.error('Оберіть хоча б 2 теми');

    setSubmitting(true);
    try {
      const res = await fetch('/api/magazine-brief/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...form }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStep(4); // Success step
    } catch (e) {
      toast.error('Помилка відправки. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = Math.round(((step - 1) / 3) * 100);

  if (step === 4) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, maxWidth: 600, margin: '0 auto', padding: '120px 20px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>✨</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1e2d7d', marginBottom: 16 }}>Анкету отримано!</h1>
        <p style={{ fontSize: 17, color: '#374151', lineHeight: 1.8, marginBottom: 32 }}>
          Ми вже пишемо текст для вашого журналу.<br />
          Протягом кількох годин він зʼявиться у вашій поштовій скринці та в особистому кабінеті.
        </p>
        <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 40 }}>
          Текст не відправляється вночі — якщо ви заповнили анкету після 19:00, очікуйте листа вранці після 8:00.
        </p>
        <button onClick={() => router.push('/uk/account')}
          style={{ padding: '14px 32px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Перейти до кабінету
        </button>
      </main>
      <Footer />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, maxWidth: 680, margin: '0 auto', padding: '100px 20px 60px', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Глянцевий журнал · Текст від нас</p>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#111', margin: 0 }}>Розкажіть нам про людину</h1>
          <p style={{ fontSize: 15, color: '#6b7280', marginTop: 8 }}>Чим більше деталей — тим живіший і персональніший текст</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {['Про кого журнал', 'Характер і деталі', 'Стиль і теми'].map((s, i) => (
              <span key={i} style={{ fontSize: 12, color: step > i + 1 ? '#1e2d7d' : step === i + 1 ? '#111' : '#9ca3af', fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
            ))}
          </div>
          <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2 }}>
            <div style={{ height: '100%', background: '#1e2d7d', borderRadius: 2, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <span style={label}>Імʼя людини *</span>
              <input style={inp} value={form.subject_name} onChange={e => set('subject_name', e.target.value)} placeholder="Наприклад: Соня" />
            </div>

            <div>
              <span style={label}>Ваші стосунки *</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {RELATIONSHIPS.map(r => (
                  <button key={r} onClick={() => set('relationship', r)}
                    style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${form.relationship === r ? '#1e2d7d' : '#e5e7eb'}`, background: form.relationship === r ? '#1e2d7d' : '#fff', color: form.relationship === r ? '#fff' : '#374151', fontSize: 14, cursor: 'pointer', fontWeight: form.relationship === r ? 700 : 400 }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={label}>Вік або скільки знайомі</span>
                <input style={inp} value={form.subject_age} onChange={e => set('subject_age', e.target.value)} placeholder="Напр: 25 років / знайомі 7 років" />
              </div>
              <div>
                <span style={label}>Місто</span>
                <input style={inp} value={form.subject_city} onChange={e => set('subject_city', e.target.value)} placeholder="Де живе або звідки" />
              </div>
            </div>

            <div>
              <span style={label}>Три слова про неї</span>
              <input style={inp} value={form.three_words} onChange={e => set('three_words', e.target.value)} placeholder="Напр: щира, смілива, домашня" />
            </div>

            <div>
              <span style={label}>Ваш email (куди відправити текст) *</span>
              <input style={inp} type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="your@email.com" />
            </div>

            <div>
              <span style={label}>Ваше імʼя</span>
              <input style={inp} value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Необовʼязково" />
            </div>

            <button onClick={() => {
              if (!form.subject_name || !form.relationship || !form.customer_email) return toast.error('Заповніть обовʼязкові поля');
              setStep(2);
            }} style={{ padding: '14px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              Далі →
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <span style={label}>Що в ній вас найбільше вражає або захоплює?</span>
              <textarea style={textarea} value={form.what_amazes} onChange={e => set('what_amazes', e.target.value)} placeholder="Те, що вона завжди знає що сказати. Або що ніколи не скаржиться..." />
            </div>

            <div>
              <span style={label}>Яка вона у складні моменти?</span>
              <textarea style={textarea} value={form.in_hard_moments} onChange={e => set('in_hard_moments', e.target.value)} placeholder="Тримається, але всередині переживає. Або навпаки — збирається і вирішує..." />
            </div>

            <div>
              <span style={label}>Яка в неї суперсила — що їй дається легко, а іншим ні?</span>
              <input style={inp} value={form.superpower} onChange={e => set('superpower', e.target.value)} placeholder="Вміє слухати. Або завжди знаходить вихід. Або робить найкращі обійми..." />
            </div>

            <div>
              <span style={label}>Що вона ніколи не робить?</span>
              <input style={inp} value={form.never_does} onChange={e => set('never_does', e.target.value)} placeholder="Не скаржиться. Не зраджує. Не забуває дні народження..." />
            </div>

            <div>
              <span style={label}>Незабутній момент з нею</span>
              <textarea style={{ ...textarea, minHeight: 100 }} value={form.unforgettable_moment} onChange={e => set('unforgettable_moment', e.target.value)} placeholder="Опишіть будь-який момент — смішний, теплий або важливий. Чим детальніше — тим краще." />
              <p style={hint}>Цей деталь зробить текст живим і несхожим на шаблон</p>
            </div>

            <div>
              <span style={label}>Що вона робить, коли вам погано?</span>
              <textarea style={textarea} value={form.when_you_feel_bad} onChange={e => set('when_you_feel_bad', e.target.value)} placeholder="Просто приїжджає. Або пише смішне. Або мовчить поруч..." />
            </div>

            <div>
              <span style={label}>Яка смішна або тепла ситуація була між вами?</span>
              <textarea style={textarea} value={form.funny_situation} onChange={e => set('funny_situation', e.target.value)} placeholder="Необовʼязково, але додасть тексту вашу унікальну нотку" />
            </div>

            <div>
              <span style={label}>Що вона обожнює?</span>
              <input style={inp} value={form.loves} onChange={e => set('loves', e.target.value)} placeholder="Кава зранку, прогулянки, серіали, певна музика, конкретна їжа..." />
            </div>

            <div>
              <span style={label}>Яка в неї маленька звичка або ритуал?</span>
              <input style={inp} value={form.small_habit} onChange={e => set('small_habit', e.target.value)} placeholder="Завжди перевіряє телефон перед сном. Або пʼє чай з медом. Або..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={label}>Яку музику слухає або фільм дивиться знову і знову?</span>
                <input style={inp} value={form.music_film} onChange={e => set('music_film', e.target.value)} placeholder="Назва або жанр" />
              </div>
              <div>
                <span style={label}>Як вона сміється?</span>
                <input style={inp} value={form.how_she_laughs} onChange={e => set('how_she_laughs', e.target.value)} placeholder="Заразно. Тихо але щиро. Регоче..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← Назад</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, padding: '14px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Далі →</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <span style={label}>Теми сторінок (оберіть 2–8)</span>
              <p style={{ ...hint, marginBottom: 16, marginTop: 0 }}>Обрано: {form.page_topics.length}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TOPICS.map(t => {
                  const sel = form.page_topics.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => toggleTopic(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: `2px solid ${sel ? '#1e2d7d' : '#e5e7eb'}`, borderRadius: 12, background: sel ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 20 }}>{t.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: sel ? 700 : 400, color: sel ? '#1e2d7d' : '#374151' }}>{t.label}</span>
                      {sel && <span style={{ marginLeft: 'auto', color: '#1e2d7d', fontWeight: 900 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span style={label}>Тон тексту</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {TONES.map(t => (
                  <button key={t.id} onClick={() => set('tone', t.id)}
                    style={{ padding: '14px', border: `2px solid ${form.tone === t.id ? '#1e2d7d' : '#e5e7eb'}`, borderRadius: 12, background: form.tone === t.id ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: form.tone === t.id ? '#1e2d7d' : '#111' }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={label}>Мова тексту</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {LANGUAGES.map(l => (
                  <button key={l.id} onClick={() => set('language', l.id)}
                    style={{ padding: '10px 20px', border: `2px solid ${form.language === l.id ? '#1e2d7d' : '#e5e7eb'}`, borderRadius: 20, background: form.language === l.id ? '#1e2d7d' : '#fff', color: form.language === l.id ? '#fff' : '#374151', fontSize: 14, cursor: 'pointer', fontWeight: form.language === l.id ? 700 : 400 }}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', fontSize: 14, color: '#78350f', lineHeight: 1.7 }}>
              <strong>⏰ Коли отримаєте текст?</strong><br />
              Текст буде готовий через ~3 години після заповнення анкети.<br />
              Якщо ви заповнюєте після 19:00 — текст прийде вранці після 8:00.<br />
              Вночі ми не турбуємо 🌙
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← Назад</button>
              <button onClick={submit} disabled={submitting}
                style={{ flex: 2, padding: '14px', background: submitting ? '#9ca3af' : '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Відправляємо...' : '✨ Відправити анкету'}
              </button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
