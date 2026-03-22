import { create } from 'zustand'
import type { EditorProject, EditorPage, EditorElement, UploadedPhoto } from './editor-types'

interface EditorState {
  project: EditorProject | null
  currentPageIndex: number
  selectedElementId: string | null
  uploadedPhotos: UploadedPhoto[]
  history: EditorProject[]
  historyIndex: number
  isDirty: boolean

  // Actions
  initProject: (params: { id: string; product: string; format: string; pageCount: number }) => void
  setProject: (p: EditorProject) => void
  setCurrentPage: (index: number) => void
  selectElement: (id: string | null) => void
  updateElement: (pageIndex: number, elementId: string, updates: Partial<EditorElement>) => void
  addElement: (pageIndex: number, element: EditorElement) => void
  removeElement: (pageIndex: number, elementId: string) => void
  setPageBackground: (pageIndex: number, bg: EditorPage['background']) => void
  setPageLayout: (pageIndex: number, layoutId: string) => void
  addUploadedPhoto: (photo: UploadedPhoto) => void
  removeUploadedPhoto: (photoId: string) => void
  addPage: (afterIndex: number) => void
  deletePage: (pageIndex: number) => void
  duplicatePage: (pageIndex: number) => void
  reorderPages: (fromIndex: number, toIndex: number) => void
  undo: () => void
  redo: () => void
  saveSnapshot: () => void
  markClean: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  currentPageIndex: 0,
  selectedElementId: null,
  uploadedPhotos: [],
  history: [],
  historyIndex: -1,
  isDirty: false,

