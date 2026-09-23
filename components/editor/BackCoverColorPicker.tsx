'use client';

import { Pipette } from 'lucide-react';

/**
 * Колір задньої обкладинки — ОДИН компонент на весь конструктор.
 *
 * Це керування існувало в чотирьох копіях: широка панель, вузька панель, два
 * мобільні листи. Копії вже починали розходитися, і історія тулбара фотослота
 * каже, чим це закінчується — там дві копії розійшлися рівно так само, поки їх
 * не звели в один компонент. Тому піпетка додається сюди, а не в кожну копію
 * окремо.
 *
 * `compact` — це та сама панель у вужчому вигляді, а не інша поведінка: інші
 * розміри й відступи, той самий набір дій.
 */

const PRESETS = ['#ffffff', '#f1f5f9', '#e8deff', '#fff8f0', '#1e2d7d', '#000000', '#7b5fcc', '#d4a373', '#2d3748', '#f8d7da'];
const DEFAULT_COLOR = '#f1f5f9';

export interface BackCoverColorPickerProps {
    value: string | undefined;
    onChange: (hex: string) => void;
    /** Вмикає режим піпетки на полотні. Немає — кнопки піпетки теж немає. */
    onStartEyedropper?: () => void;
    /** Піпетка вже чекає на дотик по обкладинці. */
    eyedropperActive?: boolean;
    compact?: boolean;
    showPresets?: boolean;
    showHint?: boolean;
}

export function BackCoverColorPicker({
    value,
    onChange,
    onStartEyedropper,
    eyedropperActive = false,
    compact = false,
    showPresets = true,
    showHint = true,
}: BackCoverColorPickerProps) {
    const color = value || DEFAULT_COLOR;
    const swatch = compact ? 24 : 32;

    const commitText = (raw: string) => {
        let v = raw.trim();
        if (v && !v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-fA-F]{3,8}$/.test(v)) onChange(v);
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: compact ? 6 : 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: compact ? 10 : 11, color: compact ? '#94a3b8' : '#475569', flexShrink: 0 }}>Колір фону</span>
                <input type="color" value={color}
                    onChange={e => onChange(e.target.value)}
                    style={{ width: swatch - 2, height: compact ? 24 : 28, border: '1px solid #e2e8f0', borderRadius: compact ? 4 : 5, cursor: 'pointer', padding: compact ? 1 : 2, flexShrink: 0 }} />
                <input type="text" value={color}
                    onChange={e => onChange(e.target.value)}
                    onBlur={e => commitText(e.target.value)}
                    placeholder={DEFAULT_COLOR}
                    style={{ flex: 1, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, fontFamily: 'monospace', color: '#374151', background: '#fff', outline: 'none', minWidth: 0 }} />
                {onStartEyedropper && (
                    <button type="button" onClick={onStartEyedropper}
                        title="Узяти колір із передньої обкладинки"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            width: compact ? 26 : 30, height: compact ? 24 : 28,
                            border: eyedropperActive ? '1.5px solid #1e2d7d' : '1px solid #e2e8f0',
                            borderRadius: compact ? 4 : 5,
                            background: eyedropperActive ? '#eef2ff' : '#f8fafc',
                            color: eyedropperActive ? '#1e2d7d' : '#64748b',
                            cursor: 'pointer',
                        }}>
                        <Pipette size={compact ? 12 : 14} />
                    </button>
                )}
                <button type="button" onClick={() => onChange(DEFAULT_COLOR)}
                    title="Повернути стандартний колір"
                    style={{ padding: compact ? '2px 6px' : '3px 7px', border: '1px solid #e2e8f0', borderRadius: compact ? 4 : 5, fontSize: 10, cursor: 'pointer', color: '#64748b', background: '#f8fafc', flexShrink: 0 }}>↺</button>
            </div>

            {showPresets && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {PRESETS.map(c => (
                        <button key={c} type="button" title={c}
                            onClick={() => onChange(c)}
                            style={{
                                width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
                                border: color.toLowerCase() === c.toLowerCase() ? '3px solid #1e2d7d' : '1px solid #cbd5e1',
                                boxShadow: color.toLowerCase() === c.toLowerCase() ? '0 0 0 2px #fff inset' : 'none',
                            }} />
                    ))}
                </div>
            )}

            {showHint && (
                <p style={{ fontSize: 10, color: eyedropperActive ? '#1e2d7d' : '#94a3b8', margin: '0 0 4px', lineHeight: 1.4, fontWeight: eyedropperActive ? 700 : 400 }}>
                    {eyedropperActive
                        ? 'Торкніться передньої обкладинки в тому місці, звідки взяти колір.'
                        : 'Оберіть колір вище, клікніть на кружечок палітри або візьміть піпеткою з передньої обкладинки. Колір заллє всю задню обкладинку.'}
                </p>
            )}
        </div>
    );
}
