'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Upload, Download, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Auto-imposition tool: drop custom photos, pick a size, get a print-ready
// sheet with the photos auto-cropped (center-crop, fill) and tiled in a grid.
// Counts-per-sheet come from the real product data (кратність):
//   5×7.5→12, 6×9→10, 7.5×10→8, 9×9→6, 10×10→6, polaroid 7.6×10.1→8, mini 8.6×5.4→10
// ---------------------------------------------------------------------------

const DPI = 300;
const PX_PER_MM = DPI / 25.4; // ≈ 11.811

interface SizePreset {
  id: string;
  label: string;
  w: number; // mm
  h: number; // mm
  perSheet: number;
  group: 'print' | 'magnet' | 'polaroid';
}

const SIZE_PRESETS: SizePreset[] = [
  { id: '5x7.5',  label: '5 × 7.5 см',  w: 50,  h: 75,  perSheet: 12, group: 'print' },
  { id: '6x9',    label: '6 × 9 см',    w: 60,  h: 90,  perSheet: 10, group: 'print' },
  { id: '7.5x10', label: '7.5 × 10 см', w: 75,  h: 100, perSheet: 8,  group: 'print' },
  { id: '9x9',    label: '9 × 9 см',    w: 90,  h: 90,  perSheet: 6,  group: 'print' },
  { id: '10x10',  label: '10 × 10 см',  w: 100, h: 100, perSheet: 6,  group: 'print' },
  { id: 'pol',    label: 'Полароїд 7.6 × 10.1 см', w: 76, h: 101, perSheet: 8,  group: 'polaroid' },
  { id: 'polmini',label: 'Полароїд міні 8.6 × 5.4 см', w: 86, h: 54, perSheet: 10, group: 'polaroid' },
];

type SheetMode = 'grid' | '30x20' | 'a4';
const SHEET_FIXED: Record<Exclude<SheetMode, 'grid'>, { w: number; h: number; label: string }> = {
  '30x20': { w: 300, h: 200, label: '30 × 20 см' },
  'a4':    { w: 297, h: 210, label: 'A4 (29.7 × 21 см)' },
};

interface LoadedPhoto { id: string; name: string; url: string; img: HTMLImageElement; }

