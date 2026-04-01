'use client'

import { useEditorStore } from '@/lib/editor-store'
import { PAGE_LIMITS } from '@/lib/editor-types'
import { Plus, BookOpen } from 'lucide-react'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortablePageProps {
  page: any
  index: number
  isCover: boolean
  isActive: boolean
  onClick: () => void
}

function SortablePage({ page, index, isCover, isActive, onClick }: SortablePageProps) {
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
        className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${
          isActive
            ? 'ring-2 ring-[#1e2d7d] shadow-lg'
            : 'ring-1 ring-gray-200 hover:ring-gray-300'
        } ${isCover ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ width: '80px', height: '80px' }}
      >
        <div
          className="w-full h-full flex items-center justify-center relative"
          style={{
            backgroundColor: page.background.type === 'color'
              ? page.background.value
              : '#f9fafb'
          }}
        >
          {page.background.type === 'image' && (
            <img
              src={page.background.value}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
            />
          )}
          {page.elements.length === 0 && !isCover && (
            <div className="text-xs text-gray-400">Порожня</div>
          )}
          {isCover && <BookOpen className="w-6 h-6 text-gray-400" />}
          <div className="absolute bottom-1 left-1 right-1 text-center">
            <span className="text-xs font-medium bg-black/60 text-white px-2 py-0.5 rounded">
              {isCover ? 'Обкл.' : page.pageNumber}
            </span>
          </div>
        </div>
      </button>
    </div>
  )
}

export default function PagesBottomStrip() {
  const { project, currentPageIndex, setCurrentPage, reorderPages, addPage } = useEditorStore()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (!project) return null

  const limits = PAGE_LIMITS[project.productType]
  const canAddPages = project.pages.length < limits.max

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

  const allPages = [
    { ...project.coverPage, isCover: true, index: -1 },
    ...project.pages.map((p, i) => ({ ...p, isCover: false, index: i }))
  ]

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center gap-3">
          {/* Cover Page (not sortable) */}
          <SortablePage
            page={project.coverPage}
            index={-1}
            isCover={true}
            isActive={currentPageIndex === -1}
            onClick={() => setCurrentPage(-1)}
          />

          {/* Add button after cover */}
          {canAddPages && (
            <button
              onClick={() => addPage(-1)}
              className="flex-shrink-0 w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#1e2d7d] hover:bg-[#f0f2f8] transition-colors flex items-center justify-center"
              title="Додати сторінку"
            >
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {/* Regular Pages (sortable) */}
          <SortableContext
            items={project.pages.map(p => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            {project.pages.map((page, index) => (
              <div key={page.id} className="flex items-center gap-3">
                <SortablePage
                  page={page}
                  index={index}
                  isCover={false}
                  isActive={currentPageIndex === index}
                  onClick={() => setCurrentPage(index)}
                />

                {/* Add button between pages */}
                {canAddPages && index < project.pages.length - 1 && (
                  <button
                    onClick={() => addPage(index)}
                    className="flex-shrink-0 w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#1e2d7d] hover:bg-[#f0f2f8] transition-colors flex items-center justify-center"
                    title="Додати сторінку"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            ))}
          </SortableContext>

          {/* Add button at end */}
          {canAddPages && (
            <button
              onClick={() => addPage(project.pages.length - 1)}
              className="flex-shrink-0 w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#1e2d7d] hover:bg-[#f0f2f8] transition-colors flex items-center justify-center"
              title="Додати сторінку"
            >
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </DndContext>

      {/* Page counter */}
      <div className="ml-auto flex-shrink-0 text-sm text-gray-600">
        Сторінка {currentPageIndex === -1 ? 'Обкладинка' : currentPageIndex + 1} з {project.pages.length}
      </div>
    </div>
  )
}
