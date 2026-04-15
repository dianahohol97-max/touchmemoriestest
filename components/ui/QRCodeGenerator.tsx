'use client';

import { useState, useCallback, useEffect } from 'react';
import { QrCode, Download, Copy, Check, RefreshCw } from 'lucide-react';

interface QRCodeGeneratorProps {
  /** Compact mode — minimal UI for sidebar integration */
  compact?: boolean;
  /** Initial value */
  defaultValue?: string;
  /** Callback when QR URL changes */
  onQRUrlChange?: (url: string) => void;
  /** Show "Add to design" button */
  showAddToDesign?: boolean;
  /** Called when user clicks "Add to design" */
  onAddToDesign?: (qrImageUrl: string, value: string) => void;
  /** Custom label override */
  label?: string;
}

const QR_SIZES = [
  { label: 'S (150px)', value: 150 },
  { label: 'M (300px)', value: 300 },
  { label: 'L (600px)', value: 600 },
];

const QR_COLORS = [
  { label: 'Чорний', fg: '000000', bg: 'ffffff' },
  { label: 'Темно-синій', fg: '1e2d7d', bg: 'ffffff' },
  { label: 'Зелений', fg: '166534', bg: 'f0fdf4' },
  { label: 'Фіолетовий', fg: '6d28d9', bg: 'faf5ff' },
  { label: 'Білий/Прозорий', fg: 'ffffff', bg: '1a1a2e' },
];

export function QRCodeGenerator({
  compact = false,
  defaultValue = '',
  onQRUrlChange,
  showAddToDesign = false,
  onAddToDesign,
  label,
}: QRCodeGeneratorProps) {
  const [value, setValue] = useState(defaultValue);
  const [inputValue, setInputValue] = useState(defaultValue);
  const [size, setSize] = useState(300);
  const [colorPreset, setColorPreset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { fg, bg } = QR_COLORS[colorPreset];

  const qrUrl = value.trim()
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value.trim())}&color=${fg}&bgcolor=${bg}&qzone=1&format=png`
    : '';

  const handleGenerate = useCallback(() => {
    const v = inputValue.trim();
    if (!v) return;
    setValue(v);
    // Build qrUrl from the *new* value, not the stale state.
    const newQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(v)}&color=${fg}&bgcolor=${bg}&qzone=1&format=png`;
    if (onQRUrlChange) onQRUrlChange(newQrUrl);
  }, [inputValue, size, fg, bg, onQRUrlChange]);

  // Keep parent in sync if value/size/colors change
  useEffect(() => {
    if (onQRUrlChange) onQRUrlChange(qrUrl);
  }, [qrUrl, onQRUrlChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGenerate();
  };

  const handleDownload = async () => {
    if (!qrUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-code-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: open in new tab
      window.open(qrUrl, '_blank');
    }
    setDownloading(false);
  };

  const handleCopyUrl = async () => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToDesign = () => {
    if (!qrUrl || !onAddToDesign) return;
    onAddToDesign(qrUrl, value.trim());
  };

  if (compact) {
    return (
      <div style={{ padding: '12px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#1e2d7d', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
          <QrCode size={13} />
          {label || 'QR-код'}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="URL або текст для QR..."
            style={{ flex: 1, fontSize: 11, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, outline: 'none', color: '#1e293b' }}
          />
          <button
            onClick={handleGenerate}
            title="Згенерувати"
            style={{ padding: '6px 8px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* QR Preview */}
        {qrUrl ? (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code" style={{ width: 120, height: 120, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', padding: 4 }} />
          </div>
        ) : (
          <div style={{ height: 80, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>Введіть URL і натисніть ↵</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleDownload}
            disabled={!qrUrl || downloading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 6px', fontSize: 10, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: qrUrl ? 'pointer' : 'not-allowed', color: qrUrl ? '#1e2d7d' : '#94a3b8', opacity: qrUrl ? 1 : 0.5 }}
          >
            <Download size={10} /> PNG
          </button>
          {showAddToDesign && (
            <button
              onClick={handleAddToDesign}
              disabled={!qrUrl}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 6px', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 6, background: qrUrl ? '#1e2d7d' : '#e2e8f0', cursor: qrUrl ? 'pointer' : 'not-allowed', color: qrUrl ? '#fff' : '#94a3b8' }}
            >
              + Додати
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full-size version
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <QrCode size={18} color="#1e2d7d" />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#1e2d7d' }}>{label || 'Генератор QR-коду'}</span>
      </div>

      {/* Input */}
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        URL або текст
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 14 }}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="URL або текст для QR..."
          style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', color: '#1e293b' }}
        />
        <button
          onClick={handleGenerate}
          title="Генерувати QR-код"
          style={{ flexShrink: 0, padding: '8px 10px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
            Розмір
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {QR_SIZES.map(s => (
              <button key={s.value} onClick={() => { setSize(s.value); if (value) setValue(v => v); }}
                style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: `1px solid ${size === s.value ? '#1e2d7d' : '#e2e8f0'}`, borderRadius: 6, background: size === s.value ? '#1e2d7d' : '#fff', color: size === s.value ? '#fff' : '#475569', cursor: 'pointer' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
            Колір
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {QR_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setColorPreset(i)}
                title={c.label}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: `#${c.fg}`,
                  border: `2px solid ${colorPreset === i ? '#1e2d7d' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  outline: colorPreset === i ? '2px solid #93c5fd' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Preview + Actions */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="QR code"
              style={{ width: 120, height: 120, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 4 }}
            />
          ) : (
            <div style={{ width: 120, height: 120, background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 }}>
              <QrCode size={24} color="#94a3b8" />
              <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>Введіть URL вище</span>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleDownload}
            disabled={!qrUrl || downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: qrUrl ? 'pointer' : 'not-allowed', color: qrUrl ? '#1e2d7d' : '#94a3b8', opacity: qrUrl ? 1 : 0.5 }}
          >
            <Download size={14} />
            {downloading ? 'Завантаження...' : 'Скачати PNG'}
          </button>
          <button
            onClick={handleCopyUrl}
            disabled={!value.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: value.trim() ? 'pointer' : 'not-allowed', color: value.trim() ? '#374151' : '#94a3b8', opacity: value.trim() ? 1 : 0.5 }}
          >
            {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            {copied ? 'Скопійовано!' : 'Копіювати URL'}
          </button>
          {showAddToDesign && (
            <button
              onClick={handleAddToDesign}
              disabled={!qrUrl}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, background: qrUrl ? '#1e2d7d' : '#e2e8f0', cursor: qrUrl ? 'pointer' : 'not-allowed', color: qrUrl ? '#fff' : '#94a3b8' }}
            >
              <QrCode size={14} />
              Додати на дизайн
            </button>
          )}

          {qrUrl && (
            <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4, marginTop: 4 }}>
               QR-код можна скачати та додати у будь-який редактор як зображення
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default QRCodeGenerator;
