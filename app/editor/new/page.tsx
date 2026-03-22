'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEditorStore } from '@/lib/editor-store'

export default function NewEditorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { initProject } = useEditorStore()

  useEffect(() => {
    const product = searchParams.get('product') ?? 'photobook'
    const format = searchParams.get('format') ?? '20x20'
    const pages = parseInt(searchParams.get('pages') ?? '20', 10)

    const projectId = `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    initProject({
      id: projectId,
      product,
      format,
      pageCount: pages
    })

    router.replace(`/editor/${projectId}`)
  }, [router, searchParams, initProject])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#1e2d7d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Створюємо проєкт...</p>
      </div>
    </div>
  )
}
