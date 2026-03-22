'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Download, AlertCircle } from 'lucide-react'
import * as fabric from 'fabric'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { EditorProject, EditorPage, EditorElement } from '@/lib/editor-types'
import { FORMAT_CANVAS_SIZES } from '@/lib/editor-types'

interface PreviewModalProps {
  project: EditorProject
  onClose: () => void
}

export default function PreviewModal({ project, onClose }: PreviewModalProps) {
  const router = useRouter()
  const [currentSpread, setCurrentSpread] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [showBleedZone, setShowBleedZone] = useState(true)
  const leftCanvasRef = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)

  const canvasSize = FORMAT_CANVAS_SIZES[project.format]

  // Calculate spreads
  // Spread 0: Cover alone
  // Spread 1+: Pages 0-1, 2-3, 4-5, etc.
  const totalSpreads = Math.ceil(project.pages.length / 2) + 1 // +1 for cover

  const getCurrentPages = () => {
    if (currentSpread === 0) {
      // Cover page only
      return { left: project.coverPage, right: null }
    } else {
      // Regular spreads
      const pageIndex = (currentSpread - 1) * 2
      const leftPage = project.pages[pageIndex] || null
      const rightPage = project.pages[pageIndex + 1] || null
      return { left: leftPage, right: rightPage }
    }
  }

  const { left, right } = getCurrentPages()

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentSpread > 0) {
        setCurrentSpread(prev => prev - 1)
      } else if (e.key === 'ArrowRight' && currentSpread < totalSpreads - 1) {
        setCurrentSpread(prev => prev + 1)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSpread, totalSpreads, onClose])

  // Render pages with Fabric.js
  useEffect(() => {
    if (left && leftCanvasRef.current) {
      renderPage(leftCanvasRef.current, left)
    }
    if (right && rightCanvasRef.current) {
      renderPage(rightCanvasRef.current, right)
    }
  }, [left, right, project.format])

  const renderPage = (canvasElement: HTMLCanvasElement, page: EditorPage) => {
    const fabricCanvas = new fabric.StaticCanvas(canvasElement, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: page.background.type === 'color' ? page.background.value : '#ffffff',
    })

    // Set background image if specified
    if (page.background.type === 'image') {
      fabric.Image.fromURL(page.background.value).then((img) => {
        img.scaleX = canvasSize.width / (img.width || 1)
        img.scaleY = canvasSize.height / (img.height || 1)
        img.left = 0
        img.top = 0
        fabricCanvas.backgroundImage = img
        fabricCanvas.renderAll()
      }).catch(() => {
        // ignore failed background image load
      })
    }

    // Render elements
    page.elements.forEach((element) => {
      if (element.type === 'text') {
        renderTextElement(fabricCanvas, element, canvasSize)
      } else if (element.type === 'photo' && element.photoUrl) {
        renderPhotoElement(fabricCanvas, element, canvasSize)
      }
    })

    fabricCanvas.renderAll()
  }

  const renderTextElement = (
    canvas: fabric.StaticCanvas,
    element: EditorElement,
    canvasSize: { width: number; height: number }
  ) => {
    const textObj = new fabric.Text(element.content || 'Текст', {
      left: element.x * canvasSize.width,
      top: element.y * canvasSize.height,
      fontFamily: element.fontFamily || 'Montserrat',
      fontSize: element.fontSize || 24,
      fill: element.color || '#000000',
      textAlign: (element.align || 'left') as 'left' | 'center' | 'right' | 'justify',
      fontWeight: (element.bold ? 'bold' : 'normal') as 'normal' | 'bold',
      fontStyle: (element.italic ? 'italic' : 'normal') as '' | 'normal' | 'italic' | 'oblique',
      underline: element.underline || false,
      charSpacing: (element.letterSpacing || 0) * 10,
      lineHeight: element.lineHeight || 1.2,
      opacity: (element.opacity ?? 100) / 100,
      angle: element.rotation || 0,
      selectable: false,
    })

    canvas.add(textObj)
  }

  const renderPhotoElement = (
    canvas: fabric.StaticCanvas,
    element: EditorElement,
    canvasSize: { width: number; height: number }
  ) => {
    if (!element.photoUrl) return

    fabric.Image.fromURL(element.photoUrl, { crossOrigin: 'anonymous' }).then((img) => {
      const imgWidth = element.width * canvasSize.width
      const imgHeight = element.height * canvasSize.height

      img.set({
        left: element.x * canvasSize.width,
        top: element.y * canvasSize.height,
        scaleX: imgWidth / (img.width || 1),
        scaleY: imgHeight / (img.height || 1),
        opacity: (element.opacity ?? 100) / 100,
        angle: element.rotation || 0,
        flipX: element.flipX || false,
        flipY: element.flipY || false,
        selectable: false,
      })

      // Apply filters
      const filters: any[] = []
      if (element.brightness !== undefined && element.brightness !== 0) {
        filters.push(new fabric.filters.Brightness({ brightness: element.brightness / 100 }))
      }
      if (element.contrast !== undefined && element.contrast !== 0) {
        filters.push(new fabric.filters.Contrast({ contrast: element.contrast / 100 }))
      }
      if (element.saturation !== undefined && element.saturation !== 0) {
        filters.push(new fabric.filters.Saturation({ saturation: element.saturation / 100 }))
      }
      if (filters.length > 0) {
        img.filters = filters
        img.applyFilters()
      }

      // Apply crop if specified
      if (element.cropX !== undefined && element.cropY !== undefined && element.cropZoom !== undefined) {
        const cropZoom = element.cropZoom
        const cropX = element.cropX
        const cropY = element.cropY
        const cropWidth = (img.width || 0) / cropZoom
        const cropHeight = (img.height || 0) / cropZoom
        const cropLeft = (cropX * (img.width || 0)) - cropWidth / 2
        const cropTop = (cropY * (img.height || 0)) - cropHeight / 2

        img.set({
          cropX: Math.max(0, cropLeft),
          cropY: Math.max(0, cropTop),
          width: cropWidth,
          height: cropHeight,
          scaleX: imgWidth / cropWidth,
          scaleY: imgHeight / cropHeight,
        })
      }

      canvas.add(img)
      canvas.renderAll()
    }).catch(() => {
      // ignore failed photo load
    })
  }

  const handleExportPDF = async () => {
    setIsExporting(true)

    try {
      const pdf = new jsPDF({
        orientation: canvasSize.width > canvasSize.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [canvasSize.width / 3.78, canvasSize.height / 3.78], // Convert px to mm (96 DPI)
      })

      // Render cover page
      const coverCanvas = document.createElement('canvas')
      coverCanvas.width = canvasSize.width * 3 // 3x for quality
      coverCanvas.height = canvasSize.height * 3
      const coverFabric = new fabric.StaticCanvas(coverCanvas, {
        width: canvasSize.width * 3,
        height: canvasSize.height * 3,
      })

      // Add cover content (simplified - would need full rendering logic)
      const coverImg = await html2canvas(leftCanvasRef.current!, { scale: 3 })
      const coverData = coverImg.toDataURL('image/jpeg', 0.95)
      pdf.addImage(coverData, 'JPEG', 0, 0, canvasSize.width / 3.78, canvasSize.height / 3.78)

      // Render all pages
      for (let i = 0; i < project.pages.length; i++) {
        pdf.addPage()
        const pageCanvas = document.createElement('canvas')
        // ... render page to canvas at 3x scale
        // ... add to PDF
      }

      pdf.save(`${project.productType}-${project.format}.pdf`)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Помилка експорту PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const getSpreadTitle = () => {
    if (currentSpread === 0) {
      return 'Обкладинка'
    } else {
      const startPage = (currentSpread - 1) * 2 + 1
      const endPage = Math.min(startPage + 1, project.pages.length)
      return `Сторінка ${startPage}${endPage > startPage ? `–${endPage}` : ''} з ${project.pages.length}`
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#111] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-semibold">Прев'ю: {getSpreadTitle()}</h2>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={showBleedZone}
              onChange={(e) => setShowBleedZone(e.target.checked)}
              className="rounded"
            />
            Показати зону обрізання
          </label>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Закрити
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="relative flex items-center gap-4">
          {/* Previous Button */}
          <button
            onClick={() => setCurrentSpread(prev => Math.max(0, prev - 1))}
            disabled={currentSpread === 0}
            className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Page Spread */}
          <div className="flex gap-8">
            {/* Left Page */}
            {left && (
              <div className="relative">
                <div className="bg-white shadow-2xl rounded-sm overflow-hidden" style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}>
                  <canvas ref={leftCanvasRef} />

                  {/* Bleed Zone Indicator */}
                  {showBleedZone && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        border: '3mm dashed rgba(255, 0, 0, 0.5)',
                        margin: '3mm',
                      }}
                    >
                      <div className="absolute top-2 left-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded">
                        Зона обрізання
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right Page */}
            {right && (
              <div className="relative">
                <div className="bg-white shadow-2xl rounded-sm overflow-hidden" style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}>
                  <canvas ref={rightCanvasRef} />

                  {/* Bleed Zone Indicator */}
                  {showBleedZone && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        border: '3mm dashed rgba(255, 0, 0, 0.5)',
                        margin: '3mm',
                      }}
                    >
                      <div className="absolute top-2 left-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded">
                        Зона обрізання
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Next Button */}
          <button
            onClick={() => setCurrentSpread(prev => Math.min(totalSpreads - 1, prev + 1))}
            disabled={currentSpread === totalSpreads - 1}
            className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur">
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Важливо: не розміщуйте текст ближче 5мм до краю</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Експорт...' : 'Скачати PDF'}
          </button>

          <button
            onClick={() => router.push('/order')}
            className="flex items-center gap-2 px-6 py-2 bg-[#1e2d7d] hover:bg-[#263a99] text-white rounded-lg transition-colors"
          >
            <span>Замовити</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
