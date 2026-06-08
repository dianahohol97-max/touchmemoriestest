'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { LayoutTemplate, Loader2, Download, RefreshCw } from 'lucide-react';

interface Sheet { name: string; product_type: string; url: string | null; }

export default function PrintSheetsCard({ orderId }: { orderId: string }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/print-sheets`);
      if (res.ok) { const d = await res.json(); setSheets(d.sheets || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/print-sheets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }),
      });
      const d = await res.json();
      if (res.ok && d.ok) {
        if (d.sheets > 0) toast.success(`Згенеровано аркушів: ${d.sheets}`);
        else toast.message('Немає фото нестандартного розміру для розкладки');
        await load();
      } else {
        toast.error(d.error || 'Помилка генерації');
      }
    } catch {
      toast.error('Помилка генерації');
    } finally {
      setBusy(false);
    }
  };

  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e9edf5', borderRadius: 14, padding: 20 };
  const titleStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#1e2d7d', margin: 0 };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={titleStyle}><LayoutTemplate size={20} /> Аркуші друку (фото / магніти)</h3>
        <button onClick={generate} disabled={busy} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none',
          background: '#1e2d7d', color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : sheets.length ? <RefreshCw size={15} /> : <LayoutTemplate size={15} />}
          {busy ? 'Генерую…' : sheets.length ? 'Перегенерувати' : 'Згенерувати'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', margin: '10px 0 0' }}>
        Автоматично складає завантажені клієнтом нестандартні фото та магніти в аркуші 300&nbsp;dpi (9×9 → 6 на аркуш тощо). Зазвичай готується саме після оформлення — кнопка лишається для перескладання.
      </p>

      {loading ? (
        <div style={{ padding: '14px 0', color: '#94a3b8', fontSize: 13 }}>Завантаження…</div>
      ) : sheets.length === 0 ? (
        <div style={{ padding: '14px 0', color: '#94a3b8', fontSize: 13 }}>Аркушів ще немає.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {sheets.map((s, i) => (
            <a key={i} href={s.url || '#'} target="_blank" rel="noopener noreferrer" download
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: '1px solid #e2e8f0', textDecoration: 'none', color: '#334155', fontSize: 13, fontWeight: 600,
                pointerEvents: s.url ? 'auto' : 'none', opacity: s.url ? 1 : 0.5,
              }}>
              <span>{s.name}</span>
              <Download size={16} color="#1e2d7d" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
