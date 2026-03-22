'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditorStore } from '@/lib/editor-store'
import {
  ArrowLeft,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Eye,
  Save,
  ShoppingCart,
  Type,
  Square,
  Trash2,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'

export default function EditorToolbar() {
  const router = useRouter()
  const {
    project,
    isDirty,
    undo,
    redo,
    history,
    historyIndex,
    selectedElementId,
    currentPageIndex,
    updateElement,
    removeElement,
    addElement,
  } = useEditorStore()

  const [zoom, setZoom] = useState(100)

  if (!project) return null

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Get current page and selected element
  const currentPage = currentPageIndex === -1
    ? project.coverPage
    : project.pages[currentPageIndex]

  const selectedElement = currentPage?.elements.find(
    el => el.id === selectedElementId
  )

  const handleBack = () => {
    if (isDirty) {
      if (confirm('У вас є незбережені зміни. Ви впевнені, що хочете вийти?')) {
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }

  const handleAddText = () => {
    if (!currentPage) return

    const newTextElement = {
      id: `text-${Date.now()}`,
      type: 'text' as const,
      x: 0.35,
      y: 0.4,
      width: 0.3,
      height: 0.1,
      rotation: 0,
      content: 'Ваш текст',
      fontFamily: 'Montserrat',
      fontSize: 24,
      color: '#000000',
      align: 'center',
      bold: false,
      italic: false,
      opacity: 100,
      zIndex: currentPage.elements.length,
    }

    addElement(currentPageIndex, newTextElement)
    useEditorStore.getState().selectElement(newTextElement.id)
  }

  const handleDeleteElement = () => {
    if (selectedElementId && currentPage) {
      if (confirm('Видалити цей елемент?')) {
        removeElement(currentPageIndex, selectedElementId)
      }
    }
  }

  const handleRotate = (degrees: number) => {
    if (selectedElement) {
      const newRotation = (selectedElement.rotation || 0) + degrees
      updateElement(currentPageIndex, selectedElement.id, { rotation: newRotation })
    }
  }

  const handleFlip = (axis: 'x' | 'y') => {
    if (selectedElement) {
      if (axis === 'x') {
        updateElement(currentPageIndex, selectedElement.id, { flipX: !selectedElement.flipX })
      } else {
        updateElement(currentPageIndex, selectedElement.id, { flipY: !selectedElement.flipY })
      }
    }
  }

  const handleTextStyle = (style: 'bold' | 'italic') => {
    if (selectedElement && selectedElement.type === 'text') {
      updateElement(currentPageIndex, selectedElement.id, {
        [style]: !selectedElement[style]
      })
    }
  }

  const handleTextAlign = (align: string) => {
    if (selectedElement && selectedElement.type === 'text') {
      updateElement(currentPageIndex, selectedElement.id, { align })
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Назад</span>
        </button>
        <div className="h-6 w-px bg-gray-300" />
        <div className="font-semibold text-gray-900">
          {project.productType === 'photobook' ? 'Фотокнига' : project.productType === 'travelbook' ? 'Travel Book' : 'Журнал'} {project.format}
        </div>
        {isDirty && <span className="text-xs text-orange-600">• Не збережено</span>}
      </div>

      {/* Center Section - Element Controls */}
      <div className="flex items-center gap-2">
        {selectedElement ? (
          <>
            {selectedElement.type === 'photo' && (
              <>
                <button
                  onClick={() => handleRotate(-90)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Повернути ліворуч"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleRotate(90)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Повернути праворуч"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFlip('x')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Flip H"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFlip('y')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Flip V"
                >
                  <FlipVertical className="w-4 h-4" />
                </button>
                <div className="h-6 w-px bg-gray-300 mx-1" />
              </>
            )}

            {selectedElement.type === 'text' && (
              <>
                <button
                  onClick={() => handleTextStyle('bold')}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedElement.bold ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-100'
                  }`}
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleTextStyle('italic')}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedElement.italic ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-100'
                  }`}
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleTextAlign('left')}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedElement.align === 'left' ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleTextAlign('center')}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedElement.align === 'center' ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleTextAlign('right')}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedElement.align === 'right' ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  <AlignRight className="w-4 h-4" />
                </button>
                <div className="h-6 w-px bg-gray-300 mx-1" />
              </>
            )}

            <button
              onClick={handleDeleteElement}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
              title="Видалити"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleAddText}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Type className="w-4 h-4" />
              <span className="text-sm">Додати текст</span>
            </button>
          </>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Скасувати (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Повторити (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-gray-300 mx-1" />

        <button
          onClick={() => setZoom(Math.max(25, zoom - 25))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
        <button
          onClick={() => setZoom(Math.min(200, zoom + 25))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-gray-300 mx-1" />

        <button
          onClick={() => alert('Попередній перегляд у розробці')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Переглянути"
        >
          <Eye className="w-4 h-4" />
        </button>

        <button
          onClick={() => alert('Збереження...')}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          <span className="text-sm font-medium">Зберегти</span>
        </button>

        <button
          onClick={() => router.push('/order')}
          className="flex items-center gap-2 px-3 py-2 bg-[#1e2d7d] hover:bg-[#263a99] text-white rounded-lg transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="text-sm font-medium">Замовити</span>
        </button>
      </div>
    </div>
  )
}
