'use client'

import { useEditorStore } from '@/lib/editor-store'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import type { EditorElement } from '@/lib/editor-types'

interface TextPropertiesPanelProps {
  element: EditorElement
  pageIndex: number
}

const PRESET_COLORS = [
  { name: 'Чорний', value: '#000000' },
  { name: 'Білий', value: '#ffffff' },
  { name: 'Темно-синій', value: '#1e2d7d' },
  { name: 'Сірий', value: '#6b7280' },
  { name: 'Золотий', value: '#d4af37' },
]

export default function TextPropertiesPanel({ element, pageIndex }: TextPropertiesPanelProps) {
  const { updateElement } = useEditorStore()

  const handleUpdate = (updates: Partial<EditorElement>) => {
    updateElement(pageIndex, element.id, updates)
  }

  return (
    <div className="space-y-6">
      {/* Text Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Текст
        </label>
        <textarea
          value={element.content || ''}
          onChange={(e) => handleUpdate({ content: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent resize-none"
          rows={4}
          placeholder="Введіть текст..."
        />
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Шрифт
        </label>
        <select
          value={element.fontFamily || 'Montserrat'}
          onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
          style={{ fontFamily: element.fontFamily || 'Montserrat' }}
        >
          <option value="Montserrat" style={{ fontFamily: 'Montserrat' }}>Montserrat</option>
          <option value="Playfair Display" style={{ fontFamily: 'Playfair Display' }}>Playfair Display</option>
          <option value="Lato" style={{ fontFamily: 'Lato' }}>Lato</option>
          <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto</option>
          <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
          <option value="Dancing Script" style={{ fontFamily: 'Dancing Script' }}>Dancing Script (cursive)</option>
          <option value="Oswald" style={{ fontFamily: 'Oswald' }}>Oswald</option>
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Розмір шрифту: {element.fontSize || 24}px
        </label>
        <div className="flex gap-3">
          <input
            type="number"
            min="8"
            max="120"
            value={element.fontSize || 24}
            onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) || 24 })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
          />
          <input
            type="range"
            min="8"
            max="120"
            value={element.fontSize || 24}
            onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) })}
            className="flex-1"
          />
        </div>
      </div>

      {/* Text Style Toggles */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Стиль
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleUpdate({ bold: !element.bold })}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
              element.bold
                ? 'border-[#1e2d7d] bg-[#1e2d7d] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <Bold className="w-4 h-4" />
            <span className="text-sm font-medium">Жирний</span>
          </button>
          <button
            onClick={() => handleUpdate({ italic: !element.italic })}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
              element.italic
                ? 'border-[#1e2d7d] bg-[#1e2d7d] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <Italic className="w-4 h-4" />
            <span className="text-sm font-medium">Курсив</span>
          </button>
          <button
            onClick={() => handleUpdate({ underline: !element.underline })}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
              element.underline
                ? 'border-[#1e2d7d] bg-[#1e2d7d] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <Underline className="w-4 h-4" />
            <span className="text-sm font-medium">Підкреслений</span>
          </button>
        </div>
      </div>

      {/* Text Alignment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Вирівнювання
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleUpdate({ align: 'left' })}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border-2 transition-colors ${
              element.align === 'left'
                ? 'border-[#1e2d7d] bg-[#1e2d7d] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleUpdate({ align: 'center' })}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border-2 transition-colors ${
              element.align === 'center'
                ? 'border-[#1e2d7d] bg-[#1e2d7d] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleUpdate({ align: 'right' })}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border-2 transition-colors ${
              element.align === 'right'
                ? 'border-[#1e2d7d] bg-[#1e2d7d] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Колір тексту
        </label>
        <div className="space-y-3">
          {/* Preset Colors */}
          <div className="flex gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleUpdate({ color: preset.value })}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  element.color === preset.value
                    ? 'border-[#1e2d7d] scale-110'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
          {/* Custom Color Picker */}
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={element.color || '#000000'}
              onChange={(e) => handleUpdate({ color: e.target.value })}
              className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={element.color || '#000000'}
              onChange={(e) => handleUpdate({ color: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent uppercase"
              placeholder="#000000"
            />
          </div>
        </div>
      </div>

      {/* Letter Spacing */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Міжлітерний інтервал: {element.letterSpacing ?? 0}
        </label>
        <input
          type="range"
          min="-2"
          max="10"
          step="0.5"
          value={element.letterSpacing ?? 0}
          onChange={(e) => handleUpdate({ letterSpacing: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Line Height */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Міжрядковий інтервал: {(element.lineHeight ?? 1.2).toFixed(1)}
        </label>
        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.1"
          value={element.lineHeight ?? 1.2}
          onChange={(e) => handleUpdate({ lineHeight: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Прозорість: {element.opacity ?? 100}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={element.opacity ?? 100}
          onChange={(e) => handleUpdate({ opacity: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  )
}
