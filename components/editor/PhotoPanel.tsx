'use client'

import { useState, useRef, DragEvent } from 'react'
import { useEditorStore } from '@/lib/editor-store'
import { createClient } from '@/lib/supabase/client'
import { Upload, Image as ImageIcon, X } from 'lucide-react'
import type { EditorElement } from '@/lib/editor-types'

export default function PhotoPanel() {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { uploadedPhotos, addUploadedPhoto, removeUploadedPhoto, project, currentPageIndex, addElement } = useEditorStore()

  const supabase = createClient()

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !project) return

    setUploading(true)

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue

      try {
        const fileId = `${Date.now()}-${file.name}`
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

        const { data, error } = await supabase.storage
          .from('editor-photos')
          .upload(`${project.id}/${fileId}`, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (error) {
          console.error('Upload error:', error)
          setUploadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[fileId]
            return newProgress
          })
          continue
        }

        const { data: urlData } = supabase.storage
          .from('editor-photos')
          .getPublicUrl(data.path)

        addUploadedPhoto({
          id: data.path,
          url: urlData.publicUrl,
          name: file.name
        })

        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))

        // Remove from progress after short delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[fileId]
            return newProgress
          })
        }, 1000)

      } catch (error) {
        console.error('Upload failed:', error)
      }
    }

    setUploading(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    handleFileUpload(files)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files)
  }

  const handlePhotoClick = (photoUrl: string) => {
    if (!project) return

    // Find first empty photo slot on current page
    const currentPage = currentPageIndex === -1
      ? project.coverPage
      : project.pages[currentPageIndex]

    if (!currentPage) return

    const emptyPhotoSlot = currentPage.elements.find(
      el => el.type === 'photo' && !el.photoUrl
    )

    if (emptyPhotoSlot) {
      // Fill the empty slot
      useEditorStore.getState().updateElement(currentPageIndex, emptyPhotoSlot.id, {
        photoUrl,
        cropX: 0.5,
        cropY: 0.5,
        cropZoom: 1.0,
      })
    } else {
      // Add new photo element to center of page
      const newElement: EditorElement = {
        id: `photo-${Date.now()}`,
        type: 'photo',
        x: 0.4, // Center horizontally
        y: 0.4, // Center vertically
        width: 0.2, // 20% of page width
        height: 0.2, // 20% of page height
        rotation: 0,
        photoUrl,
        cropX: 0.5,
        cropY: 0.5,
        cropZoom: 1.0,
        opacity: 100,
        zIndex: currentPage.elements.length,
      }

      addElement(currentPageIndex, newElement)
    }
  }

  const handlePhotoRemove = async (photoId: string) => {
    try {
      await supabase.storage.from('editor-photos').remove([photoId])
      removeUploadedPhoto(photoId)
    } catch (error) {
      console.error('Failed to delete photo:', error)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Upload Area */}
      <div className="p-4 border-b border-gray-200">
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-6 cursor-pointer
            transition-all duration-200
            ${dragActive
              ? 'border-[#1e2d7d] bg-[#f0f2f8]'
              : 'border-gray-300 hover:border-[#1e2d7d] hover:bg-gray-50'
            }
          `}
        >
          <div className="flex flex-col items-center text-center">
            <Upload
              className={`w-8 h-8 mb-2 ${dragActive ? 'text-[#1e2d7d]' : 'text-gray-400'}`}
            />
            <p className="text-sm font-medium text-gray-700 mb-1">
              {dragActive ? 'Відпустіть файли' : 'Перетягніть фото сюди'}
            </p>
            <p className="text-xs text-gray-500">
              або клацніть для вибору
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* Upload Progress */}
        {Object.entries(uploadProgress).length > 0 && (
          <div className="mt-3 space-y-2">
            {Object.entries(uploadProgress).map(([fileId, progress]) => (
              <div key={fileId} className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-[#1e2d7d] h-1.5 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{progress}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {uploadedPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ImageIcon className="w-12 h-12 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Ще немає завантажених фото</p>
            <p className="text-xs text-gray-400 mt-1">
              Завантажте фото щоб почати
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {uploadedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer border-2 border-transparent hover:border-[#1e2d7d] transition-all"
                onClick={() => handlePhotoClick(photo.url)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('photoUrl', photo.url)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs font-medium px-2 text-center">
                    Клацніть або перетягніть на сторінку
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePhotoRemove(photo.id)
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