// Choose cols×rows for a given count, preferring a landscape block (~3:2).
function bestGrid(count: number, cellW: number, cellH: number) {
  let best = { cols: count, rows: 1, score: Infinity };
  for (let rows = 1; rows <= count; rows++) {
    if (count % rows !== 0) continue;
    const cols = count / rows;
    const w = cols * cellW, h = rows * cellH;
    const score = Math.abs(w / h - 1.5); // target landscape 3:2
    if (score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

// Center-crop (cover) draw of an image into a destination rect.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  if (dw <= 0 || dh <= 0) return;
  const ir = img.width / img.height;
  const tr = dw / dh;
  let sx: number, sy: number, sw: number, sh: number;
  if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

export default function KadruvannyaPage() {
  const [photos, setPhotos] = useState<LoadedPhoto[]>([]);
  const [presetId, setPresetId] = useState('9x9');
  const [customW, setCustomW] = useState(90);
  const [customH, setCustomH] = useState(90);
  const [customCount, setCustomCount] = useState(6);
  const [useCustom, setUseCustom] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('grid');
  const [gapMm, setGapMm] = useState(0);
  const [marginMm, setMarginMm] = useState(5);
  const [borderMm, setBorderMm] = useState(0);
  const [cutLines, setCutLines] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const preset = SIZE_PRESETS.find(p => p.id === presetId)!;

  // Active cell + count (preset or custom).
  const cell = useMemo(() => {
    if (useCustom) {
      const w = Math.max(10, customW), h = Math.max(10, customH);
      const count = Math.max(1, Math.min(60, customCount));
      return { w, h, count, label: `${customW} × ${customH} см` };
    }
    return { w: preset.w, h: preset.h, count: preset.perSheet, label: preset.label };
  }, [useCustom, customW, customH, customCount, preset]);

  // Full layout geometry (mm).
  const layout = useMemo(() => {
    const { cols, rows } = bestGrid(cell.count, cell.w, cell.h);
    const gridW = cols * cell.w + (cols - 1) * gapMm;
    const gridH = rows * cell.h + (rows - 1) * gapMm;

    let sheetW: number, sheetH: number, offX: number, offY: number, overflow = false;
    if (sheetMode === 'grid') {
      sheetW = gridW + 2 * marginMm;
      sheetH = gridH + 2 * marginMm;
      offX = marginMm; offY = marginMm;
    } else {
      const f = SHEET_FIXED[sheetMode];
      // Orient the fixed sheet to match the block (landscape vs portrait).
      const landscape = gridW >= gridH;
      sheetW = landscape ? Math.max(f.w, f.h) : Math.min(f.w, f.h);
      sheetH = landscape ? Math.min(f.w, f.h) : Math.max(f.w, f.h);
      offX = (sheetW - gridW) / 2;
      offY = (sheetH - gridH) / 2;
      overflow = gridW > sheetW + 0.5 || gridH > sheetH + 0.5;
    }
    return { cols, rows, gridW, gridH, sheetW, sheetH, offX, offY, overflow, count: cell.count };
  }, [cell, gapMm, marginMm, sheetMode]);

  const pages = useMemo(() => {
    const out: LoadedPhoto[][] = [];
    for (let i = 0; i < photos.length; i += layout.count) out.push(photos.slice(i, i + layout.count));
    return out;
  }, [photos, layout.count]);

  // Shared draw routine for preview + export.
  const drawPage = useCallback((ctx: CanvasRenderingContext2D, pagePhotos: LoadedPhoto[], pxmm: number) => {
    const { cols, sheetW, sheetH, offX, offY } = layout;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW * pxmm, sheetH * pxmm);
    pagePhotos.forEach((p, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const cellX = offX + c * (cell.w + gapMm);
      const cellY = offY + r * (cell.h + gapMm);
      drawCover(
        ctx, p.img,
        (cellX + borderMm) * pxmm, (cellY + borderMm) * pxmm,
        (cell.w - 2 * borderMm) * pxmm, (cell.h - 2 * borderMm) * pxmm,
      );
      if (cutLines) {
        ctx.strokeStyle = 'rgba(120,120,120,0.6)';
        ctx.lineWidth = Math.max(1, 0.2 * pxmm);
        ctx.strokeRect(cellX * pxmm, cellY * pxmm, cell.w * pxmm, cell.h * pxmm);
      }
    });
  }, [layout, cell, gapMm, borderMm, cutLines]);

  // Render previews whenever inputs change.
  useEffect(() => {
    const maxW = 720;
    const scale = Math.min(maxW / (layout.sheetW * PX_PER_MM), 1);
    const pxmm = PX_PER_MM * scale;
    pages.forEach((pagePhotos, idx) => {
      const canvas = previewRefs.current[idx];
      if (!canvas) return;
      canvas.width = Math.round(layout.sheetW * pxmm);
      canvas.height = Math.round(layout.sheetH * pxmm);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingQuality = 'high';
      drawPage(ctx, pagePhotos, pxmm);
    });
  }, [pages, layout, drawPage]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    arr.forEach(file => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setPhotos(prev => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, url, img }]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast.error(`Не вдалося відкрити ${file.name}`); };
      img.src = url;
    });
  }, []);

  const removePhoto = (id: string) => setPhotos(prev => {
    const target = prev.find(p => p.id === id);
    if (target) URL.revokeObjectURL(target.url);
    return prev.filter(p => p.id !== id);
  });
  const clearAll = () => { photos.forEach(p => URL.revokeObjectURL(p.url)); setPhotos([]); };

  const exportPdf = async () => {
    if (!pages.length) { toast.error('Спочатку додай фото'); return; }
    setExporting(true);
    try {
      const { sheetW, sheetH } = layout;
      const orientation = sheetW >= sheetH ? 'l' : 'p';
      const doc = new jsPDF({ orientation, unit: 'mm', format: [sheetW, sheetH], compress: true });
      const off = document.createElement('canvas');
      off.width = Math.round(sheetW * PX_PER_MM);
      off.height = Math.round(sheetH * PX_PER_MM);
      const ctx = off.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage([sheetW, sheetH], orientation);
        drawPage(ctx, pages[i], PX_PER_MM);
        doc.addImage(off.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, sheetW, sheetH);
      }
      doc.save(`kadr-${useCustom ? 'custom' : preset.id}-${photos.length}sht.pdf`);
      toast.success(`Готово: ${pages.length} арк. · ${photos.length} фото`);
    } catch (e) {
      console.error(e);
      toast.error('Помилка експорту PDF');
    } finally {
      setExporting(false);
    }
  };

  // ----- styles -----
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 };
  const inputS: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 600, background: '#fff' };
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e9edf5', borderRadius: 14, padding: 18 };

  return (
    <div style={{ padding: '8px 4px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1e2d7d', marginBottom: 4 }}>Кадрування для друку</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 22 }}>
        Додай фото, обери розмір — кожне фото автоматично обріжеться по центру під цей розмір і розкладеться на аркуш. На виході — готовий PDF 300&nbsp;dpi.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 22, alignItems: 'start' }}>
        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <label style={label}>Розмір</label>
            <select value={useCustom ? 'custom' : presetId}
              onChange={e => { if (e.target.value === 'custom') setUseCustom(true); else { setUseCustom(false); setPresetId(e.target.value); } }}
              style={inputS}>
              <optgroup label="Фотодрук / магніти">
                {SIZE_PRESETS.filter(p => p.group !== 'polaroid').map(p => (
                  <option key={p.id} value={p.id}>{p.label} — {p.perSheet} шт/арк</option>
                ))}
              </optgroup>
              <optgroup label="Полароїд">
                {SIZE_PRESETS.filter(p => p.group === 'polaroid').map(p => (
                  <option key={p.id} value={p.id}>{p.label} — {p.perSheet} шт/арк</option>
                ))}
              </optgroup>
              <option value="custom">Свій розмір…</option>
            </select>

            {useCustom && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><label style={label}>Ш, см</label><input type="number" min={1} step={0.1} value={customW} onChange={e => setCustomW(+e.target.value)} style={inputS} /></div>
                <div><label style={label}>В, см</label><input type="number" min={1} step={0.1} value={customH} onChange={e => setCustomH(+e.target.value)} style={inputS} /></div>
                <div><label style={label}>Шт/арк</label><input type="number" min={1} max={60} value={customCount} onChange={e => setCustomCount(+e.target.value)} style={inputS} /></div>
              </div>
            )}
            {useCustom && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Розміри в сантиметрах.</p>}
          </div>

          <div style={card}>
            <label style={label}>Аркуш</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['grid', 'По сітці'], ['30x20', '30×20'], ['a4', 'A4']] as [SheetMode, string][]).map(([m, t]) => (
                <button key={m} onClick={() => setSheetMode(m)} style={{
                  flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid', borderColor: sheetMode === m ? '#1e2d7d' : '#e2e8f0',
                  background: sheetMode === m ? '#1e2d7d' : '#fff', color: sheetMode === m ? '#fff' : '#475569',
                }}>{t}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
              «По сітці» — аркуш точно під набір фото. «30×20» / «A4» — фото по центру стандартного аркуша.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <div><label style={label}>Відступ між фото, мм</label><input type="number" min={0} max={20} value={gapMm} onChange={e => setGapMm(Math.max(0, +e.target.value))} style={inputS} /></div>
              <div><label style={label}>Поле аркуша, мм</label><input type="number" min={0} max={30} value={marginMm} onChange={e => setMarginMm(Math.max(0, +e.target.value))} style={inputS} /></div>
              <div><label style={label}>Біла рамка, мм</label><input type="number" min={0} max={10} step={0.5} value={borderMm} onChange={e => setBorderMm(Math.max(0, +e.target.value))} style={inputS} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer', paddingBottom: 8 }}>
                  <input type="checkbox" checked={cutLines} onChange={e => setCutLines(e.target.checked)} /> Лінії різу
                </label>
              </div>
            </div>
          </div>

          <div style={{ ...card, background: '#f8fafc' }}>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
              <div><b>{cell.label}</b> · {layout.cols}×{layout.rows} = {layout.count} шт/арк</div>
              <div>Аркуш: {(layout.sheetW / 10).toFixed(1)} × {(layout.sheetH / 10).toFixed(1)} см</div>
              <div>Фото: {photos.length} · Аркушів: {pages.length || 0}</div>
            </div>
            {layout.overflow && (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
                Набір не влазить у цей аркуш — обери «По сітці» або зменши кількість.
              </div>
            )}
            <button onClick={exportPdf} disabled={exporting || !photos.length} style={{
              marginTop: 14, width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: photos.length ? 'pointer' : 'not-allowed',
              background: photos.length ? '#1e2d7d' : '#cbd5e1', color: '#fff', fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {exporting ? 'Готую PDF…' : 'Завантажити PDF'}
            </button>
          </div>
        </div>

        {/* Upload + preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#1e2d7d' : '#cbd5e1'}`, borderRadius: 14, padding: '26px',
              textAlign: 'center', cursor: 'pointer', background: dragOver ? '#eef2ff' : '#fff',
            }}>
            <Upload size={26} color="#1e2d7d" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 800, color: '#1e2d7d', fontSize: 15 }}>Перетягни фото сюди або натисни</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>JPG / PNG, можна багато одразу</div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {photos.length > 0 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#64748b' }}>{photos.length} фото</span>
                <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Trash2 size={14} /> Очистити
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {photos.map(p => (
                  <div key={p.id} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => removePhoto(p.id)} style={{
                      position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none',
                      background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: '18px', padding: 0,
                    }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pages.map((_, idx) => (
                <div key={idx} style={card}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 8 }}>Аркуш {idx + 1} / {pages.length}</div>
                  <canvas ref={el => { previewRefs.current[idx] = el; }} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', color: '#94a3b8', padding: 40 }}>
              <ImageIcon size={30} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              Превʼю аркуша зʼявиться після додавання фото
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
