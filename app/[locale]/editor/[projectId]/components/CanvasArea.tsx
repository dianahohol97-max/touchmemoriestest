'use client'

import { useEditorStore } from '@/lib/editor-store'

export default function CanvasArea() {
  const { project, currentPageIndex, selectedElementId, selectElement } = useEditorStore()

  const currentPage = project && currentPageIndex !== undefined
    ? (currentPageIndex === -1 ? project.coverPage : project.pages[currentPageIndex])
    : null

  const canvasSizes: Record<string, { w: number; h: number }> = {
    '20x20': { w: 800, h: 800 },
    '20x30': { w: 640, h: 960 },
    '30x20': { w: 960, h: 640 },
    '25x25': { w: 800, h: 800 },
    '30x30': { w: 900, h: 900 },
  }

  const size = canvasSizes[project?.format ?? '20x20'] ?? { w: 800, h: 800 }
  const scale = Math.min(600 / size.w, 500 / size.h)

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100 overflow-auto p-8">
      <div
        className="relative bg-white shadow-2xl"
        style={{
          width: size.w * scale,
          height: size.h * scale
        }}
        onClick={() => selectElement(null)}
      >
        {/* Background */}
        {currentPage?.background && (
          <div
            className="absolute inset-0"
            style={{
              background: currentPage.background.type === 'color'
                ? currentPage.background.value
                : `url(${currentPage.background.value})`
            }}
          />
        )}

        {/* Elements */}
        {currentPage?.elements?.map((el: any) => (
          <div
            key={el.id}
            className={`absolute cursor-pointer ${
              selectedElementId === el.id ? 'ring-2 ring-[#1e2d7d] ring-offset-1' : ''
            }`}
            style={{
              left: el.x * scale,
              top: el.y * scale,
              width: el.width * scale,
              height: el.height * scale,
              transform: `rotate(${el.rotation ?? 0}deg)`,
              opacity: (el.opacity ?? 100) / 100,
            }}
            onClick={(e) => {
              e.stopPropagation()
              selectElement(el.id)
            }}
          >
            {el.type === 'photo' && el.photoUrl ? (
              <img
                src={el.photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : el.type === 'photo' ? (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300">
                <span className="text-gray-400 text-xs"> Фото</span>
              </div>
            ) : el.type === 'text' ? (
              <div
                className="w-full h-full flex items-center overflow-hidden px-1"
                style={{
                  fontFamily: el.fontFamily ?? 'sans-serif',
                  fontSize: (el.fontSize ?? 24) * scale,
                  color: el.color ?? '#000',
                  textAlign: el.align ?? 'left',
                  fontWeight: el.bold ? 'bold' : 'normal',
                  fontStyle: el.italic ? 'italic' : 'normal',
                }}
              >
                {el.content ?? 'Текст'}
              </div>
            ) : null}
          </div>
        ))}

        {/* Empty state */}
        {(!currentPage?.elements || currentPage.elements.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <div className="text-center">
              <div className="text-5xl mb-2"></div>
              <p className="text-sm">Виберіть шаблон або перетягніть фото</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