  initProject: ({ id, product, format, pageCount }) => {
    const pages: EditorPage[] = Array.from({ length: pageCount }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      layoutId: 'blank',
      background: { type: 'color', value: '#ffffff' },
      elements: [],
    }))

    const newProject: EditorProject = {
      id,
      productType: product as any,
      format: format as any,
      totalPages: pageCount,
      coverPage: {
        id: 'cover',
        pageNumber: 0,
        layoutId: 'blank',
        background: { type: 'color', value: '#ffffff' },
        elements: [],
      },
      pages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    set({
      project: newProject,
      currentPageIndex: 0,
      history: [newProject],
      historyIndex: 0,
      isDirty: false
    })
  },

  setProject: (p) => {
    set({ project: p, history: [p], historyIndex: 0, isDirty: false })
  },

  setCurrentPage: (index) => {
    set({ currentPageIndex: index, selectedElementId: null })
  },

  selectElement: (id) => {
    set({ selectedElementId: id })
  },

  updateElement: (pageIndex, elementId, updates) => {
    const { project } = get()
    if (!project) return

    const newProject = { ...project }
    const targetPage = pageIndex === -1 ? newProject.coverPage : newProject.pages[pageIndex]

    if (targetPage) {
      targetPage.elements = targetPage.elements.map(el =>
        el.id === elementId ? { ...el, ...updates } : el
      )
      set({ project: newProject, isDirty: true })
      get().saveSnapshot()
    }
  },

  addElement: (pageIndex, element) => {
    const { project } = get()
    if (!project) return

    const newProject = { ...project }
    const targetPage = pageIndex === -1 ? newProject.coverPage : newProject.pages[pageIndex]

    if (targetPage) {
      targetPage.elements.push(element)
      set({ project: newProject, selectedElementId: element.id, isDirty: true })
      get().saveSnapshot()
    }
  },

  removeElement: (pageIndex, elementId) => {
    const { project } = get()
    if (!project) return

    const newProject = { ...project }
    const targetPage = pageIndex === -1 ? newProject.coverPage : newProject.pages[pageIndex]

    if (targetPage) {
      targetPage.elements = targetPage.elements.filter(el => el.id !== elementId)
      set({ project: newProject, selectedElementId: null, isDirty: true })
      get().saveSnapshot()
    }
  },

  setPageBackground: (pageIndex, bg) => {
    const { project } = get()
    if (!project) return

    const newProject = { ...project }
    const targetPage = pageIndex === -1 ? newProject.coverPage : newProject.pages[pageIndex]

    if (targetPage) {
      targetPage.background = bg
      set({ project: newProject, isDirty: true })
      get().saveSnapshot()
    }
  },

  setPageLayout: (pageIndex, layoutId) => {
    const { project } = get()
    if (!project) return

    const newProject = { ...project }
    const targetPage = pageIndex === -1 ? newProject.coverPage : newProject.pages[pageIndex]

    if (targetPage) {
      targetPage.layoutId = layoutId
      set({ project: newProject, isDirty: true })
      get().saveSnapshot()
    }
  },

  addUploadedPhoto: (photo) => {
    set((state) => ({
      uploadedPhotos: [...state.uploadedPhotos, photo]
    }))
  },

  removeUploadedPhoto: (photoId) => {
    set((state) => ({
      uploadedPhotos: state.uploadedPhotos.filter(p => p.id !== photoId)
    }))
  },

  addPage: (afterIndex) => {
    const { project } = get()
    if (!project) return

    const newProject = { ...project }
    const newPageNumber = afterIndex + 2 // +1 for 0-index, +1 for after

    const newPage: EditorPage = {
      id: `page-${Date.now()}`,
      pageNumber: newPageNumber,
      layoutId: 'blank',
      background: { type: 'color', value: '#ffffff' },
      elements: [],
    }

    newProject.pages.splice(afterIndex + 1, 0, newPage)

    // Renumber pages
    newProject.pages.forEach((page, index) => {
      page.pageNumber = index + 1
    })

    newProject.totalPages = newProject.pages.length

    set({ project: newProject, isDirty: true })
    get().saveSnapshot()
  },

  deletePage: (pageIndex) => {
    const { project } = get()
    if (!project || pageIndex < 0 || pageIndex >= project.pages.length) return

    const newProject = { ...project }
    newProject.pages.splice(pageIndex, 1)

    // Renumber pages
    newProject.pages.forEach((page, index) => {
      page.pageNumber = index + 1
    })

    newProject.totalPages = newProject.pages.length

    // Adjust current page index if needed
    const newCurrentIndex = pageIndex >= newProject.pages.length
      ? newProject.pages.length - 1
      : pageIndex

    set({ project: newProject, currentPageIndex: newCurrentIndex, isDirty: true })
    get().saveSnapshot()
  },

  duplicatePage: (pageIndex) => {
    const { project } = get()
    if (!project || pageIndex < 0 || pageIndex >= project.pages.length) return

    const newProject = { ...project }
    const pageToDuplicate = newProject.pages[pageIndex]

    const duplicatedPage: EditorPage = {
      ...pageToDuplicate,
      id: `page-${Date.now()}`,
      pageNumber: pageIndex + 2,
      elements: pageToDuplicate.elements.map(el => ({
        ...el,
        id: `${el.id}-dup-${Date.now()}`
      }))
    }

    newProject.pages.splice(pageIndex + 1, 0, duplicatedPage)

    // Renumber pages
    newProject.pages.forEach((page, index) => {
      page.pageNumber = index + 1
    })

    newProject.totalPages = newProject.pages.length

    set({ project: newProject, currentPageIndex: pageIndex + 1, isDirty: true })
    get().saveSnapshot()
  },

  reorderPages: (fromIndex, toIndex) => {
    const { project } = get()
    if (!project || fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= project.pages.length || toIndex >= project.pages.length) return
    if (fromIndex === toIndex) return

    const newProject = { ...project }
    const [movedPage] = newProject.pages.splice(fromIndex, 1)
    newProject.pages.splice(toIndex, 0, movedPage)

    // Renumber pages
    newProject.pages.forEach((page, index) => {
      page.pageNumber = index + 1
    })

    set({ project: newProject, currentPageIndex: toIndex, isDirty: true })
    get().saveSnapshot()
  },

  saveSnapshot: () => {
    const { project, history, historyIndex } = get()
    if (!project) return

    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ ...project })

    // Limit history to last 50 snapshots
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      set({ historyIndex: historyIndex + 1 })
    }

    set({ history: newHistory })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
      set({
        project: history[historyIndex - 1],
        historyIndex: historyIndex - 1,
        isDirty: true
      })
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
      set({
        project: history[historyIndex + 1],
        historyIndex: historyIndex + 1,
        isDirty: true
      })
    }
  },

  markClean: () => {
    set({ isDirty: false })
  },
}))
