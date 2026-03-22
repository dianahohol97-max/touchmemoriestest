'use client'

import { useState } from 'react'
import { useEditorStore } from '@/lib/editor-store'
import { PAGE_LIMITS } from '@/lib/editor-types'
import { Plus, Trash2, BookOpen, Copy } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ContextMenu {
  pageIndex: number
  x: number
  y: number
}

interface SortablePageItemProps {
  page: any
  index: number
  isCover: boolean
  isActive: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent, index: number) => void
}

function SortablePageItem({ page, index, isCover, isActive, onClick, onContextMenu }: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: isCover })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={onClick}
        onContextMenu={(e) => onContextMenu(e, index)}
        className={`
          w-full rounded-lg border-2 transition-all overflow-hidden
          ${isActive
            ? 'border-[#1e2d7d] shadow-md'
            : 'border-gray-200 hover:border-gray-300'
          }
          ${isCover ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
        `}
      >
        <div
          className="aspect-square flex items-center justify-center relative"
          style={{
            backgroundColor: page.background.type === 'color'
              ? page.background.value
              : '#f9fafb'
          }}
        >
          {page.background.type === 'image' && (
            <img
              src={page.background.value}
              alt={isCover ? 'Cover' : `Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
            />
          )}
          {page.elements.length === 0 && !isCover && (
            <div className="text-xs text-gray-400">Порожня сторінка</div>
          )}
          {isCover && <BookOpen className="w-8 h-8 text-gray-300" />}
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
            {isCover ? 'Обкладинка' : page.pageNumber}
          </div>
        </div>
        <div className="p-2 bg-white text-left">
          <p className="text-xs font-medium text-gray-700">
            {isCover ? 'Обкладинка' : `Сторінка ${page.pageNumber}`}
          </p>
          <p className="text-xs text-gray-500">
            {page.elements.length} елементів
          </p>
        </div>
      </button>
    </div>
  )
}

export default function PagesPanel() {
  const { project, currentPageIndex, setCurrentPage, addPage, deletePage, duplicatePage, reorderPages } = useEditorStore()
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (!project) return null

  const limits = PAGE_LIMITS[project.productType]
  const canAddPages = project.pages.length < limits.max
  const canDeletePages = project.pages.length > limits.min

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = project.pages.findIndex(p => p.id === active.id)
      const newIndex = project.pages.findIndex(p => p.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderPages(oldIndex, newIndex)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, pageIndex: number) => {
    e.preventDefault()
    setContextMenu({ pageIndex, x: e.clientX, y: e.clientY })
  }

  const handleDelete = () => {
    if (contextMenu && canDeletePages) {
      deletePage(contextMenu.pageIndex)
    }
    setContextMenu(null)
  }

  const handleDuplicate = () => {
    if (contextMenu && canAddPages) {
      duplicatePage(contextMenu.pageIndex)
    }
    setContextMenu(null)
  }

  // Close context menu on click outside
  const handleClickOutside = () => {
    setContextMenu(null)
  }

  return (
    <div className="h-full flex flex-col bg-white" onClick={handleClickOutside}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Сторінки</h3>
          <span className="text-xs text-gray-500">
            {project.pages.length} / {limits.max}
          </span>
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Cover Page (not draggable) */}
        <button
          onClick={() => setCurrentPage(-1)}
          onContextMenu={(e) => handleContextMenu(e, -1)}
          className={`
            w-full rounded-lg border-2 transition-all overflow-hidden
            ${currentPageIndex === -1
              ? 'border-[#1e2d7d] shadow-md'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
            {project.coverPage.elements.length > 0 ? (
              <div className="text-xs text-gray-400">Обкладинка</div>
            ) : (
              <BookOpen className="w-8 h-8 text-gray-300" />
            )}
            <div className="absolute top-2 left-2 bg-[#1e2d7d] text-white text-xs px-2 py-0.5 rounded">
              Обкладинка
            </div>
          </div>
          <div className="p-2 bg-white text-left">
            <p className="text-xs font-medium text-gray-700">Обкладинка</p>
            <p className="text-xs text-gray-500">
              {project.coverPage.elements.length} елементів
            </p>
          </div>
        </button>

        {/* Regular Pages (draggable) */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={project.pages.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {project.pages.map((page, index) => (
              <SortablePageItem
                key={page.id}
                page={page}
                index={index}
                isCover={false}
                isActive={currentPageIndex === index}
                onClick={() => setCurrentPage(index)}
                onContextMenu={handleContextMenu}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer - Add/Delete Pages */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <button
            onClick={() => addPage(project.pages.length - 1)}
            disabled={!canAddPages}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              canAddPages
                ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={canAddPages ? 'Додати сторінку' : `Максимум ${limits.max} сторінок`}
          >
            <Plus className="w-4 h-4" />
            Додати
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Мін: {limits.min}, Макс: {limits.max}
        </p>
      </div>

      {/* Context Menu */}
      {contextMenu && contextMenu.pageIndex >= 0 && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDuplicate}
            disabled={!canAddPages}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4" />
            Дублювати сторінку
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDeletePages}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Видалити сторінку
          </button>
        </div>
      )}
    </div>
  )
}
