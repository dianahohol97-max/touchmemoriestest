'use client';
import { useState, useRef, useEffect } from 'react';
import { FONT_GROUPS, FONT_DATA } from '@/lib/editor/constants';
import { ChevronDown } from 'lucide-react';

const fontCyrMap = new Map(FONT_DATA.map(f => [f.name, f.cyr]));

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isCyr = fontCyrMap.get(value) ?? true;
  const preview = isCyr ? 'Весілля' : 'Wedding';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Selected font display */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6,
          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 4,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
          <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, minWidth: 60 }}>{value.length > 10 ? value.slice(0, 9) + '…' : value}</span>
          <span style={{ fontFamily: value, fontSize: 14, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {preview}
          </span>
        </div>
        <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)', maxHeight: 320, overflowY: 'auto',
          marginTop: 4,
        }}>
          {FONT_GROUPS.map(g => (
            <div key={g.group}>
              <div style={{
                padding: '6px 10px', fontSize: 9, fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #f1f5f9',
                position: 'sticky', top: 0, background: '#fafbfc', zIndex: 1,
              }}>
                {g.group}
              </div>
              {g.fonts.map(f => {
                const cyr = fontCyrMap.get(f) ?? false;
                const previewText = cyr ? 'Весілля' : 'Wedding';
                const isSelected = f === value;
                return (
                  <button
                    key={f}
                    onClick={() => { onChange(f); setOpen(false); }}
                    style={{
                      width: '100%', padding: '5px 10px', border: 'none', cursor: 'pointer',
                      background: isSelected ? '#f0f3ff' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                      borderLeft: isSelected ? '3px solid #1e2d7d' : '3px solid transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = isSelected ? '#f0f3ff' : 'transparent')}
                  >
                    <span style={{ fontSize: 10, color: '#64748b', minWidth: 80, textAlign: 'left', flexShrink: 0 }}>
                      {f}
                    </span>
                    <span style={{
                      fontFamily: f, fontSize: 16, color: '#1e293b',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textAlign: 'right', flex: 1,
                    }}>
                      {previewText}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
