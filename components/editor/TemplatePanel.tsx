'use client'

import { useState } from 'react'
import { useEditorStore } from '@/lib/editor-store'
import { LAYOUTS, BACKGROUND_COLORS, type Layout, type LayoutSlot } from '@/lib/layouts'
import type { EditorElement } from '@/lib/editor-types'

export default function TemplatePanel() {
  const { project, currentPageIndex, setPageLayout, addElement, setPageBackground } = useEditorStore()
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [customColor, setCustomColor] = useState('#ffffff')

  if (!project) return null

  const currentPage = currentPageIndex === -1 ? project.coverPage : project.pages[currentPageIndex]
  const currentLayoutId = currentPage?.layoutId || 'blank'

  // Filter layouts by product type
  const availableLayouts = LAYOUTS.filter(layout =>
    layout.productTypes.includes(project.productType)
  )

  const handleApplyLayout = (layout: Layout) => {
    if (!currentPage) return

    // Set the layout ID
    setPageLayout(currentPageIndex, layout.id)

    // Clear existing elements on the page
    const existingElements = currentPage.elements
    existingElements.forEach(el => {
      useEditorStore.getState().removeElement(currentPageIndex, el.id)
    })

    // Create new elements based on layout slots
    layout.slots.forEach((slot: LayoutSlot, index: number) => {
      const newElement: EditorElement = {
        id: `${layout.id}-${slot.id}-${Date.now()}-${index}`,
        type: slot.type,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        rotation: 0,
        zIndex: index,
        opacity: 100,
      }

      // Add type-specific defaults
      if (slot.type === 'photo') {
        newElement.photoUrl = '' // Empty placeholder
      } else if (slot.type === 'text') {
        newElement.content = 'Ваш текст'
        newElement.fontFamily = 'Montserrat'
        newElement.fontSize = 24
        newElement.color = '#000000'
        newElement.align = 'center'
        newElement.bold = false
        newElement.italic = false
      }

      addElement(currentPageIndex, newElement)
    })
  }

  const handleBackgroundColor = (color: string) => {
    setPageBackground(currentPageIndex, { type: 'color', value: color })
  }

  const handleCustomColor = () => {
    setPageBackground(currentPageIndex, { type: 'color', value: customColor })
    setShowColorPicker(false)
  }

  return (
    <div className="p-4 space-y-6">
      {/* Layouts Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Шаблони сторінок
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {availableLayouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => handleApplyLayout(layout)}
              className={`relative group rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                currentLayoutId === layout.id
                  ? 'border-[#1e2d7d] bg-[#f0f2f8]'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {/* Layout Thumbnail Preview */}
              <div className="aspect-square bg-gray-50 rounded mb-2 overflow-hidden relative">
                <LayoutThumbnail slots={layout.slots} />
              </div>

              {/* Layout Name */}
              <p className="text-xs font-medium text-gray-700 text-center leading-tight">
                {layout.name}
              </p>

              {/* Selected indicator */}
              {currentLayoutId === layout.id && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-[#1e2d7d] rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Background Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Фон сторінки
        </h3>

        {/* Color Swatches */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {BACKGROUND_COLORS.map((bgColor) => (
            <button
              key={bgColor.value}
              onClick={() => handleBackgroundColor(bgColor.value)}
              className={`aspect-square rounded-lg border-2 transition-all hover:scale-105 ${
                currentPage?.background.value === bgColor.value
                  ? 'border-[#1e2d7d] ring-2 ring-[#1e2d7d] ring-offset-1'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              style={{ backgroundColor: bgColor.value }}
              title={bgColor.name}
              aria-label={bgColor.name}
            >
              {currentPage?.background.value === bgColor.value && (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className={`w-5 h-5 ${bgColor.value === '#000000' || bgColor.value === '#6b7280' ? 'text-white' : 'text-gray-800'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="space-y-2">
          {!showColorPicker ? (
            <button
              onClick={() => setShowColorPicker(true)}
              className="w-full py-2 px-3 text-sm font-medium text-[#1e2d7d] border border-[#1e2d7d] rounded-lg hover:bg-[#f0f2f8] transition-colors"
            >
              Свій колір
            </button>
          ) : (
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Оберіть колір:
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-full h-10 rounded border border-gray-300 cursor-pointer"
                />
                <button
                  onClick={handleCustomColor}
                  className="px-4 py-2 bg-[#1e2d7d] text-white text-sm font-medium rounded-lg hover:bg-[#263a99] transition-colors"
                >
                  OK
                </button>
              </div>
              <button
                onClick={() => setShowColorPicker(false)}
                className="w-full py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
              >
                Скасувати
              </button>
            </div>
          )}
        </div>

        {/* Current Background Info */}
        {currentPage && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
            <span className="font-medium">Поточний фон:</span>{' '}
            <span className="inline-block w-4 h-4 rounded border border-gray-300 align-middle ml-1" style={{ backgroundColor: currentPage.background.value }} />
            <span className="ml-1">{currentPage.background.value}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper component to render layout thumbnail preview
function LayoutThumbnail({ slots }: { slots: LayoutSlot[] }) {
  if (slots.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
        ⬜
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {slots.map((slot) => {
        const left = `${slot.x * 100}%`
        const top = `${slot.y * 100}%`
        const width = `${slot.width * 100}%`
        const height = `${slot.height * 100}%`

        return (
          <div
            key={slot.id}
            className={`absolute border ${
              slot.type === 'photo'
                ? 'bg-gray-200 border-gray-300'
                : 'bg-blue-50 border-blue-200'
            }`}
            style={{
              left,
              top,
              width,
              height,
            }}
          >
            {/* Icon indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              {slot.type === 'photo' ? (
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
