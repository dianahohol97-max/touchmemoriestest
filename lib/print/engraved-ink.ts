/**
 * The colour an ENGRAVED inscription is drawn in.
 *
 * Гравіювання has no ink: the напис is pressed into the velour / leatherette /
 * fabric and reads as a shade of the cover material itself. Every surface that
 * showed it — the editor canvas, the preview modal and the server-rendered
 * colour макет — used the stored decoration colour instead, which defaults to
 * gold. So a customer saw a golden напис, and so did the manager and the
 * designer working from the макет (Diana, 2026-08-11: «макет робить золотом на
 * велюрі… щоб просто не плуталися ні менеджери, ні дизайнери — мусить бути
 * гравіювання»).
 *
 * One helper, three call sites, so they cannot drift apart again.
 *
 * The shift follows the material's own luminance, because that is what the
 * press actually does: a light cover engraves DARKER (the pressed fibres take
 * shadow), a dark cover engraves LIGHTER. A fixed darkening would have made
 * the напис invisible on a black cover.
 */
export function engravedInk(coverHex: string): string {
  const h = String(coverHex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#6B5B7B';   // unparseable → a neutral pressed tone

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // 0.55 → noticeably darker; 1.55 with a floor → visibly lighter on dark
  // material, where multiplying alone would barely move a near-black value.
  const light = lum > 0.45;
  const shift = (v: number) => light
    ? Math.round(v * 0.55)
    : Math.min(255, Math.round(v * 1.55) + 48);

  return `#${[shift(r), shift(g), shift(b)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}
