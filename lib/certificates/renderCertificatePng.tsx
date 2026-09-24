/**
 * Server-side PNG of the brand gift certificate (Canva design, 1200×800 @2x).
 *
 * Rendered with Satori (next/og) from static TTFs in lib/certificates/fonts,
 * so the output is identical everywhere — no browser, no html2canvas, no
 * network for fonts. The admin «Переглянути» and «Завантажити PNG» buttons
 * both hit /api/admin/certificates/[code]/png, which calls this.
 *
 * Layout is expressed in the 1200×800 design grid and multiplied by SCALE.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const CERT_W = 1200;
export const CERT_H = 800;
const SCALE = 2;

const BLUE = '#263A99';
const CREAM = '#F7F5EF';
const INK = '#0f1a4d';

export type CertificateForRender = {
  code: string;
  certificate_type: 'money' | 'product';
  amount?: number | null;
  product_name?: string | null;
  valid_until: string;
};

const FONT_DIR = path.join(process.cwd(), 'lib', 'certificates', 'fonts');
let fontCache: Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: 'normal' }>> | null = null;

function loadFonts() {
  if (!fontCache) {
    fontCache = (async () => {
      const read = async (file: string) => {
        const b = await readFile(path.join(FONT_DIR, file));
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
      };
      return [
        { name: 'Bodoni Moda', data: await read('BodoniModa-Display.ttf'), weight: 400 as const, style: 'normal' as const },
        { name: 'Alex Brush', data: await read('AlexBrush-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
        { name: 'Montserrat', data: await read('Montserrat-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
        { name: 'Montserrat', data: await read('Montserrat-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
      ];
    })();
  }
  return fontCache;
}

export function formatValidUntil(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const s = (n: number) => n * SCALE;

/** Row of round dots — Satori has no dotted borders, so we draw them. */
function Dots({ width, dot = 5, gap = 6 }: { width: number; dot?: number; gap?: number }) {
  const n = Math.floor((width + gap) / (dot + gap));
  return (
    <div style={{ display: 'flex', gap: s(gap), justifyContent: 'center' }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ width: s(dot), height: s(dot), borderRadius: s(dot), background: CREAM }} />
      ))}
    </div>
  );
}

export async function renderCertificatePng(cert: CertificateForRender): Promise<Buffer> {
  const fonts = await loadFonts();
  const valueLine =
    cert.certificate_type === 'money'
      ? `НА ${cert.amount ?? 0} ГРН`
      : String(cert.product_name || 'СЕРТИФІКАТ НА ПРОДУКТ').toUpperCase();
  const validUntil = formatValidUntil(cert.valid_until);

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: s(CERT_W),
          height: s(CERT_H),
          background: BLUE,
          fontFamily: 'Montserrat',
          color: CREAM,
        }}
      >
        {/* Frame */}
        <div
          style={{
            position: 'absolute',
            left: s(140),
            top: s(92),
            width: s(CERT_W - 280),
            height: s(CERT_H - 92 - 105),
            border: `${s(4)}px solid ${CREAM}`,
            borderRadius: s(22),
          }}
        />

        {/* Tab with gift icon */}
        <div
          style={{
            position: 'absolute',
            left: s(CERT_W / 2 - 92),
            top: 0,
            width: s(184),
            height: s(226),
            background: CREAM,
            borderBottomLeftRadius: s(92),
            borderBottomRightRadius: s(92),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: s(6),
          }}
        >
          <svg width={s(104)} height={s(104)} viewBox="0 0 64 64" fill="none" stroke={BLUE} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="26" width="48" height="10" rx="1.5" />
            <path d="M12 36v20a2 2 0 0 0 2 2h36a2 2 0 0 0 2-2V36" />
            <path d="M32 26v32" />
            <path d="M32 26c-6 0-14-1-14-8 0-4 3-6 6-6 5 0 8 9 8 14z" />
            <path d="M32 26c6 0 14-1 14-8 0-4-3-6-6-6-5 0-8 9-8 14z" />
          </svg>
        </div>

        {/* Vertical code (reads bottom → top, like the Canva original) */}
        <div
          style={{
            position: 'absolute',
            right: s(82),
            top: s(128),
            transformOrigin: 'right top',
            transform: 'rotate(-90deg)',
            display: 'flex',
            fontWeight: 700,
            fontSize: s(20),
            letterSpacing: s(3),
            whiteSpace: 'nowrap',
          }}
        >
          {cert.code}
        </div>

        {/* GIFT / certificate lockup */}
        <div style={{ position: 'absolute', left: 0, top: s(226), width: s(CERT_W), height: s(230), display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Bodoni Moda',
              fontWeight: 400,
              fontSize: s(212),
              lineHeight: 1,
              letterSpacing: s(22),
              color: CREAM,
            }}
          >
            GIFT
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, top: s(268), width: s(CERT_W), display: 'flex', justifyContent: 'center', paddingLeft: s(40) }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Alex Brush',
              fontWeight: 400,
              fontSize: s(92),
              lineHeight: 1,
              color: INK,
              transform: 'rotate(-5deg)',
            }}
          >
            certificate
          </div>
        </div>

        {/* Amount */}
        <div style={{ position: 'absolute', left: 0, top: s(470), width: s(CERT_W), display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontWeight: 700, fontSize: s(32), letterSpacing: s(6), lineHeight: 1 }}>{valueLine}</div>
        </div>
        <div style={{ position: 'absolute', left: 0, top: s(522), width: s(CERT_W), display: 'flex', justifyContent: 'center' }}>
          <Dots width={380} dot={4} gap={6} />
        </div>

        {/* Validity */}
        <div style={{ position: 'absolute', left: 0, top: s(552), width: s(CERT_W), display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: s(16) }}>
          <div style={{ display: 'flex', fontWeight: 500, fontSize: s(21), letterSpacing: s(3), lineHeight: 1, paddingBottom: s(10) }}>дійсний до</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(6) }}>
            <div style={{ display: 'flex', fontWeight: 700, fontSize: s(28), letterSpacing: s(4), lineHeight: 1 }}>{validUntil}</div>
            <Dots width={Math.max(230, validUntil.length * 26)} dot={4} gap={6} />
          </div>
        </div>

        {/* Instagram handle under the frame */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: s(34),
            width: s(CERT_W),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: s(14),
            color: INK,
            fontWeight: 700,
            fontSize: s(23),
            letterSpacing: s(7),
          }}
        >
          <svg width={s(34)} height={s(34)} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.3" cy="6.7" r="1" fill={INK} stroke="none" />
          </svg>
          <div style={{ display: 'flex' }}>TOUCH.MEMORIES</div>
        </div>
      </div>
    ),
    { width: s(CERT_W), height: s(CERT_H), fonts },
  );
  return Buffer.from(await image.arrayBuffer());
}
