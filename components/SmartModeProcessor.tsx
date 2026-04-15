'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Check, ChevronDown, ChevronUp, RotateCcw, Loader2 } from 'lucide-react'

interface ProcessingStage {
  id: number
  label: string
  progress: number // 0-100
  done: boolean
}

interface RemovedPhoto {
  originalIndex: number
  reason: 'duplicate' | 'blurry' | 'low_resolution' | 'error' | string
  fileName: string
  objectUrl?: string
  restored: boolean
}

interface AutoLayoutPage {
  photos: { file: File; index: number }[]
  layout: 'full' | 'half' | 'thirds'
}

interface ProcessingStats {
  total: number
  kept: number
  duplicates: number
  lowQuality: number
  recommendedPages: number
}

interface SmartModeProcessorProps {
  files: File[]
  productType: 'photobook' | 'magazine' | 'travelbook'
  onComplete: (keptFiles: File[], layout: AutoLayoutPage[], stats: ProcessingStats) => void
  onCancel: () => void
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Визначення дублікатів',
  2: 'Перевірка якості',
  3: 'Хронологічне сортування',
  4: 'Авторозкладка сторінок',
}

const REASON_LABELS: Record<string, string> = {
  duplicate: 'Дублікат',
  blurry: 'Розмите фото',
  low_resolution: 'Низька роздільна здатність',
  error: 'Помилка читання',
}

