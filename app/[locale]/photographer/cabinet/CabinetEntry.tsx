'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type State =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'no_cabinet' }
  | { kind: 'creating' }
  | { kind: 'error' };

export default function CabinetEntry() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/photographers/my-cabinet', { credentials: 'include' });
        const json = await res.json();
        if (json.email) setEmail(json.email);
        if (!json.loggedIn) { setState({ kind: 'guest' }); return; }
        if (json.cabinet_token) {
          router.replace(`/uk/photographer/cabinet/${json.cabinet_token}`);
          return;
        }
        setState({ kind: 'no_cabinet' });
      } catch {
        setState({ kind: 'error' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Provision a cabinet for the logged-in user on the spot (galleries + landing
  // are open to everyone; only the 10% discount is approval-gated) and jump
  // straight in — no bounce through /account.
  const createCabinet = async () => {
    setState({ kind: 'creating' });
    try {
      const res = await fetch('/api/photographers/self-create', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      const token = json?.photographer?.cabinet_token;
      if (token) { router.replace(`/uk/photographer/cabinet/${token}`); return; }
      setState({ kind: 'error' });
    } catch {
      setState({ kind: 'error' });
    }
  };

  const wrap: React.CSSProperties = { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'Arial, sans-serif', color: '#475569', textAlign: 'center', padding: 20 };
  const btn: React.CSSProperties = { display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 10, padding: '12px 24px', fontWeight: 800, textDecoration: 'none', border: 'none', cursor: 'pointer', fontSize: 15 };
  const btnGhost: React.CSSProperties = { ...btn, background: '#eef2ff', color: '#1e2d7d' };
  const spinner = <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#1e2d7d', borderRadius: '50%', animation: 'tm-spin 0.8s linear infinite' }} />;
  const keyframes = <style>{'@keyframes tm-spin { to { transform: rotate(360deg) } }'}</style>;

  if (state.kind === 'loading') {
    return (
      <div style={wrap}>
        {spinner}
        <div>Шукаємо ваш кабінет…</div>
        {keyframes}
      </div>
    );
  }

  if (state.kind === 'creating') {
    return (
      <div style={wrap}>
        {spinner}
        <div>Створюємо ваш кабінет…</div>
        {keyframes}
      </div>
    );
  }

  if (state.kind === 'guest') {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d' }}>Увійдіть у свій акаунт</div>
        <div style={{ maxWidth: 420 }}>Кабінет фотографа прив'язаний до вашого акаунта. Увійдіть тим самим email і паролем, що при реєстрації.</div>
        <a href="/uk/login?next=/uk/photographer/cabinet" style={btn}>Увійти</a>
        <a href="/uk/gallery-for-photographers#signup" style={{ color: '#94a3b8', fontSize: 13 }}>Ще немає кабінету? Створити →</a>
      </div>
    );
  }

  if (state.kind === 'no_cabinet') {
    return (
      <div style={wrap}>
        {email && (
          <div style={{ fontSize: 13, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px' }}>
            ✓ Ви вже увійшли як <b>{email}</b>
          </div>
        )}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d' }}>У вас ще немає кабінету фотографа</div>
        <div style={{ maxWidth: 440 }}>Ваш акаунт є, але кабінет фотографа ще не створено. Натисніть кнопку — галереї для клієнтів і сторінка-візитка зʼявляться одразу, нічого заповнювати не потрібно.</div>
        <button onClick={createCabinet} style={btn}>Створити кабінет одним кліком</button>
        <a href="/uk/gallery-for-photographers#signup" style={{ color: '#94a3b8', fontSize: 13 }}>Дізнатися більше про кабінет →</a>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>Сталася помилка</div>
      <div style={{ maxWidth: 420 }}>Не вдалося відкрити кабінет. Спробуйте увійти ще раз.</div>
      <a href="/uk/login?next=/uk/photographer/cabinet" style={btn}>Спробувати увійти</a>
    </div>
  );
}
