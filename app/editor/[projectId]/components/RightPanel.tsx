'use client'

import { useEditorStore } from '@/lib/editor-store'
import { Settings } from 'lucide-react'

export default function RightPanel() {
  const { project, selectedElementId, currentPageIndex } = useEditorStore()

  if (!project) return null

  const currentPage = currentPageIndex === -1
    ? project.coverPage
    : project.pages[currentPageIndex]

  const selectedElement = currentPage?.elements.find(
    el => el.id === selectedElementId
  )

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Властивості</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedElement ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Тип елемента
              </p>
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                {selectedElement.type === 'photo' && 'Фотографія'}
                {selectedElement.type === 'text' && 'Текст'}
                {selectedElement.type === 'shape' && 'Фігура'}
                {selectedElement.type === 'sticker' && 'Стікер'}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Позиція та розмір
              </p>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>X:</span>
                  <span>{(selectedElement.x * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Y:</span>
                  <span>{(selectedElement.y * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Ширина:</span>
                  <span>{(selectedElement.width * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Висота:</span>
                  <span>{(selectedElement.height * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {selectedElement.type === 'photo' && selectedElement.photoUrl && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Зображення
                </p>
                <img
                  src={selectedElement.photoUrl}
                  alt="Preview"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}

            {selectedElement.type === 'text' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Текст
                </p>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                  {selectedElement.content || 'Порожній текст'}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Детальне редагування властивостей буде доступно у наступній версії
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Settings className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">
              Елемент не обрано
            </p>
            <p className="text-xs text-gray-400">
              Оберіть елемент на сторінці щоб редагувати його властивості
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
