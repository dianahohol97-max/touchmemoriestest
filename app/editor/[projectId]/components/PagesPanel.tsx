'use client'

import { useEditorStore } from '@/lib/editor-store'
import { Plus, Trash2, BookOpen } from 'lucide-react'

export default function PagesPanel() {
  const { project, currentPageIndex, setCurrentPage } = useEditorStore()

  if (!project) return null

  const allPages = [project.coverPage, ...project.pages]

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Сторінки</h3>
          <span className="text-xs text-gray-500">
            {project.pages.length} сторінок
          </span>
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Cover Page */}
        <button
          onClick={() => setCurrentPage(-1)}
          className={`
            w-full rounded-lg border-2 transition-all overflow-hidden
            ${currentPageIndex === -1
              ? 'border-[#1e2d7d] shadow-md'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
            {project.coverPage.elements.length > 0 ? (
              <div className="text-xs text-gray-400">Обкладинка</div>
            ) : (
              <BookOpen className="w-8 h-8 text-gray-300" />
            )}
            <div className="absolute top-2 left-2 bg-[#1e2d7d] text-white text-xs px-2 py-0.5 rounded">
              Обкладинка
            </div>
          </div>
          <div className="p-2 bg-white text-left">
            <p className="text-xs font-medium text-gray-700">Обкладинка</p>
            <p className="text-xs text-gray-500">
              {project.coverPage.elements.length} елементів
            </p>
          </div>
        </button>

        {/* Regular Pages */}
        {project.pages.map((page, index) => (
          <button
            key={page.id}
            onClick={() => setCurrentPage(index)}
            className={`
              w-full rounded-lg border-2 transition-all overflow-hidden
              ${currentPageIndex === index
                ? 'border-[#1e2d7d] shadow-md'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div
              className="aspect-square flex items-center justify-center relative"
              style={{
                backgroundColor: page.background.type === 'color'
                  ? page.background.value
                  : '#f9fafb'
              }}
            >
              {page.background.type === 'image' && (
                <img
                  src={page.background.value}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-full object-cover"
                />
              )}
              {page.elements.length === 0 && (
                <div className="text-xs text-gray-400">Порожня сторінка</div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                {page.pageNumber}
              </div>
            </div>
            <div className="p-2 bg-white text-left">
              <p className="text-xs font-medium text-gray-700">
                Сторінка {page.pageNumber}
              </p>
              <p className="text-xs text-gray-500">
                {page.elements.length} елементів
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer - Add/Delete Pages (future functionality) */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed text-sm"
            title="Додавання сторінок буде доступно у наступній версії"
          >
            <Plus className="w-4 h-4" />
            Додати
          </button>
          <button
            disabled
            className="px-3 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed"
            title="Видалення сторінок буде доступно у наступній версії"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
