'use client'

import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/lib/editor-store'
import { FORMAT_CANVAS_SIZES } from '@/lib/editor-types'

export default function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { project, currentPageIndex } = useEditorStore()

  useEffect(() => {
    if (!project || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const canvasSize = FORMAT_CANVAS_SIZES[project.format]
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height

    // Get current page
    const currentPage = currentPageIndex === -1
      ? project.coverPage
      : project.pages[currentPageIndex]

    if (!currentPage) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background
    if (currentPage.background.type === 'color') {
      ctx.fillStyle = currentPage.background.value
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Draw placeholder for elements
    ctx.fillStyle = '#e5e7eb'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(
      'Canvas rendering with Fabric.js coming soon...',
      canvas.width / 2,
      canvas.height / 2
    )

  }, [project, currentPageIndex])

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  const canvasSize = FORMAT_CANVAS_SIZES[project.format]

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="relative" style={{ maxWidth: '100%', maxHeight: '100%' }}>
        <canvas
          ref={canvasRef}
          className="shadow-2xl bg-white"
          style={{
            width: '100%',
            height: 'auto',
            maxWidth: `${canvasSize.width}px`,
            maxHeight: `${canvasSize.height}px`,
          }}
        />
      </div>
    </div>
  )
}
