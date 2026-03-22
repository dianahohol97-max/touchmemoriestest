'use client'

import { useEditorStore } from '@/lib/editor-store'
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Trash2 } from 'lucide-react'
import type { EditorElement } from '@/lib/editor-types'

interface PhotoEditingPanelProps {
  element: EditorElement
  pageIndex: number
}

export default function PhotoEditingPanel({ element, pageIndex }: PhotoEditingPanelProps) {
  const { updateElement, removeElement } = useEditorStore()

  const handleUpdate = (updates: Partial<EditorElement>) => {
    updateElement(pageIndex, element.id, updates)
  }

  const handleRotate = (degrees: number) => {
    const newRotation = (element.rotation || 0) + degrees
    handleUpdate({ rotation: newRotation })
  }

  const handleFlip = (axis: 'x' | 'y') => {
    if (axis === 'x') {
      handleUpdate({ flipX: !element.flipX })
    } else {
      handleUpdate({ flipY: !element.flipY })
    }
  }

  const handleDelete = () => {
    if (confirm('Видалити це фото?')) {
      removeElement(pageIndex, element.id)
    }
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-6">
        {/* Brightness */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-24">
            Яскравість:
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={element.brightness || 0}
            onChange={(e) => handleUpdate({ brightness: parseInt(e.target.value) })}
            className="w-32"
          />
          <span className="text-sm text-gray-600 w-12 text-right">
            {element.brightness || 0}
          </span>
        </div>

        {/* Contrast */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-24">
            Контраст:
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={element.contrast || 0}
            onChange={(e) => handleUpdate({ contrast: parseInt(e.target.value) })}
            className="w-32"
          />
          <span className="text-sm text-gray-600 w-12 text-right">
            {element.contrast || 0}
          </span>
        </div>

        {/* Saturation */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-24">
            Насиченість:
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={element.saturation || 0}
            onChange={(e) => handleUpdate({ saturation: parseInt(e.target.value) })}
            className="w-32"
          />
          <span className="text-sm text-gray-600 w-12 text-right">
            {element.saturation || 0}
          </span>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Rotate & Flip */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRotate(-90)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Повернути ліворуч"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Повернути праворуч"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleFlip('x')}
            className={`p-2 rounded-lg transition-colors ${
              element.flipX ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-200'
            }`}
            title="Flip H"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleFlip('y')}
            className={`p-2 rounded-lg transition-colors ${
              element.flipY ? 'bg-[#1e2d7d] text-white' : 'hover:bg-gray-200'
            }`}
            title="Flip V"
          >
            <FlipVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
          title="Видалити"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
