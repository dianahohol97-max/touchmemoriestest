'use client'

import React, { useCallback, useRef } from 'react'
import { Sparkles, Pencil, Upload } from 'lucide-react'

interface SmartModeSelectorProps {
  productTitle: string
  onSmartUpload: (files: File[]) => void
  onManualSelect: () => void
}

export default function SmartModeSelector({
  productTitle,
  onSmartUpload,
  onManualSelect,
}: SmartModeSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const arr = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      )
      if (arr.length > 0) onSmartUpload(arr)
    },
    [onSmartUpload]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs font-semibold tracking-[3px] text-gray-400 uppercase mb-3">
          TouchMemories Studio
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-[#0D0D0D] mb-4 leading-tight">
          {productTitle}
        </h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto">
          Оберіть спосіб створення
        </p>
      </div>

      {/* Two-column cards */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT — SMART MODE */}
        <div className="relative flex flex-col bg-white rounded-3xl border-2 border-[#0D0D0D] shadow-[6px_6px_0px_#0D0D0D] overflow-hidden">
          {/* Badge */}
          <div className="absolute top-5 right-5">
            <span className="inline-flex items-center gap-1 bg-[#0D0D0D] text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <Sparkles size={12} />
              AI
            </span>
          </div>

          <div className="p-8 flex flex-col flex-1">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-[#F0EDFF] flex items-center justify-center mb-6">
              <Sparkles size={28} className="text-[#6B48FF]" />
            </div>

            <h2 className="text-2xl font-black text-[#0D0D0D] mb-3">
              Розумна фотокнига
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8 flex-1">
              Завантажте фото — AI автоматично відбере найкращі, видалить
              дублікати, відсортує хронологічно та розподілить по сторінках
            </p>

            {/* Primary CTA */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-[#0D0D0D] text-white font-bold text-base py-4 rounded-xl hover:bg-[#333] transition-colors mb-4"
            >
              <Upload size={18} />
              + Додати фото
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/jpg,image/heic,image/webp"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Drag & Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 rounded-xl py-5 text-center cursor-pointer hover:border-[#6B48FF] hover:bg-[#F0EDFF]/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm text-gray-400">або перетягніть сюди</p>
            </div>
          </div>
        </div>

        {/* RIGHT — MANUAL MODE */}
        <div className="flex flex-col bg-white rounded-3xl border-2 border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 flex flex-col flex-1">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] flex items-center justify-center mb-6">
              <Pencil size={28} className="text-gray-600" />
            </div>

            <h2 className="text-2xl font-black text-[#0D0D0D] mb-3">
              Ручне створення
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8 flex-1">
              Повний контроль над процесом створення. Самостійно обирайте
              фотографії, розташування та дизайн кожної сторінки.
            </p>

            <button
              onClick={onManualSelect}
              className="w-full flex items-center justify-center gap-2 border-2 border-[#0D0D0D] text-[#0D0D0D] font-bold text-base py-4 rounded-xl hover:bg-[#F5F5F5] transition-colors"
            >
              Перейти до редактора
              <span className="ml-1">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-gray-400 text-center max-w-xs">
        Всі фото обробляються прямо у браузері — ми не завантажуємо їх на
        сервер до підтвердження замовлення
      </p>
    </div>
  )
}
