'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BookPreviewModal } from '@/components/BookPreviewModal';
import CalendarPrintPage from '@/components/CalendarPrintPage';
import { resolveProjectSizeKey, pageMm, deriveGeometry } from '@/lib/print/geometry';
import { buildTrimGuides, buildCoverGuides, coverArtworkInset, cutsAtGutter, type TrimGuideSpec, type CoverGuideSpec } from '@/lib/print/trim-guides';
import { GOOGLE_FONTS_URL } from '@/lib/editor/constants';

/**
 * /print/[projectId] — clean, controls-free render of a saved book design.
 *
 * This page exists for the print pipeline: the headless render service opens it,
 * waits for fonts + images, and screenshots each page at the exact print size.
 * It is NOT meant for humans — it shows only the finished pages on a plain
 * background, with no editor chrome.
 *
 * Auth: the project data comes from /api/print/[projectId], which requires the
 * PRINT_RENDER_TOKEN. The token is passed through as ?token=... on this page and
 * forwarded to the API, so a random visitor without the token sees nothing.
 *
 * This first version reuses BookPreviewModal to prove the data round-trips and
 * renders. Pixel-exact sizing, photo-URL restoration from storage, and per-page
 * screenshotting come in the next steps.
 */
/**
 * Лінії обрізки поверх контентного розвороту — ТІЛЬКИ для людського перегляду
 * (адмінська кнопка «Переглянути макет» відкриває /print?guides=1). Рендер-
 * сервіс цього оверлея не бачить ніколи: він завжди приходить із ?w, а guides
 * вимикаються, щойно задана друкарська ширина, — тож у файли друку жодна
 * лінія потрапити не може.
 */
