'use client';

import { useEffect, useState } from 'react';

interface CabinetData {
  loggedIn: boolean;
  role: string | null;
  status: string | null;
  name: string | null;
  email: string | null;
  discountPercent: number;
  label: string | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'not_agency' }
  | { kind: 'ready'; data: CabinetData }
  | { kind: 'error' };

const PERCENT = 7; // fallback copy value; the API drives the real number

export default function WeddingAgencyCabinet() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/b2b/my-cabinet', { credentials: 'include' });
        const data: CabinetData = await res.json();
        if (!data.loggedIn) { setState({ kind: 'guest' }); return; }
        if (data.role !== 'wedding_agency') { setState({ kind: 'not_agency' }); return; }
        setState({ kind: 'ready', data });
      } catch {
        setState({ kind: 'error' });
      }
    })();
  }, []);

  const wrap: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '40px 16px 80px', fontFamily: 'Arial, sans-serif', color: '#1f2937' };
  const centered: React.CSSProperties = { ...wrap, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', color: '#475569' };
  const btn: React.CSSProperties = { display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 10, padding: '12px 24px', fontWeight: 800, textDecoration: 'none', fontSize: 15 };
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 };

  if (state.kind === 'loading') {
    return (
      <div style={centered}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#1e2d7d', borderRadius: '50%', animation: 'tm-spin 0.8s linear infinite' }} />
        <div>Шукаємо ваш кабінет…</div>
        <style>{'@keyframes tm-spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    );
  }

  if (state.kind === 'guest') {
    return (
      <div style={centered}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d' }}>Увійдіть у свій акаунт</div>
        <div style={{ maxWidth: 440 }}>Кабінет весільної агенції прив'язаний до вашого акаунта. Увійдіть тим самим email і паролем, що при реєстрації в програмі.</div>
        <a href="/uk/login?next=/uk/wedding-agency/cabinet" style={btn}>Увійти</a>
        <a href="/uk/wedding-agencies" style={{ color: '#94a3b8', fontSize: 13 }}>Ще не подавали заявку? Приєднатися →</a>
      </div>
    );
  }

  if (state.kind === 'not_agency') {
    return (
      <div style={centered}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d' }}>Ви ще не в програмі для агенцій</div>
        <div style={{ maxWidth: 440 }}>Ваш акаунт не підключено до партнерської програми для весільних агенцій. Подайте коротку заявку — і отримайте постійну знижку {PERCENT}% на книги побажань і весільні газети.</div>
        <a href="/uk/wedding-agencies" style={btn}>Подати заявку агенції</a>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={centered}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>Сталася помилка</div>
        <div style={{ maxWidth: 440 }}>Не вдалося відкрити кабінет. Спробуйте увійти ще раз.</div>
        <a href="/uk/login?next=/uk/wedding-agency/cabinet" style={btn}>Спробувати увійти</a>
      </div>
    );
  }

  // ready
  const { data } = state;
  const percent = data.discountPercent || PERCENT;

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: '0 0 4px' }}>Кабінет весільної агенції</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        {data.name ? <>Вітаємо, <b>{data.name}</b>! </> : null}Тут — статус вашої партнерської знижки {percent}%.
      </p>

      <DiscountStatus status={data.status} percent={percent} />

      <div style={card}>
        <div style={{ fontWeight: 800, color: '#1e2d7d', fontSize: 15, marginBottom: 10 }}>Як діє ваша знижка</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
          <li>Постійна знижка <b>{percent}%</b> на <b>книги побажань</b> і <b>весільні газети</b> для ваших клієнтів.</li>
          <li>Знижка застосовується <b>автоматично</b> — жодних промокодів вводити не потрібно.</li>
          <li>Головне — <b>оформлювати замовлення з увімкненим входом у свій акаунт</b> (той самий email і пароль). Тоді ціна для агенцій враховується в каталозі й кошику.</li>
        </ul>
        <a href="/uk/category/knyha-pobazhan" style={{ ...btn, marginTop: 14, fontSize: 14, padding: '10px 20px' }}>Перейти до каталогу</a>
      </div>

      <div style={{ ...card, marginBottom: 0, background: '#f8fafc' }}>
        <div style={{ fontWeight: 700, color: '#475569', fontSize: 13, marginBottom: 6 }}>Ваш акаунт</div>
        <div style={{ fontSize: 14, color: '#1f2937' }}>{data.email}</div>
        <a href="/uk/account" style={{ color: '#1e2d7d', fontSize: 13, fontWeight: 600, display: 'inline-block', marginTop: 8 }}>Керувати акаунтом →</a>
      </div>
    </div>
  );
}

function DiscountStatus({ status, percent }: { status: string | null; percent: number }) {
  if (status === 'verified') {
    return (
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: '#065f46', fontSize: 16, marginBottom: 4 }}>Ваша знижка {percent}% активна</div>
        <div style={{ fontSize: 14, color: '#047857', lineHeight: 1.6 }}>
          Замовляйте книги побажань і весільні газети зі знижкою — <b>увійдіть у свій акаунт покупця</b>, і спеціальна ціна враховується автоматично в каталозі й кошику.
        </div>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: '#92400e', fontSize: 16, marginBottom: 4 }}>⏳ Заявку на знижку {percent}% розглядаємо</div>
        <div style={{ fontSize: 14, color: '#b45309', lineHeight: 1.6 }}>
          Ми перевіряємо вашу заявку протягом 1–2 робочих днів. Щойно підтвердимо — знижка увімкнеться у вашому акаунті автоматично, і ви зможете замовляти за спеціальною ціною.
        </div>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: '#991b1b', fontSize: 16, marginBottom: 4 }}>Заявку не підтверджено</div>
        <div style={{ fontSize: 14, color: '#b91c1c', lineHeight: 1.6 }}>
          На жаль, цього разу ми не змогли підтвердити заявку. Якщо це помилка — напишіть нам на <a href="mailto:hello@touchmemories.com.ua" style={{ color: '#991b1b', fontWeight: 700 }}>hello@touchmemories.com.ua</a>, і ми розберемося.
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontWeight: 800, color: '#1e2d7d', fontSize: 16, marginBottom: 4 }}>Знижку ще не активовано</div>
      <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
        Ваш акаунт зареєстровано, але заявку на знижку {percent}% ще не оформлено або не завершено. Подайте її — це швидко.
      </div>
      <a href="/uk/wedding-agencies" style={{ display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginTop: 10 }}>
        Подати заявку
      </a>
    </div>
  );
}
