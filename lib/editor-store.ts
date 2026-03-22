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
