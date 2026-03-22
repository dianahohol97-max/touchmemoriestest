'use client'

import { useEffect, useRef } from 'react'
import { fabric } from 'fabric'
import { useEditorStore } from '@/lib/editor-store'
import { FORMAT_CANVAS_SIZES } from '@/lib/editor-types'
import type { EditorElement } from '@/lib/editor-types'

export default function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const { project, currentPageIndex, selectElement, updateElement, selectedElementId } = useEditorStore()

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !project) return

    const canvasSize = FORMAT_CANVAS_SIZES[project.format]

    // Create Fabric canvas
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    })

    fabricCanvasRef.current = fabricCanvas

    // Handle object selection
    fabricCanvas.on('selection:created', (e) => {
      if (e.selected && e.selected[0]) {
        const obj = e.selected[0]
        selectElement(obj.data?.elementId || null)
      }
    })

    fabricCanvas.on('selection:updated', (e) => {
      if (e.selected && e.selected[0]) {
        const obj = e.selected[0]
        selectElement(obj.data?.elementId || null)
      }
    })

    fabricCanvas.on('selection:cleared', () => {
      selectElement(null)
    })

    // Handle object modifications
    fabricCanvas.on('object:modified', (e) => {
      if (!e.target || !e.target.data?.elementId) return

      const obj = e.target
      const elementId = obj.data.elementId

      const updates: Partial<EditorElement> = {
        x: (obj.left || 0) / canvasSize.width,
        y: (obj.top || 0) / canvasSize.height,
        width: (obj.width || 0) * (obj.scaleX || 1) / canvasSize.width,
        height: (obj.height || 0) * (obj.scaleY || 1) / canvasSize.height,
        rotation: obj.angle || 0,
      }

      // Update text content if it's a text object
      if (obj.type === 'i-text' || obj.type === 'text') {
        const textObj = obj as fabric.IText
        updates.content = textObj.text
      }

      updateElement(currentPageIndex, elementId, updates)
    })

    return () => {
      fabricCanvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [project?.format])

  // Render page content
  useEffect(() => {
    if (!fabricCanvasRef.current || !project) return

    const fabricCanvas = fabricCanvasRef.current
    const canvasSize = FORMAT_CANVAS_SIZES[project.format]

    // Get current page
    const currentPage = currentPageIndex === -1
      ? project.coverPage
      : project.pages[currentPageIndex]

    if (!currentPage) return

    // Clear canvas
    fabricCanvas.clear()

    // Set background
    if (currentPage.background.type === 'color') {
      fabricCanvas.backgroundColor = currentPage.background.value
    } else if (currentPage.background.type === 'image') {
      fabric.Image.fromURL(currentPage.background.value, (img) => {
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
          scaleX: canvasSize.width / (img.width || 1),
          scaleY: canvasSize.height / (img.height || 1),
        })
      })
    }

    // Render elements
    currentPage.elements.forEach((element) => {
      if (element.type === 'text') {
        renderTextElement(fabricCanvas, element, canvasSize)
      } else if (element.type === 'photo' && element.photoUrl) {
        renderPhotoElement(fabricCanvas, element, canvasSize)
      }
    })

    fabricCanvas.renderAll()
  }, [project, currentPageIndex])

  // Highlight selected element
  useEffect(() => {
    if (!fabricCanvasRef.current) return

    const fabricCanvas = fabricCanvasRef.current
    const objects = fabricCanvas.getObjects()

    objects.forEach((obj) => {
      if (obj.data?.elementId === selectedElementId) {
        fabricCanvas.setActiveObject(obj)
      }
    })

    fabricCanvas.renderAll()
  }, [selectedElementId])

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

// Helper function to render text elements
function renderTextElement(
  canvas: fabric.Canvas,
  element: EditorElement,
  canvasSize: { width: number; height: number }
) {
  const textObj = new fabric.IText(element.content || 'Текст', {
    left: element.x * canvasSize.width,
    top: element.y * canvasSize.height,
    width: element.width * canvasSize.width,
    fontFamily: element.fontFamily || 'Montserrat',
    fontSize: element.fontSize || 24,
    fill: element.color || '#000000',
    textAlign: element.align || 'left',
    fontWeight: element.bold ? 'bold' : 'normal',
    fontStyle: element.italic ? 'italic' : 'normal',
    underline: element.underline || false,
    charSpacing: (element.letterSpacing || 0) * 10,
    lineHeight: element.lineHeight || 1.2,
    opacity: (element.opacity ?? 100) / 100,
    angle: element.rotation || 0,
    selectable: true,
    editable: true,
    hasControls: true,
    hasBorders: true,
    lockUniScaling: false,
  })

  // Store element ID in object data
  textObj.set('data', { elementId: element.id })

  canvas.add(textObj)
}

// Helper function to render photo elements
function renderPhotoElement(
  canvas: fabric.Canvas,
  element: EditorElement,
  canvasSize: { width: number; height: number }
) {
  if (!element.photoUrl) return

  fabric.Image.fromURL(element.photoUrl, (img) => {
    const imgWidth = element.width * canvasSize.width
    const imgHeight = element.height * canvasSize.height

    img.set({
      left: element.x * canvasSize.width,
      top: element.y * canvasSize.height,
      scaleX: imgWidth / (img.width || 1),
      scaleY: imgHeight / (img.height || 1),
      opacity: (element.opacity ?? 100) / 100,
      angle: element.rotation || 0,
      selectable: true,
      hasControls: true,
      hasBorders: true,
    })

    // Apply crop if specified
    if (element.cropX !== undefined && element.cropY !== undefined && element.cropZoom !== undefined) {
      const cropZoom = element.cropZoom
      const cropX = element.cropX
      const cropY = element.cropY

      // Calculate crop rect
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

    // Store element ID in object data
    img.set('data', { elementId: element.id })

    canvas.add(img)
    canvas.renderAll()
  }, { crossOrigin: 'anonymous' })
}
