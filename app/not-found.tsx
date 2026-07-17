import Link from 'next/link';

// Custom 404 replacing Next's bare default page. Next automatically serves a
// 404 status + noindex for not-found, so no robots metadata is needed here.
// Kept dependency-free (no Navigation/Footer) so it renders even when a bad
// URL breaks locale detection.
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '24px', fontFamily: 'var(--font-primary, sans-serif)' }}>
      <div style={{ textAlign: 'center', maxWidth: '520px' }}>
        <div style={{ fontFamily: 'var(--font-heading, sans-serif)', fontSize: '96px', fontWeight: 900, color: '#263A99', lineHeight: 1 }}>404</div>
        <h1 style={{ fontFamily: 'var(--font-heading, sans-serif)', fontSize: '28px', fontWeight: 900, color: '#263A99', margin: '16px 0' }}>
          Такої сторінки не існує
        </h1>
        <p style={{ fontSize: '17px', color: '#64748b', lineHeight: 1.6, marginBottom: '32px' }}>
          Можливо, посилання застаріло або в адресі є помилка. Поверніться на головну сторінку або перегляньте наш каталог фотовиробів.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/uk" style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: '#263A99', color: 'white', borderRadius: '9999px', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}>
            Повернутися на головну
          </Link>
          <Link href="/uk/catalog" style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: 'white', color: '#263A99', border: '2px solid #263A99', borderRadius: '9999px', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}>
            Перейти до каталогу
          </Link>
        </div>
      </div>
    </div>
  );
}