function TrimGuidesOverlay({ spec }: { spec: TrimGuideSpec }) {
  const cut = 'rgba(220,38,38,0.85)';
  const safe = 'rgba(37,99,235,0.75)';
  const dash = `2px dashed ${safe}`;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      {/* Лінія обрізу: ніж проходить по краю видимого розвороту. */}
      <div style={{ position: 'absolute', inset: 0, border: `2px solid ${cut}`, boxSizing: 'border-box' }} />
      {/* Різ по корінцю — лише в товарів, що друкуються посторінково. */}
      {spec.cutsAtGutter && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 0, borderLeft: `2px solid ${cut}` }} />
      )}
      {/* Безпечна зона: текст і обличчя мають лишатися всередині. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${spec.safetyPct.top}%`, borderTop: dash }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${spec.safetyPct.bottom}%`, borderBottom: dash }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${spec.safetyPct.left}%`, borderLeft: dash }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: `${spec.safetyPct.right}%`, borderRight: dash }} />
    </div>
  );
}

/**
 * Лінії обкладинки: різ по краю аркуша + помаранчева лінія загину, що
 * загортається на картон. Чесні ТІЛЬКИ тому, що в guides-режимі обкладинка
 * рендериться в пропорції друкарського аркуша (printPageW/printPageH/
 * printCoverMm — той самий шлях, яким ходить рендер-сервіс).
 */
function CoverGuidesOverlay({ spec }: { spec: CoverGuideSpec }) {
  const cut = 'rgba(220,38,38,0.85)';
  const fold = 'rgba(217,119,6,0.85)';
  const dash = `2px dashed ${fold}`;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      <div style={{ position: 'absolute', inset: 0, border: `2px solid ${cut}`, boxSizing: 'border-box' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${spec.foldPct.top}%`, borderTop: dash }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${spec.foldPct.bottom}%`, borderBottom: dash }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${spec.foldPct.left}%`, borderLeft: dash }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: `${spec.foldPct.right}%`, borderRight: dash }} />
    </div>
  );
}

export default function PrintPage() {
  const params = useParams();
  const search = useSearchParams();
  const projectId = String(params.projectId || '');
  const token = search.get('token') || '';

  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Sheet geometry from /api/print/[projectId] — needed for the cover, whose
  // proportion is its own (470×328) and not two pages side by side.
  const [geometry, setGeometry] = useState<any>(null);

  // The editor injects the Google Fonts stylesheet itself; this page never
  // did, so every custom font the customer picked fell back to a system face
  // on the print render — text came out in the wrong font and looked bold
  // when the editor showed it regular (Diana, 2026-08-05). The render service
  // awaits document.fonts.ready, so declaring the fonts here is sufficient
  // for the screenshot to wait for them.
  useEffect(() => {
    if (document.querySelector('link[data-tm-editor-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    link.setAttribute('data-tm-editor-fonts', '1');
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/print/${projectId}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body?.error || `HTTP ${res.status}`);
          return;
        }
        const body = await res.json();
        if (!cancelled) { setProject(body.project); setGeometry(body.geometry || null); }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, token]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#64748b' }}>
        Print render unavailable: {error}
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#94a3b8' }}>
        Loading design…
      </div>
    );
  }

  // Unpack the saved design into the shape BookPreviewModal expects.
  const pages = project.pages_data || [];

  // ── Wall calendar branch ────────────────────────────────────────────────
  // Calendars are an HTML/SVG composition, not book spreads. Render one page
  // (cover or a month) per [data-print-page] using the saved config + signed
  // photo URLs, sized to the exact print pixels the render service requests.
  if (project.product_type === 'wall-calendar') {
    const cfg = Array.isArray(pages) ? pages[0] : pages;
    const calPhotos = (project.uploaded_photos || []).map((p: any) => ({
      id: p.id, preview: p.preview || '', width: p.width || 0, height: p.height || 0,
    }));
    const monthCount = Array.isArray(cfg?.pages) ? cfg.pages.length : 12;
    const totalPages = monthCount + 1; // cover + months
    const fmt = String(project.format || '').toLowerCase();
    const isA3 = fmt.includes('a3') || fmt.includes('29.7×42') || fmt.includes('29,7');
    const aspect = isA3 ? 297 / 420 : 210 / 297;

    const pageParam = search.get('page');
    const single = pageParam !== null ? parseInt(pageParam, 10) : null;
    const wParam = search.get('w');
    const printW = wParam ? parseInt(wParam, 10) : 1240;
    const printH = Math.round(printW / aspect);
    const toRender = single !== null ? [single] : Array.from({ length: totalPages }, (_, i) => i);

    return (
      <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: single !== null ? 0 : 24 }}>
        <style>{`[class*="cookie" i],[class*="newsletter" i],[class*="toast" i],[aria-label*="Notification" i]{display:none!important;}`}</style>
        {toRender.map((idx) => (
          <CalendarPrintPage key={idx} config={cfg} photos={calPhotos} W={printW} H={printH} pageIndex={idx} />
        ))}
      </div>
    );
  }

  const coverState = project.cover_data || {};
  const overlays = project.overlays_data || {};
  const config = overlays.config || {};
  const photos = (project.uploaded_photos || []).map((p: any) => ({
    id: p.id,
    preview: p.preview || '', // photo URLs are restored from storage in the next step
    width: p.width || 0,
    height: p.height || 0,
  }));

  // Derive the proportion (page aspect) the editor used. NEVER guess: a silent
  // '20x20' fallback made the render service capture square spreads for a
  // travelbook ('captured 4963x2481, target 4961x3602' in the Railway logs) —
  // geometrically wrong print files that look like a successful render.
  // Order of truth: saved config → projects.format → the product's fixed size.
  // Resolved by the SAME rule the render service uses, so the two can never
  // disagree about what a project's size is. They did on TM-001108: the service
  // resolved the magazine from its slug while this page's fallback listed only
  // travelbook, so a paid order rendered nothing and showed this red box.
  const sizeKey = resolveProjectSizeKey({
    product_type: project.product_type,
    format: project.format,
    config,
  });
  const page = sizeKey ? pageMm(sizeKey) : null;
  if (!page) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#dc2626' }}>
        Print render unavailable: розмір виробу не збережено в макеті
        (config.selectedSize / projects.format порожні, тип «{String(project.product_type || '?')}»).
        Рендер зупинено, щоб не віддати спотворений файл у друк.
      </div>
    );
  }
  // BookPreviewModal expects CENTIMETRES here, not millimetres: besides the
  // aspect it uses propW to compute px-per-mm for the cover decoration
  // (`pageW / (propW * 10)`), so passing mm would shrink an acrylic plate
  // tenfold. Keep the unit the old '20x30' parse produced.
  const pw = page.w / 10;
  const ph = page.h / 10;

  // Spread count mirrors BookPreviewModal: cover (0) + content spreads.
  const spreadCount = Math.ceil((pages.length - 1) / 2) + 1;

  // ?page=N renders just that spread (what the render service requests per
  // screenshot). No page param → render every spread stacked, for human review.
  const pageParam = search.get('page');
  const singleSpread = pageParam !== null ? parseInt(pageParam, 10) : null;
  // ?w=N fixes the exact pixel width PER HALF PAGE — the render service passes
  // the 300-DPI print width so the screenshot comes out at print resolution.
  const wParam = search.get('w');
  const printPageW = wParam ? parseInt(wParam, 10) : undefined;
  // ?guides=1 — лінії обрізки для людського перегляду з адмінки. Подвійний
  // запобіжник: ІГНОРУЄТЬСЯ, щойно задана друкарська ширина ?w (так ходить
  // тільки рендер-сервіс), тож потрапити у файли друку лінії не можуть навіть
  // помилково скопійованим посиланням.
  const guidesRequested = search.get('guides') === '1' && !printPageW;
  const guideGeometry = (geometry?.finished?.w > 0 && geometry?.safety) ? geometry : deriveGeometry(sizeKey);
  const trimGuides = guidesRequested && guideGeometry
    ? buildTrimGuides(guideGeometry, {
        productSlug: config.productSlug,
        productType: project.product_type,
      })
    : null;
  const coverGuides = trimGuides && guideGeometry ? buildCoverGuides(guideGeometry) : null;
  // Готовий файл обкладинки (шаблони тревел-буків/журналів) сідає ДО лінії
  // загину, а поля добудовує розмита копія самого себе — інакше шаблон,
  // намальований «впритул», втрачав заголовок за кантом. Це ПРОДУКЦІЙНА
  // поведінка: діє і для скріншотів рендер-сервіса, не лише для guides.
  const artworkGeometry = (geometry?.cover?.w > 0 ? geometry : null) || deriveGeometry(sizeKey);
  const artworkInset = cutsAtGutter(config.productSlug, project.product_type)
    ? coverArtworkInset(artworkGeometry)
    : null;
  // Щоб лінії загину не брехали, обкладинка в guides-режимі рендериться в
  // пропорції ДРУКАРСЬКОГО аркуша — тим самим механізмом, яким її знімає
  // рендер-сервіс, лише з екранною шириною замість 300-DPI. Контентні
  // розвороти лишаються як були.
  const guidesCoverW = coverGuides
    ? Math.min(Math.floor(((typeof window !== 'undefined' ? window.innerWidth : 1200) * 0.92 - 8) / 2), 560)
    : undefined;
  const guidesCoverH = coverGuides && guidesCoverW
    ? Math.round(guidesCoverW * 2 * (coverGuides.cover.h / coverGuides.cover.w))
    : undefined;
  const spreadsToRender = singleSpread !== null
    ? [singleSpread]
    : Array.from({ length: spreadCount }, (_, i) => i);

  // The COVER sheet has its own proportion — 470×328 mm for a 20×30 book, not
  // two 200×300 pages side by side. The customer designs on exactly that sheet
  // (the constructor draws the fold-in guide at 20/18 mm of it), but this page
  // derived the cover's height from the PAGE aspect, so a 470×328 design was
  // laid out as 400×300 and the render service then padded the fold-in with
  // pixels it invented — TM-001101's wrap carries a squashed second copy of the
  // artwork, which is why the cover reads as overlapping itself.
  //
  // Given the exact print width per half sheet, the cover's height follows from
  // its own millimetres: h = (w * 2) * coverH / coverW.
  const coverMm = geometry?.cover?.w > 0 && geometry?.cover?.h > 0 ? geometry.cover : null;
  const coverPrintH = printPageW && coverMm
    ? Math.round(printPageW * 2 * (coverMm.h / coverMm.w))
    : undefined;

  // Refuse rather than fall back. Without coverMm the cover height silently
  // dropped to the PAGE aspect — a 470×328 sheet drawn as 471×332 — and only
  // the render service's 1 % aspect tolerance caught it (TM-001108). A product
  // whose page proportion happens to land INSIDE that tolerance would sail
  // through and reach the printer as a wrong-size cover. At print resolution
  // (?w given) an unknown cover sheet is a stop, not a guess.
  if (printPageW && !coverMm && spreadsToRender.includes(0)) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#dc2626' }}>
        Print render unavailable: не вдалося визначити розмір аркуша обкладинки
        для «{sizeKey}». Рендер зупинено, щоб обкладинка не пішла в друк
        у пропорції сторінки замість пропорції аркуша.
      </div>
    );
  }

  // isPrinted may not be saved as a flag in older/newer configs — derive it from
  // the cover type ("Друкована" = printed cover) too, otherwise the printed-cover
  // photo renders down the wrong (velour/fabric) branch and the cover looks empty.
  //
  // Travelbooks, magazines and wishbooks ONLY ever ship a printed photo cover —
  // there is no fabric/velour variant. Some saved configs (e.g. TM-001091) carry
  // neither isPrinted nor a cover-type string, so the two checks above both fail
  // and the cover renders BLANK. Force printed for those product types, mirroring
  // the PRODUCT_SIZE fallback above (derive from product_type when config is empty).
  const PRINTED_COVER_TYPES = new Set(['travelbook', 'magazine', 'magazine-a4', 'journal', 'zhurnal', 'wishbook']);
  const coverTypeStr = String(config.selectedCoverType || config.coverType || '');
  // product_type alone is NOT enough: editor drafts were historically saved
  // with a hardcoded product_type='photobook' regardless of the real product,
  // so a travel book draft failed every check here, rendered down the
  // fabric-cover branch and IGNORED its ready cover (printedBgImage) — the
  // «Тернопіль» cover came out as a blank sheet with a «ЗАДНЯ» watermark.
  // The saved config carries the true slug, so derive from it too.
  const productSlugStr = String(config.productSlug || '').toLowerCase();
  const isPrintedCover = !!config.isPrinted
    || /друков|printed/i.test(coverTypeStr)
    || PRINTED_COVER_TYPES.has(String(project.product_type || '').toLowerCase())
    || /travel|magazine|zhurnal|fotozhurnal|journal|wish|guest|pobazhan/.test(productSlugStr);

  const common = {
    pages, photos, propW: pw, propH: ph,
    freeSlots: overlays.freeSlots || {},
    coverState,
    isPrinted: isPrintedCover,
    selectedCoverType: config.selectedCoverType || config.coverType || '',
    // The saved config stores the chosen colour under selectedCoverColor (the
    // editor computes effectiveCoverColor only at runtime, so it's absent here).
    // Reading effectiveCoverColor alone yielded '' → resolveCoverColor fell back
    // to the fabric default beige (#C4AA88) instead of the ordered red — hence
    // TM-001066's cover rendered beige. Fall back through the real stored fields.
    effectiveCoverColor: config.effectiveCoverColor || config.selectedCoverColor
      || config.selectedLeatherColor || config.selectedVelourColor || config.coverColor || '',
    onClose: () => {},
    pageBgs: overlays.pageBgs || {},
    pageFrames: overlays.pageFrames || {},
    pageShapes: overlays.pageShapes || {},
    pageStickers: overlays.pageStickers || {},
    qrOverlays: overlays.qrOverlays || {},
    slotGap: config.slotGap ?? 4,
    pageGap: config.pageGap ?? 0,
    pageBorder: config.pageBorder || { width: 0, color: '#e2e8f0' },
    isSpreadMode: config.isSpreadMode ?? true,
    hasKalka: !!config.hasKalka,
  };

  return (
    <div data-print-root style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 24 }}>
      {/* The print surface must contain only the book. The cookie banner hides
          itself on /print (see CookieBanner). This also hides newsletter popups
          and toasts as a safety net so nothing floats into the screenshot. */}
      <style>{`
        [class*="newsletter" i], [class*="toast" i],
        [aria-label*="Notification" i] { display: none !important; }
      `}</style>
      {trimGuides && (
        <div style={{ maxWidth: 900, width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', fontFamily: 'sans-serif', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Лінії обрізки цього товару</div>
          {trimGuides.notes.map((n, i) => <div key={i}>{n}</div>)}
          {coverGuides?.notes.map((n, i) => <div key={'c' + i}>{n}</div>)}
        </div>
      )}
      {spreadsToRender.map((idx) => (
        <BookPreviewModal
          key={idx}
          {...common}
          printSpreadIndex={idx}
          printPageW={idx === 0 && coverGuides ? guidesCoverW : printPageW}
          printPageH={idx === 0 ? (coverGuides ? guidesCoverH : coverPrintH) : undefined}
          printCoverMm={idx === 0 ? (coverGuides ? coverGuides.cover : coverMm) : undefined}
          coverArtworkInset={artworkInset}
          printOverlay={
            idx === 0
              ? (coverGuides ? <CoverGuidesOverlay spec={coverGuides} /> : undefined)
              : (trimGuides ? <TrimGuidesOverlay spec={trimGuides} /> : undefined)
          }
        />
      ))}
    </div>
  );
}
