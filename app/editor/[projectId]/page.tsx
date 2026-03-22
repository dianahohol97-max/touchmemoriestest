'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEditorStore } from '@/lib/editor-store'
import type { EditorProject, ProductType, Format } from '@/lib/editor-types'
import { createClient } from '@/lib/supabase/client'

// Import editor components
import EditorToolbar from '@/components/editor/EditorToolbar'
import PhotoEditingPanel from '@/components/editor/PhotoEditingPanel'
import LeftPanel from './components/LeftPanel'
import CanvasArea from './components/CanvasArea'
import RightPanel from './components/RightPanel'
import PagesBottomStrip from './components/PagesBottomStrip'

export default function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)

  const { project, setProject, isDirty, currentPageIndex, setCurrentPage, selectedElementId, removeElement } = useEditorStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!project) return

      // Delete key - remove selected element
      if (e.key === 'Delete' && selectedElementId) {
        if (confirm('Видалити цей елемент?')) {
          removeElement(currentPageIndex, selectedElementId)
        }
        return
      }

      // Escape key - deselect
      if (e.key === 'Escape' && selectedElementId) {
        useEditorStore.getState().selectElement(null)
        return
      }

      // Page navigation (only when no element is selected and no text input focused)
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' ||
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.getAttribute('contenteditable') === 'true'

      if (!isInputFocused && !selectedElementId) {
        if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
          if (currentPageIndex > -1) {
            setCurrentPage(currentPageIndex - 1)
          }
        } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
          if (currentPageIndex < project.pages.length - 1) {
            setCurrentPage(currentPageIndex + 1)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [project, currentPageIndex, setCurrentPage, selectedElementId, removeElement])

  useEffect(() => {
    const loadOrCreateProject = async () => {
      if (projectId === 'new') {
        // Create new project from query params
        const productType = (searchParams.get('product') || 'photobook') as ProductType
        const format = (searchParams.get('format') || '20x20') as Format
        const pages = parseInt(searchParams.get('pages') || '32')

        const newProject: EditorProject = {
          id: crypto.randomUUID(),
          productType,
          format,
          totalPages: pages,
          coverPage: {
            id: 'cover',
            pageNumber: 0,
            layoutId: 'blank',
            background: { type: 'color', value: '#ffffff' },
            elements: [],
          },
          pages: Array.from({ length: pages }, (_, i) => ({
            id: `page-${i + 1}`,
            pageNumber: i + 1,
            layoutId: 'blank',
            background: { type: 'color', value: '#ffffff' },
            elements: [],
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setProject(newProject)
        setLoading(false)
      } else {
        // Load existing project from Supabase
        const supabase = createClient()
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        if (error || !data) {
          console.error('Failed to load project:', error)
          router.push('/')
          return
        }

        const loadedProject: EditorProject = {
          id: data.id,
          productType: data.product_type,
          format: data.format,
          coverType: data.cover_type,
          totalPages: data.total_pages,
          pages: data.pages_data || [],
          coverPage: data.cover_data || {
            id: 'cover',
            pageNumber: 0,
            layoutId: 'blank',
            background: { type: 'color', value: '#ffffff' },
            elements: [],
          },
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }

        setProject(loadedProject)
        setLoading(false)
      }
    }

    loadOrCreateProject()
  }, [projectId, searchParams, setProject, router])

  const handleSave = async () => {
    if (!project) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert('Увійдіть, щоб зберегти проект')
      return
    }

    const projectData = {
      user_id: user.id,
      product_type: project.productType,
      format: project.format,
      cover_type: project.coverType,
      total_pages: project.totalPages,
      pages_data: project.pages,
      cover_data: project.coverPage,
      status: 'draft',
    }

    if (projectId === 'new') {
      // Insert new project
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (error) {
        console.error('Failed to save project:', error)
        alert('Помилка збереження проекту')
        return
      }

      // Redirect to the new project URL
      router.push(`/editor/${data.id}`)
    } else {
      // Update existing project
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', projectId)

      if (error) {
        console.error('Failed to update project:', error)
        alert('Помилка оновлення проекту')
        return
      }
    }

    useEditorStore.getState().markClean()
    alert('Проект збережено!')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e2d7d] mx-auto mb-4"></div>
          <p className="text-gray-600">Завантаження редактора...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600">Проект не знайдено</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99]"
          >
            Повернутись на головну
          </button>
        </div>
      </div>
    )
  }

  // Get current page and selected element
  const currentPage = project && currentPageIndex !== undefined
    ? (currentPageIndex === -1 ? project.coverPage : project.pages[currentPageIndex])
    : null

  const selectedElement = currentPage?.elements.find(
    el => el.id === selectedElementId
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <EditorToolbar />

      {/* Photo Editing Panel (shown when photo selected) */}
      {selectedElement && selectedElement.type === 'photo' && (
        <PhotoEditingPanel element={selectedElement} pageIndex={currentPageIndex} />
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          <aside className="w-72 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
            <LeftPanel />
          </aside>

          {/* Canvas Area */}
          <main className="flex-1 overflow-auto bg-gray-100">
            <CanvasArea />
          </main>

          {/* Right Panel */}
          <aside className="w-72 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
            <RightPanel />
          </aside>
        </div>

        {/* Bottom Pages Strip */}
        <PagesBottomStrip />
      </div>
    </div>
  )
}
