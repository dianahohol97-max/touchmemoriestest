'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type State =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'not_partner' }
  | { kind: 'error' };

export default function PartnerCabinetEntry() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/partnership/my-cabinet', { credentials: 'include' });
        const json = await res.json();
        if (!json.loggedIn) { setState({ kind: 'guest' }); return; }
        if (json.cabinet_token) {
          router.replace(`/uk/partner/${json.cabinet_token}`);
          return;
        }
        setState({ kind: 'not_partner' });
      } catch {
        setState({ kind: 'error' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrap: React.CSSProperties = { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'Arial, sans-serif', color: '#475569', textAlign: 'center', padding: 20 };
  const btn: React.CSSProperties = { display: 'inline-block', background: '#263A99', color: '#fff', borderRadius: 10, padding: '12px 24px', fontWeight: 800, textDecoration: 'none', fontSize: 15 };
  const btnGhost: React.CSSProperties = { ...btn, background: '#eef2ff', color: '#263A99' };

  if (state.kind === 'loading') {
    return (
      <div style={wrap}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#263A99', borderRadius: '50%', animation: 'tm-spin 0.8s linear infinite' }} />
        <div>Шукаємо ваш кабінет…</div>
        <style>{'@keyframes tm-spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    );
  }

  if (state.kind === 'guest') {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#263A99' }}>Вхід у партнерський кабінет</div>
        <div style={{ maxWidth: 440 }}>
          Увійдіть у свій акаунт — на <b>ту саму пошту</b>, на яку оформлене ваше партнерство. Кабінет із нарахуваннями й виплатами відкриється автоматично.
        </div>
        <a href="/uk/login?next=/uk/partner/cabinet" style={btn}>Увійти</a>
        <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 440 }}>
          Заходите вперше? <a href="/uk/register" style={{ color: '#263A99', fontWeight: 700 }}>Створіть акаунт</a> на пошту вашого партнерства, підтвердіть її й поверніться сюди, щоб увійти — кабінет прив'яжеться сам.
        </div>
      </div>
    );
  }

  if (state.kind === 'not_partner') {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#263A99' }}>Партнерський кабінет не знайдено</div>
        <div style={{ maxWidth: 460 }}>
          До цього акаунта не прив'язане партнерство. Переконайтеся, що ви увійшли <b>на ту саму пошту</b>, на яку ми оформили вашу співпрацю. Якщо ви ще не партнер — залиште заявку.
        </div>
        <a href="/uk/travel-agencies" style={btn}>Стати партнером</a>
        <a href="/uk/login?next=/uk/partner/cabinet" style={{ color: '#94a3b8', fontSize: 13 }}>Увійти під іншою поштою →</a>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>Сталася помилка</div>
      <div style={{ maxWidth: 440 }}>Не вдалося відкрити кабінет. Спробуйте увійти ще раз.</div>
      <a href="/uk/login?next=/uk/partner/cabinet" style={btn}>Спробувати увійти</a>
    </div>
  );
}