export default function SmartModeProcessor({
  files,
  productType,
  onComplete,
  onCancel,
}: SmartModeProcessorProps) {
  const workerRef = useRef<Worker | null>(null)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [processingDone, setProcessingDone] = useState(false)
  const [stages, setStages] = useState<ProcessingStage[]>([
    { id: 1, label: STAGE_LABELS[1], progress: 0, done: false },
    { id: 2, label: STAGE_LABELS[2], progress: 0, done: false },
    { id: 3, label: STAGE_LABELS[3], progress: 0, done: false },
    { id: 4, label: STAGE_LABELS[4], progress: 0, done: false },
  ])
  const [currentStage, setCurrentStage] = useState(0)
  const [removedPhotos, setRemovedPhotos] = useState<RemovedPhoto[]>([])
  const [keptFiles, setKeptFiles] = useState<File[]>([])
  const [layout, setLayout] = useState<AutoLayoutPage[]>([])
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)

  // Start worker on mount
  useEffect(() => {
    const worker = new Worker('/workers/imageProcessor.worker.js')
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'FILE_PROGRESS') {
        setUploadedCount(msg.index + 1)
      } else if (msg.type === 'STAGE') {
        const stageId: number = msg.stage
        setCurrentStage(stageId)
        setStages((prev) =>
          prev.map((s) => {
            if (s.id === stageId) return { ...s, progress: msg.progress }
            if (s.id < stageId) return { ...s, done: true, progress: 100 }
            return s
          })
        )
      } else if (msg.type === 'DONE') {
        // Mark all stages done
        setStages((prev) => prev.map((s) => ({ ...s, done: true, progress: 100 })))
        setProcessingDone(true)
        setKeptFiles(msg.keptFiles)
        setLayout(msg.layout)
        setStats(msg.stats)

        // Build removed photos list with object URLs
        const removed: RemovedPhoto[] = msg.removedItems.map(
          (item: { originalIndex: number; reason: string; fileName: string }) => ({
            originalIndex: item.originalIndex,
            reason: item.reason,
            fileName: item.fileName,
            objectUrl: URL.createObjectURL(files[item.originalIndex]),
            restored: false,
          })
        )
        setRemovedPhotos(removed)
      }
    }

    worker.onerror = (err) => {
      console.error('Worker error:', err)
    }

    // Start processing
    worker.postMessage({
      type: 'PROCESS_IMAGES',
      files,
      productType,
      thresholds: {
        dupeSimilarity: 0.9,
        blurMin: 80,
        minWidth: 600,
        minHeight: 400,
      },
    })

    return () => {
      worker.terminate()
      // Revoke object URLs on cleanup
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const restorePhoto = useCallback((index: number) => {
    setRemovedPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, restored: true } : p))
    )
  }, [])

  const handleProceed = useCallback(() => {
    // Merge restored photos back in
    const restoredFiles = removedPhotos
      .filter((p) => p.restored)
      .map((p) => files[p.originalIndex])

    onComplete([...keptFiles, ...restoredFiles], layout, stats!)
  }, [keptFiles, layout, stats, removedPhotos, files, onComplete])

  const activeRemovedCount = removedPhotos.filter((p) => !p.restored).length

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F0EDFF] mb-5">
            <Loader2 size={32} className={`text-[#6B48FF] ${!processingDone ? 'animate-spin' : ''}`} />
          </div>
          <h2 className="text-3xl font-black text-[#0D0D0D] mb-2">
            {processingDone ? 'Обробка завершена' : 'AI обробляє фотографії…'}
          </h2>
          <p className="text-gray-500 text-sm">
            Завантажено{' '}
            <span className="font-bold text-[#0D0D0D]">{uploadedCount}</span>{' '}
            з{' '}
            <span className="font-bold text-[#0D0D0D]">{files.length}</span>{' '}
            фото
          </p>
        </div>

        {/* Stages */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          {stages.map((stage, idx) => {
            const isActive = currentStage === stage.id
            const isPending = currentStage < stage.id && !stage.done
            return (
              <div
                key={stage.id}
                className={`px-6 py-5 ${idx < stages.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                        stage.done
                          ? 'bg-[#10B981] text-white'
                          : isActive
                          ? 'bg-[#6B48FF] text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {stage.done ? <Check size={14} /> : stage.id}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        isPending ? 'text-gray-400' : 'text-[#0D0D0D]'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {stage.done ? '100%' : isActive ? `${stage.progress}%` : '—'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="ml-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stage.done ? 'bg-[#10B981]' : 'bg-[#6B48FF]'
                    }`}
                    style={{ width: `${stage.done ? 100 : isActive ? stage.progress : 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary (shown after done) */}
        {processingDone && stats && (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Відібрано фото', value: `${stats.kept} з ${stats.total}`, color: 'text-[#10B981]' },
                { label: 'Дублікати видалено', value: stats.duplicates, color: 'text-gray-500' },
                { label: 'Неякісних видалено', value: stats.lowQuality, color: 'text-gray-500' },
                { label: 'Рекомендовано сторінок', value: stats.recommendedPages, color: 'text-[#6B48FF]' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className={`text-2xl font-black mb-1 ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-500 leading-snug">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Removed photos collapsible */}
            {removedPhotos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setShowRemoved((v) => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>
                    Видалені фото ({activeRemovedCount} з {removedPhotos.length})
                  </span>
                  {showRemoved ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showRemoved && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {removedPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 px-6 py-3 ${
                          photo.restored ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        {photo.objectUrl && (
                          <img
                            src={photo.objectUrl}
                            alt={photo.fileName}
                            className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0D0D0D] truncate">
                            {photo.fileName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {photo.restored
                              ? ' Відновлено'
                              : REASON_LABELS[photo.reason] || photo.reason}
                          </p>
                        </div>
                        {!photo.restored && (
                          <button
                            onClick={() => restorePhoto(idx)}
                            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-[#6B48FF] hover:text-[#5035CC] transition-colors"
                          >
                            <RotateCcw size={13} />
                            Відновити
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                ← Назад
              </button>
              <button
                onClick={handleProceed}
                className="flex-2 flex-grow-[2] py-4 bg-[#0D0D0D] text-white font-bold rounded-xl hover:bg-[#333] transition-colors text-sm"
              >
                Продовжити в редакторі →
              </button>
            </div>
          </div>
        )}

        {/* Cancel while processing */}
        {!processingDone && (
          <div className="flex justify-center">
            <button
              onClick={onCancel}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Скасувати
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
