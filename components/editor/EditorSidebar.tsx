'use client';

import { Image as ImageIcon, LayoutGrid, Type, QrCode } from 'lucide-react';
import { useBookEditorStore } from '@/lib/editor/store';
import { getProductFlags } from '@/lib/editor/utils';
import type { LeftTab } from '@/lib/editor/types';

export function EditorSidebar() {
  const { config, currentIdx, leftTab, setLeftTab, setCurrentIdx } = useBookEditorStore();
  const { hasKalka, hasEndpaper } = getProductFlags(config);

  const tabs: [string, React.ReactNode, string][] = [
    ['photos', <ImageIcon key="p" size={20} />, 'Зображення'],
    ['layouts', <LayoutGrid key="l" size={20} />, 'Шаблон'],
    ['text', <Type key="t" size={20} />, 'Текст'],
    ['bg', <span key="bg" style={{ fontSize: 16, fontWeight: 700 }}>Фн</span>, 'Фон'],
    ['shapes', <span key="sh" style={{ fontSize: 16, fontWeight: 700 }}></span>, 'Фігури'],
    ['stickers', <span key="stk" style={{ fontSize: 16 }}></span>, 'Стікери'],
    ['frames', <span key="fr" style={{ fontSize: 16, fontWeight: 700 }}></span>, 'Рамки'],
    ['qr', <QrCode key="qr" size={18} />, 'QR-код'],
    ...(hasKalka ? [['kalka', <span key="kl" style={{ fontSize: 13, fontWeight: 700 }}>КЛ</span>, 'Калька'] as [string, React.ReactNode, string]] : []),
    ...(hasEndpaper ? [['endpaper', <span key="ep" style={{ fontSize: 11, fontWeight: 700 }}>ФЗ</span>, 'Форзац'] as [string, React.ReactNode, string]] : []),
    ...(currentIdx === 0 ? [['cover', <span key="cv" style={{ fontSize: 18 }}></span>, 'Обкладинка'] as [string, React.ReactNode, string]] : []),
  ];

  return (
    <div style={{ width: 72, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, borderRight: '1px solid #f1f5f9', flexShrink: 0 }}>
      {tabs.map(([id, icon, label]) => (
        <button key={id}
          onClick={() => {
            setLeftTab(id as LeftTab);
            if (id === 'layouts' && currentIdx === 0) setCurrentIdx(1);
          }}
          style={{
            width: '100%', padding: '12px 4px', border: 'none', cursor: 'pointer',
            background: leftTab === id ? '#1e2d7d' : 'transparent',
            color: leftTab === id ? '#fff' : '#64748b',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            marginBottom: 2, transition: 'background 0.15s',
          }}>
          {icon}
          <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}
