'use client'

import { useState } from 'react'
import { useEditorStore } from '@/lib/editor-store'
import { LAYOUTS } from '@/lib/layouts'

export default function LeftPanel() {
  const [tab, setTab] = useState<'pages' | 'photos' | 'layouts'>('layouts')
  const { project, currentPageIndex, setCurrentPage, addElement, setPageBackground } = useEditorStore()

  const pages = project?.pages ?? []
  const bgColors = ['#ffffff', '#f8f4f0', '#1a1a2e', '#2d4a3e', '#c4704f', '#e8d5b7', '#f0e6d3']

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['layouts', 'pages', 'photos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              tab === t
                ? 'text-[#1e2d7d] border-b-2 border-[#1e2d7d]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'layouts' ? 'Шаблони' : t === 'pages' ? 'Сторінки' : 'Фото'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Layouts tab */}
        {tab === 'layouts' && (
          <div>
            <p className="text-xs text-gray-400 mb-3">Фон сторінки</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {bgColors.map(c => (
                <button
                  key={c}
                  onClick={() => setPageBackground(currentPageIndex, { type: 'color', value: c })}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 hover:scale-110 transition-transform"
                  style={{ background: c }}
                />
              ))}
            </div>

            <p className="text-xs text-gray-400 mb-3">Шаблон розкладки</p>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS.map(layout => (
                <button
                  key={layout.id}
                  onClick={() => {
                    layout.slots.forEach((slot: any) => {
                      addElement(currentPageIndex, {
                        id: `el_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        type: slot.type ?? 'photo',
                        x: slot.x * 800,
                        y: slot.y * 800,
                        width: slot.width * 800,
                        height: slot.height * 800,
                        rotation: 0,
                        opacity: 100,
                        zIndex: 0,
                        content: slot.type === 'text' ? 'Текст' : undefined,
                        fontSize: 24,
                        fontFamily: 'sans-serif',
                        color: '#000000',
                        align: 'center',
                        bold: false,
                        italic: false,
                      } as any)
                    })
                  }}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-600 hover:bg-[#f0f2f8] hover:border-[#1e2d7d] transition-colors text-center"
                >
                  <div className="w-full aspect-square bg-gray-200 rounded mb-1 flex items-center justify-center text-lg">
                    {layout.thumbnail ?? '□'}
                  </div>
                  {layout.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pages tab */}
        {tab === 'pages' && (
          <div className="space-y-2">
            {pages.map((page: any, i: number) => (
              <button
                key={page.id}
                onClick={() => setCurrentPage(i)}
                className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${
                  currentPageIndex === i
                    ? 'border-[#1e2d7d] bg-[#f0f2f8] text-[#1e2d7d] font-semibold'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {page.pageNumber === 0 ? '📖 Обкладинка' : `Сторінка ${page.pageNumber}`}
                <span className="text-gray-400 ml-1">({page.elements?.length ?? 0} ел.)</span>
              </button>
            ))}
          </div>
        )}

        {/* Photos tab */}
        {tab === 'photos' && (
          <div>
            <label className="block w-full bg-[#1e2d7d] text-white text-xs font-semibold py-2 px-3 rounded-lg text-center cursor-pointer hover:bg-[#263a99] transition-colors">
              + Завантажити фото
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  Array.from(e.target.files ?? []).forEach(file => {
                    const url = URL.createObjectURL(file)
                    addElement(currentPageIndex, {
                      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      type: 'photo',
                      photoUrl: url,
                      x: 50,
                      y: 50,
                      width: 300,
                      height: 300,
                      rotation: 0,
                      opacity: 100,
                      zIndex: 1,
                    } as any)
                  })
                }}
              />
            </label>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Або перетягніть фото на канвас
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
