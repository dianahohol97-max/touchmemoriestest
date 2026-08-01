import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { deriveGeometry, normalizeSizeKey, safetyUnderstated, type SizeRow } from '@/lib/print/geometry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/print/geometry
 *
 * The derived sheet geometry for every book size, keyed by size key.
 *
 * The constructor needs to draw its canvas at the real sheet size and put the
 * trim guide where the guillotine actually lands. It used to carry its own copy
 * of the printer's table, which drifted from the DB and from the render
 * service's third copy. This is the single place all three now read.
 *
 * No auth: these are physical paper dimensions shown to every customer in the
 * constructor, not business data.
 */
export async function GET() {
  const admin = getAdminClient();

  let rows: SizeRow[] = [];
  try {
    const { data } = await admin
      .from('photobook_sizes')
      .select('name, width_cm, height_cm, spread_width_mm, spread_height_mm, cover_width_mm, cover_height_mm, bleed_top_mm, bleed_bottom_mm, bleed_left_mm, bleed_right_mm, cover_fold_margin_mm');
    rows = (data || []) as SizeRow[];
  } catch {
    /* fall through: deriveGeometry still answers from the built-in table */
  }

  // Every key the constructor can ask for — DB sizes plus the ones that only
  // exist in code (magazines, travel books, 23×23).
  const keys = new Set<string>([
    '20x20', '25x25', '20x30', '30x20', '30x30', '23x23', 'A4', 'magazine-A4', 'travelbook',
    ...rows.map((r) => normalizeSizeKey(String(r.name || ''))).filter(Boolean),
  ]);

  const sizes: Record<string, any> = {};
  const warnings: { sizeKey: string; message: string }[] = [];
  for (const key of keys) {
    const row = rows.find((r) => normalizeSizeKey(String(r.name || '')) === key) || null;
    const g = deriveGeometry(key, row);
    if (!g) continue;
    sizes[key] = g;
    const understated = safetyUnderstated(g, row);
    if (understated) warnings.push({ sizeKey: key, message: understated });
    // Zero overhang means the sheet is exactly the finished size — there is no
    // bleed at all, so any knife drift shows white paper. Worth saying out loud
    // rather than leaving it to be discovered on a printed book.
    if (g.overhang.x === 0 || g.overhang.y === 0) {
      warnings.push({
        sizeKey: key,
        message: `аркуш ${g.sheet.w}×${g.sheet.h} мм дорівнює готовому розвороту ${g.finished.w}×${g.finished.h} мм по ${g.overhang.x === 0 ? 'горизонталі' : 'вертикалі'} — припуску на обріз немає взагалі`,
      });
    }
  }

  return NextResponse.json({ sizes, warnings });
}
