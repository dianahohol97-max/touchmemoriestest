'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SmartModeSelector from '@/components/SmartModeSelector'
import SmartModeProcessor from '@/components/SmartModeProcessor'

type Step = 0 | 'smart'

export default function PhotobookConstructorPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [smartFiles, setSmartFiles] = useState<File[]>([])

  // Mode selector screen
  if (step === 0) {
    return (
      <SmartModeSelector
        productTitle="Конструктор фотокниги"
        onSmartUpload={(files) => {
          setSmartFiles(files)
          setStep('smart')
        }}
        onManualSelect={() =>
          router.push('/order/book?product=photobook-velour')
        }
      />
    )
  }

  // Smart mode: AI pipeline → editor
  return (
    <SmartModeProcessor
      files={smartFiles}
      productType="photobook"
      onComplete={(_keptFiles, _layout, stats) => {
        // Store processing results for the editor to read
        try {
          sessionStorage.setItem(
            'smartModeResult',
            JSON.stringify({
              fileNames: _keptFiles.map((f) => f.name),
              layout: _layout,
              stats,
              timestamp: Date.now(),
            })
          )
        } catch (_) {}
        router.push('/order/book?product=photobook-velour&smartMode=1')
      }}
      onCancel={() => setStep(0)}
    />
  )
}
