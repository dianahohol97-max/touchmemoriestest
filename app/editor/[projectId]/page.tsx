'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Undo, Redo, Eye, ShoppingCart, Type } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { EditorProject, ProductType, Format } from '@/lib/editor-types'
import { createClient } from '@/lib/supabase/client'

// Import editor components
import LeftPanel from './components/LeftPanel'
import CanvasArea from './components/CanvasArea'
import RightPanel from './components/RightPanel'
import PagesBottomStrip from './components/PagesBottomStrip'

export default function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)

  const { project, setProject, undo, redo, isDirty, history, historyIndex, addElement, currentPageIndex, setCurrentPage } = useEditorStore()

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!project) return

      // Page navigation
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [project, currentPageIndex, setCurrentPage])

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

  const handleAddText = () => {
    if (!project) return

    const currentPage = currentPageIndex === -1
      ? project.coverPage
      : project.pages[currentPageIndex]

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
      underline: false,
      letterSpacing: 0,
      lineHeight: 1.2,
      opacity: 100,
      zIndex: currentPage.elements.length,
    }

    addElement(currentPageIndex, newTextElement)
    useEditorStore.getState().selectElement(newTextElement.id)
  }

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

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Назад</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-lg font-semibold text-gray-900">
              {project.productType === 'photobook' ? 'Фотокнига' : project.productType === 'travelbook' ? 'Travel Book' : 'Журнал'} {project.format}
            </h1>
            {isDirty && <span className="text-xs text-orange-600">• Не збережено</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Скасувати (Ctrl+Z)"
            >
              <Undo className="w-5 h-5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Повторити (Ctrl+Y)"
            >
              <Redo className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-300 mx-2" />
            <button
              onClick={handleAddText}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              title="Додати текст"
            >
              <Type className="w-4 h-4" />
              Додати текст
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Зберегти
            </button>
            <button
              onClick={() => alert('Попередній перегляд у розробці')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Попередній перегляд"
            >
              <Eye className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/order')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] hover:bg-[#263a99] text-white rounded-lg font-medium transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Замовити
            </button>
          </div>
        </div>
      </header>

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
