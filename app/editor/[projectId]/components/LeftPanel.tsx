'use client'

import { useState } from 'react'
import { FileText, Image, Layout } from 'lucide-react'
import PhotoPanel from '@/components/editor/PhotoPanel'
import TemplatePanel from '@/components/editor/TemplatePanel'
import PagesPanel from './PagesPanel'

type TabType = 'pages' | 'photos' | 'templates'

export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('pages')

  const tabs = [
    { id: 'pages' as TabType, label: 'Сторінки', icon: FileText },
    { id: 'photos' as TabType, label: 'Фото', icon: Image },
    { id: 'templates' as TabType, label: 'Шаблони', icon: Layout },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 px-4
                font-medium text-sm transition-colors border-b-2
                ${activeTab === tab.id
                  ? 'border-[#1e2d7d] text-[#1e2d7d] bg-[#f0f2f8]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pages' && <PagesPanel />}
        {activeTab === 'photos' && <PhotoPanel />}
        {activeTab === 'templates' && <TemplatePanel />}
      </div>
    </div>
  )
}
