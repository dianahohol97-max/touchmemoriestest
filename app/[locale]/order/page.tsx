'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload, X, FileImage, ChevronRight, ChevronLeft, Check, MessageCircle, Mail, Phone, User } from 'lucide-react'
import { compressImageFile } from '@/lib/compress-upload-image'
import { uploadImageToStorage } from '@/lib/storage-upload'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import FlowHeader from '@/components/ui/FlowHeader'

interface UploadedFile {
  id: string
  name: string
  size: number
  preview?: string
  file: File
}

interface OrderFormData {
  files: UploadedFile[]
  comment: string
  ownText: string
  kalkaText: string
  delivery: 'nova_poshta' | 'pickup' | ''
  city: string
  address: string
  name: string
  lastName: string
  phone: string
  contactChannel: 'telegram' | 'email' | ''
  contactHandle: string
  coverInscription: string
  coverPhoto: UploadedFile | null
}

const STEPS = ['Фото', 'Коментар', 'Доставка', 'Контакти', 'Підтвердження']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 md:mb-10">
      <div className="flex items-center justify-center">
        {STEPS.map((label, i) => {
          const idx = i + 1
          const done = idx < current
          const active = idx === current
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done || active ? 'bg-[#1e2d7d] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : idx}
                </div>
                <span className={`hidden sm:block text-xs mt-1 font-medium ${active ? 'text-[#1e2d7d]' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mx-1 sm:mb-4 ${idx < current ? 'bg-[#1e2d7d]' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>
      {/* Mobile: show the current step name on its own line (labels are hidden above to fit) */}
      <div className="sm:hidden text-center mt-3 text-sm font-semibold text-[#1e2d7d]">
        Крок {current} з {STEPS.length}: {STEPS[current - 1]}
      </div>
    </div>
  )
}

function PhotoUploadStep({ data, onChange, pageCount }: { data: UploadedFile[], onChange: (files: UploadedFile[]) => void, pageCount?: number }) {
  const [dragging, setDragging] = useState(false)
  // Compression status: shows a spinner + "стискаємо N з M" while we shrink
  // oversized photos to keep the upload under Vercel's body-size limit.
  // Real iPhone HEIC/JPEG can be 8-15 MB each — without this, 30 photos
  // blows past 200 MB and the request fails silently on the server.
  const [compressing, setCompressing] = useState<{ done: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList) return
    let incoming = Array.from(fileList)
    // Designer flow caps uploads at +35% of the recommended maximum.
    // Recommendation: 1× to 1.5× pageCount (e.g. 6 pages → 6-9 photos).
    // Hard cap on top: ceil(recMax × 1.35) so the customer can give the
    // designer ~10 extra to pick from but not a 100-photo dump.
    // For 6 pages: recMax=9, cap=ceil(9*1.35)=13.
    if (pageCount && pageCount > 0) {
      const recMax = Math.ceil(pageCount * 1.5)
      const maxPhotos = Math.ceil(recMax * 1.35)
      const remaining = Math.max(0, maxPhotos - data.length)
      if (remaining <= 0) {
        alert(`Ви вже завантажили ${maxPhotos} фото — це достатньо, щоб дизайнер мав з чого обрати. Якщо хочете додати інші — спершу видаліть зайві.`)
        return
      }
      if (incoming.length > remaining) {
        incoming = incoming.slice(0, remaining)
        alert(`Додано перші ${remaining} фото з вибраних — решту пропущено. Дизайнеру достатньо ${maxPhotos} фото на ${pageCount} сторінок, оберіть найкращі кадри.`)
      }
    }
    setCompressing({ done: 0, total: incoming.length })
    const processed: UploadedFile[] = []
    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i]
      // compressImageFile passes through small files and non-images (HEIC,
      // ZIP) untouched, so this is safe to call on everything.
      const { file: finalFile } = await compressImageFile(file)
      processed.push({
        id: Math.random().toString(36).slice(2),
        name: finalFile.name,
        size: finalFile.size,
        file: finalFile,
        preview: finalFile.type.startsWith('image/') ? URL.createObjectURL(finalFile) : undefined,
      })
      setCompressing({ done: i + 1, total: incoming.length })
    }
    setCompressing(null)
    onChange([...data, ...processed])
  }

  const removeFile = (id: string) => onChange(data.filter(f => f.id !== id))
  const fmt = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`

  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 1: Завантажте ваші фотографії</h2>
      <p className="text-gray-500 text-sm mb-6">JPG, PNG, HEIC, ZIP. Великі фото з телефону ми автоматично стискаємо до якості, потрібної для друку — обмеження по розміру файлу немає.</p>

      {/* Photo-count recommendation, shown only when we know how many
          pages the chosen product has (carried in savedConfig). For the
          designer flow: recMin = pageCount, recMax = ceil(pageCount × 1.5),
          and the cap (enforced in processFiles) is ceil(recMax × 1.35).
          Once recMax is reached we just leave the message at "цього
          достатньо" — no jarring "досягнуто максимум" since the customer
          can still upload up to the silent cap if they want. */}
      {pageCount && pageCount > 0 && (() => {
        const recMin = pageCount
        const recMax = Math.ceil(pageCount * 1.5)
        const count = data.length
        const enough = count >= recMin
        const tooFew = count > 0 && count < recMin
        // Below minimum → red (requirement). At/above minimum → green.
        const bg = count === 0 ? 'bg-[#eff6ff] border-[#bfdbfe]' : tooFew ? 'bg-[#fef2f2] border-[#fecaca]' : 'bg-[#f0fdf4] border-[#bbf7d0]'
        const titleColor = count === 0 ? 'text-[#1e2d7d]' : tooFew ? 'text-[#b91c1c]' : 'text-[#15803d]'
        return (
          <div className={`border rounded-lg p-4 mb-6 ${bg}`}>
            <p className={`text-sm font-bold ${titleColor}`}>
              Рекомендована кількість фото для {pageCount} сторінок: {recMin}–{recMax}
            </p>
            {count > 0 && (
              <p className={`text-xs font-semibold mt-2 ${titleColor}`}>
                {tooFew && `Завантажено ${count} — для ${pageCount} сторінок бажано щонайменше ${recMin} (додайте ще ${recMin - count}).`}
                {enough && `Завантажено ${count} — цього достатньо.`}
              </p>
            )}
          </div>
        )
      })()}

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-[#1e2d7d] bg-[#dbeafe]' : 'border-gray-300 bg-[#f8f9fc] hover:border-[#1e2d7d] hover:bg-[#f0f2f8]'}`}
      >
        <Upload className="w-10 h-10 text-[#1e2d7d] mx-auto mb-3" />
        <p className="font-semibold text-[#1e2d7d]">Перетягніть фото сюди або натисніть для вибору</p>
        <p className="text-gray-400 text-sm mt-1">JPG, PNG, HEIC, ZIP</p>
        <input ref={inputRef} type="file" multiple accept="image/*,.zip,.heic" className="hidden" onChange={e => processFiles(e.target.files)} />
      </div>

      {compressing && (
        <div className="mt-4 flex items-center gap-3 bg-[#dbeafe] rounded-lg p-3">
          <div className="w-5 h-5 border-2 border-[#1e2d7d] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm font-medium text-[#1e2d7d]">
            Готуємо фото до завантаження… {compressing.done} з {compressing.total}
          </p>
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-gray-600">Завантажено: {data.length} файл(ів)</p>
          {data.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-[#f0f2f8] rounded-lg p-3">
              {f.preview
                ? <img src={f.preview} alt={f.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-12 h-12 bg-[#dbeafe] rounded-lg flex items-center justify-center flex-shrink-0"><FileImage className="w-6 h-6 text-[#1e2d7d]" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                <p className="text-xs text-gray-400">{fmt(f.size)}</p>
              </div>
              <button onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
      )}
      {data.length === 0 && <p className="text-center text-sm text-gray-400 mt-4">Ще не завантажено жодного фото</p>}
    </div>
  )
}

function CommentStep({ value, onChange, showOwnText, ownText, onOwnTextChange, showKalka, kalkaText, onKalkaTextChange, productSlug }: {
  value: string
  onChange: (v: string) => void
  showOwnText?: boolean
  ownText?: string
  onOwnTextChange?: (v: string) => void
  showKalka?: boolean
  kalkaText?: string
  onKalkaTextChange?: (v: string) => void
  productSlug?: string
}) {
  const isDeskCalendar = (productSlug || '').toLowerCase().includes('desk-calendar') ||
    (productSlug || '').toLowerCase().includes('calendar-table') ||
    (productSlug || '').toLowerCase().includes('calendar-desk') ||
    (productSlug || '').toLowerCase().includes('wall-calendar') ||
    (productSlug || '').toLowerCase().includes('calendar-wall');
  const isNewspaper = (productSlug || '').toLowerCase().includes('newspaper');

  const commentPlaceholder = isNewspaper
    ? 'Наприклад: стиль — ніжний, кольори — пудрові; хочу більше фото з церемонії; додати підписи під кожним фото...'
    : isDeskCalendar
    ? 'Наприклад: фото хочу у такому ж порядку як завантажила; або фото 3 і 7 поміняти місцями; лютий — фото з днем народження...'
    : 'Наприклад: хочу фотокнигу у теплих тонах, акцент на сімейні фото...';

  const commentHint = isNewspaper
    ? 'Опишіть побажання до дизайну: стиль, кольорова гама, які моменти виділити, чи потрібні підписи до фото. Дизайнер підготує макет і погодить його з вами.'
    : isDeskCalendar
    ? 'Якщо для вас важливий порядок фото — вкажіть це. Якщо є побажання щодо розташування конкретних фото по місяцях — опишіть або пронумеруйте. Решту дизайнер підбере сам.'
    : 'Розкажіть про ваші побажання: тематика, кольори, стиль, особливості.';

  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 2: Коментар до замовлення</h2>
      {showOwnText && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1e2d7d] mb-2">Ваш текст для журналу</label>
          <p className="text-gray-500 text-sm mb-3">Ви обрали «Власний текст» — впишіть сюди текст, який має бути у журналі (історія, підписи до розворотів, побажання тощо). Дизайнер оформить його за вашим макетом.</p>
          <textarea
            value={ownText || ''}
            onChange={e => onOwnTextChange?.(e.target.value)}
            rows={8}
            placeholder="Вставте або напишіть текст для журналу. Можна розділяти по розворотах, наприклад: Розворот 1 — ...; Розворот 2 — ..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none"
          />
        </div>
      )}
      {showKalka && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#1e2d7d] mb-2">Що розмістити на кальці?</label>
          <p className="text-gray-500 text-sm mb-3">Ви додали кальку (прозорий аркуш перед першою сторінкою). Опишіть, що на ній надрукувати: напис, ім'я, дата, цитата чи побажання, а також де розмістити (по центру, зверху тощо). Якщо хочете малюнок або візерунок — опишіть його чи надішліть приклад дизайнеру.</p>
          <textarea
            value={kalkaText || ''}
            onChange={e => onKalkaTextChange?.(e.target.value)}
            rows={4}
            placeholder="Наприклад: по центру напис «Наша історія 2024» курсивом; або легкий рослинний візерунок по краях."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none"
          />
        </div>
      )}
      <p className="text-gray-500 text-sm mb-6">{commentHint}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={5}
        placeholder={commentPlaceholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none"
      />
      <p className="text-xs text-gray-400 mt-2">Необов'язково — можна обговорити з дизайнером</p>
    </div>
  )
}

function DeliveryStep({ delivery, city, address, onChange }: { delivery: string, city: string, address: string, onChange: (f: string, v: string) => void }) {
  // NP autocomplete state (mirrors the pattern already working in /cart).
  // Local to this step; the chosen city/address still bubble up via onChange,
  // so the parent state shape is unchanged.
  const [citySearch, setCitySearch] = useState(city || '')
  const [cities, setCities] = useState<any[]>([])
  const [cityRef, setCityRef] = useState('')
  const [showCityList, setShowCityList] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseSearch, setWarehouseSearch] = useState(address || '')
  const [showWhList, setShowWhList] = useState(false)
  const [isSearchingCities, setIsSearchingCities] = useState(false)
  const cityRowRef = useRef<HTMLDivElement>(null)
  const whRowRef = useRef<HTMLDivElement>(null)

  // City search (debounced)
  useEffect(() => {
    if (citySearch.length < 2 || citySearch === city) { setCities([]); return }
    const delay = setTimeout(async () => {
      setIsSearchingCities(true)
      try {
        const res = await fetch('/api/novaposhta', {
          method: 'POST',
          body: JSON.stringify({
            modelName: 'Address',
            calledMethod: 'getCities',
            methodProperties: { FindByString: citySearch, Limit: '20' },
          }),
        })
        const data = await res.json()
        if (data.success) setCities(data.data || [])
      } catch (e) { console.error('NP city search error:', e) }
      setIsSearchingCities(false)
    }, 400)
    return () => clearTimeout(delay)
  }, [citySearch, city])

  // Warehouse list when city picked
  useEffect(() => {
    if (!cityRef) { setWarehouses([]); return }
    const fetchW = async () => {
      try {
        const res = await fetch('/api/novaposhta', {
          method: 'POST',
          body: JSON.stringify({
            modelName: 'Address',
            calledMethod: 'getWarehouses',
            methodProperties: { CityRef: cityRef },
          }),
        })
        const data = await res.json()
        if (data.success) setWarehouses(data.data || [])
      } catch (e) { console.error('NP warehouse fetch error:', e) }
    }
    fetchW()
  }, [cityRef])

  // Close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (cityRowRef.current && !cityRowRef.current.contains(e.target as Node)) setShowCityList(false)
      if (whRowRef.current && !whRowRef.current.contains(e.target as Node)) setShowWhList(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const pickCity = (c: any) => {
    const name = c.Description || c.DescriptionRu || ''
    setCitySearch(name)
    setCityRef(c.Ref || '')
    onChange('city', name)
    setShowCityList(false)
    // Reset warehouse when city changes
    setWarehouseSearch('')
    onChange('address', '')
  }

  const filteredWarehouses = warehouseSearch.trim()
    ? warehouses.filter(w => (w.Description || '').toLowerCase().includes(warehouseSearch.toLowerCase())).slice(0, 30)
    : warehouses.slice(0, 30)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 3: Доставка</h2>
      <p className="text-gray-500 text-sm mb-6">Оберіть зручний спосіб отримання.</p>
      <div className="space-y-3 mb-6">
        {[
          { val: 'nova_poshta', label: 'Нова Пошта', desc: 'Доставка по всій Україні' },
          { val: 'pickup', label: 'Самовивіз', desc: 'Тернопіль, вул. Омеляна Польового 4а' },
        ].map(opt => (
          <label key={opt.val} onClick={() => onChange('delivery', opt.val)} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${delivery === opt.val ? 'border-[#1e2d7d] bg-[#dbeafe]' : 'border-gray-200 bg-white hover:border-[#1e2d7d]/40'}`}>
            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${delivery === opt.val ? 'border-[#1e2d7d]' : 'border-gray-300'}`}>
              {delivery === opt.val && <div className="w-2.5 h-2.5 rounded-full bg-[#1e2d7d]" />}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{opt.label}</p>
              <p className="text-sm text-gray-500">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
      {delivery === 'nova_poshta' && (
        <div className="space-y-4">
          <div ref={cityRowRef} style={{ position: 'relative' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Місто</label>
            <input
              value={citySearch}
              onChange={e => {
                setCitySearch(e.target.value)
                setShowCityList(true)
                // Clear chosen city/warehouse refs while user is editing
                if (cityRef) { setCityRef(''); onChange('city', ''); setWarehouseSearch(''); onChange('address', '') }
              }}
              onFocus={() => { if (cities.length) setShowCityList(true) }}
              placeholder="Почніть вводити: Київ, Львів..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
              autoComplete="off"
            />
            {showCityList && (cities.length > 0 || isSearchingCities) && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto', zIndex: 20 }}>
                {isSearchingCities && cities.length === 0 && (
                  <div style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>Шукаємо…</div>
                )}
                {cities.map(c => (
                  <button key={c.Ref} type="button" onClick={() => pickCity(c)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14, color: '#1e293b' }}>
                    {c.Description}
                    {c.AreaDescription ? <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>· {c.AreaDescription} обл.</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div ref={whRowRef} style={{ position: 'relative' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Відділення або адреса</label>
            <input
              value={warehouseSearch}
              onChange={e => {
                setWarehouseSearch(e.target.value)
                onChange('address', e.target.value)
                setShowWhList(true)
              }}
              onFocus={() => { if (cityRef && warehouses.length) setShowWhList(true) }}
              placeholder={cityRef ? 'Почніть вводити номер або адресу відділення' : 'Спочатку оберіть місто'}
              disabled={!cityRef}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] disabled:bg-gray-50 disabled:text-gray-400"
              autoComplete="off"
            />
            {showWhList && cityRef && filteredWarehouses.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto', zIndex: 20 }}>
                {filteredWarehouses.map(w => (
                  <button key={w.Ref} type="button"
                    onClick={() => { setWarehouseSearch(w.Description); onChange('address', w.Description); setShowWhList(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13, color: '#1e293b' }}>
                    {w.Description}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ContactsStep({ name, lastName, phone, channel, handle, onChange }: { name: string, lastName: string, phone: string, channel: string, handle: string, onChange: (f: string, v: string) => void }) {
  const channels = [
    { val: 'telegram', label: 'Telegram', desc: "Рекомендовано — найшвидший зв'язок", icon: MessageCircle, badge: true },
    { val: 'email', label: 'Email', desc: 'Вкажіть свій email нижче', icon: Mail, badge: false },
  ]
  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 4: Контакти та канал зв'язку</h2>
      <p className="text-gray-500 text-sm mb-6">Дизайнер зв'яжеться з вами для підтвердження деталей.</p>
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ім'я *</label>
            <div className="relative">
              <User className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <input value={name} onChange={e => onChange('name', e.target.value)} placeholder="Ім'я" className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Прізвище *</label>
            <input value={lastName} onChange={e => onChange('lastName', e.target.value)} placeholder="Прізвище" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-2">Прізвище потрібне для оформлення накладної Нової Пошти.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Номер телефону *</label>
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input value={phone} onChange={e => onChange('phone', e.target.value)} type="tel" placeholder="+380 __ ___ ____" className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Зручний канал для зв'язку *</p>
      <div className="space-y-3">
        {channels.map(ch => {
          const Icon = ch.icon
          return (
            <label key={ch.val} onClick={() => onChange('contactChannel', ch.val)} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${channel === ch.val ? 'border-[#1e2d7d] bg-[#dbeafe]' : 'border-gray-200 bg-white hover:border-[#1e2d7d]/40'}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${channel === ch.val ? 'border-[#1e2d7d]' : 'border-gray-300'}`}>
                {channel === ch.val && <div className="w-2.5 h-2.5 rounded-full bg-[#1e2d7d]" />}
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${channel === ch.val ? 'bg-[#1e2d7d]' : 'bg-[#f0f2f8]'}`}>
                <Icon className={`w-5 h-5 ${channel === ch.val ? 'text-white' : 'text-[#1e2d7d]'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{ch.label}</p>
                  {ch.badge && <span className="text-xs bg-[#1e2d7d] text-white px-2 py-0.5 rounded-full">Рекомендовано</span>}
                </div>
                <p className="text-xs text-gray-500">{ch.desc}</p>
              </div>
            </label>
          )
        })}
      </div>
      {channel && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {channel === 'telegram' ? 'Ваш Telegram @нікнейм або номер' : 'Ваша Email адреса'}
          </label>
          <input
            value={handle}
            onChange={e => onChange('contactHandle', e.target.value)}
            type={channel === 'email' ? 'email' : 'text'}
            placeholder={channel === 'telegram' ? '@username або +380...' : 'your@email.com'}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
          />
        </div>
      )}
    </div>
  )
}

function ConfirmationStep({ data }: { data: OrderFormData }) {
  const ch = { telegram: 'Telegram', email: 'Email' }[data.contactChannel as 'telegram' | 'email'] || ''
  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 5: Підтвердження</h2>
      <p className="text-gray-500 text-sm mb-6">Перевірте дані перед відправкою.</p>
      <div className="space-y-3">
        <div className="bg-[#f0f2f8] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Фотографії</p>
          <p className="font-medium text-gray-800">{data.files.length} файл(ів) завантажено</p>
        </div>
        {data.ownText && (
          <div className="bg-[#f0f2f8] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Текст для журналу</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.ownText}</p>
          </div>
        )}
        {data.kalkaText && (
          <div className="bg-[#f0f2f8] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Калька</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.kalkaText}</p>
          </div>
        )}
        {data.comment && (
          <div className="bg-[#f0f2f8] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Коментар</p>
            <p className="text-sm text-gray-700">{data.comment}</p>
          </div>
        )}
        <div className="bg-[#f0f2f8] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Доставка</p>
          <p className="font-medium text-gray-800">
            {data.delivery === 'pickup' ? 'Самовивіз — Тернопіль, вул. Омеляна Польового 4а' : `Нова Пошта — ${data.city}${data.address ? ', ' + data.address : ''}`}
          </p>
        </div>
        <div className="bg-[#f0f2f8] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Контакти</p>
          <p className="font-medium text-gray-800">{data.name} {data.lastName} · {data.phone}</p>
          <p className="text-sm text-gray-500">{ch}: {data.contactHandle}</p>
        </div>
      </div>
    </div>
  )
}

function SuccessScreen({ orderNumber }: { orderNumber?: string | null }) {
  const router = useRouter()
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-[#dbeafe] rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-[#1e2d7d]" />
      </div>
      <h2 className="text-2xl font-bold text-[#1e2d7d] mb-3">Замовлення відправлено!</h2>
      <p className="text-gray-500 max-w-md mx-auto mb-2">Дякуємо! Наш дизайнер зв'яжеться з вами протягом 24 годин для підтвердження деталей.</p>
      {orderNumber && <p className="text-gray-400 text-sm mb-8">Номер замовлення: <strong>{orderNumber}</strong></p>}
      {!orderNumber && <div className="mb-8" />}
      <div className="flex flex-col items-center gap-4">
        <button onClick={() => router.push('/catalog')} className="bg-[#1e2d7d] hover:bg-[#263a99] text-white font-semibold px-8 py-3 rounded-lg transition-colors">
          Повернутись до каталогу
        </button>
        {orderNumber && (
          <a href={`/track?order=${encodeURIComponent(orderNumber)}`} className="text-[#1e2d7d] text-sm font-semibold underline underline-offset-4 hover:text-[#263a99]">
            Перевірити статус замовлення
          </a>
        )}
      </div>
    </div>
  )
}

// Decides whether the designer flow should show the cover block for a
// given product, and whether that product takes a cover inscription
// (name/слоган). Rules per Diana:
//   • Journal (м'який + твердий) ............ cover photo + inscription
//   • Travel Book ........................... cover photo (no inscription)
//   • Photobook with PRINTED cover .......... cover photo (no inscription)
//   • Premium photobook (велюр/тканина/      . cover photo ONLY when an
//     шкірзам) .............................   insert is chosen:
//                                              Оздоблення = Акрил / Фотовставка
//   • Everything else (and direct /order
//     visits with no product) ............... no cover block
function getCoverCapability(savedConfig: any): { show: boolean; allowInscription: boolean; exampleUpload?: boolean; generatedCover?: boolean } {
  const slug = String(savedConfig?.slug || '').toLowerCase();
  if (!slug) return { show: false, allowInscription: false };

  const isJournal = slug.includes('magazine') || slug.includes('zhurnal') || slug.includes('journal');
  const isTravel = slug.includes('travel');
  const isPrintedPhotobook = slug.includes('photobook-printed') || slug.includes('printed') || slug.includes('graduation');
  const isPremiumPhotobook = slug.includes('velour') || slug.includes('velyur') ||
                             slug.includes('fabric') || slug.includes('tkanina') ||
                             slug.includes('leatherette') || slug.includes('shkir');

  if (isJournal) return { show: true, allowInscription: true };
  // Travel Book covers are GENERATED country designs (e.g. «AUSTRIA 2025»),
  // not customer-uploaded photos. So the designer needs the country + the
  // inscription text, with an optional reference — not a «upload your own
  // cover» slot. (The country picker over the generated covers will replace
  // the free-text country field once those covers are added.)
  if (isTravel) return { show: true, allowInscription: true, generatedCover: true };
  // Printed photobook: cover is printed, so the designer needs BOTH a
  // reference photo AND a description of what should appear / be written
  // on it (name, slogan, "best photo from the wedding day" — any of
  // those). Previously this was photo-only and customers had no way to
  // convey the cover idea.
  if (isPrintedPhotobook) return { show: true, allowInscription: true };

  if (isPremiumPhotobook) {
    // Velour/fabric/leatherette covers have no printed photo. The cover
    // block is relevant in two cases:
    //   • acryl / photo-insert — the customer supplies a photo for the insert
    //   • flex (друк кольором) / engraving / metal insert — the decoration
    //     carries text, so the customer must be able to write the desired
    //     cover inscription.
    const cfg = savedConfig?.config || {};
    // The config frequently carries BOTH keys — e.g. «Тип оздоблення»='Друк
    // кольором' alongside a leftover «Оздоблення»='Без оздоблення'. Reading one
    // with ?? would pick the empty leftover and miss the real decoration, so
    // combine all candidates and match keywords across the lot.
    const finishRaw = [cfg['Тип оздоблення'], cfg['Оздоблення'], cfg['finish'], cfg['decoration']]
      .map((x: any) => String(x ?? '').toLowerCase())
      .join(' ');
    const hasInsert =
      finishRaw.includes('acryl') || finishRaw.includes('акрил') ||
      finishRaw.includes('photovstavka') || finishRaw.includes('фотовставк');
    const hasText =
      finishRaw.includes('flex') || finishRaw.includes('флекс') ||
      finishRaw.includes('друк кольор') ||
      finishRaw.includes('гравір') || finishRaw.includes('гравію') ||
      finishRaw.includes('graviruvannya') ||
      // Metal insert is an engraved/printed metal plate — it carries text.
      finishRaw.includes('метал') || finishRaw.includes('metal');
    return { show: hasInsert || hasText, allowInscription: hasText, exampleUpload: hasText && !hasInsert };
  }

  return { show: false, allowInscription: false };
}

function CoverBlock({ allowInscription, inscription, coverPhoto, onChange, exampleUpload, generatedCover }: {
  allowInscription: boolean,
  inscription: string,
  coverPhoto: UploadedFile | null,
  onChange: (field: string, value: any) => void,
  exampleUpload?: boolean,
  generatedCover?: boolean,
}) {
  // The photo upload is an optional reference (not the actual cover) for both
  // the example-design flow and the Travel Book generated-cover flow.
  const optionalPhoto = exampleUpload || generatedCover;
  const coverRef = useRef<HTMLInputElement>(null)

  const pickCover = (fileList: FileList | null) => {
    if (!fileList || !fileList[0]) return
    const file = fileList[0]
    if (!file.type.startsWith('image/')) return
    if (coverPhoto?.preview) URL.revokeObjectURL(coverPhoto.preview)
    onChange('coverPhoto', {
      id: `cover-${Date.now()}`,
      name: file.name,
      size: file.size,
      file,
      preview: URL.createObjectURL(file),
    })
  }

  const removeCover = () => {
    if (coverPhoto?.preview) URL.revokeObjectURL(coverPhoto.preview)
    onChange('coverPhoto', null)
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <h3 className="text-base font-bold text-[#1e2d7d] mb-1">Обкладинка</h3>
      <p className="text-gray-500 text-sm mb-4">
        {generatedCover
          ? 'Обкладинка Travel Book — це готовий дизайн із назвою країни. Вкажіть країну та напис, які мають бути на обкладинці; за бажанням додайте референс.'
          : exampleUpload
          ? 'Напишіть текст, який має бути на обкладинці, і за бажанням додайте приклад дизайну, який вам подобається — дизайнер орієнтуватиметься на нього.'
          : `Завантажте окреме фото для обкладинки${allowInscription ? ' і коротко опишіть, що має бути на ній зображено або написано' : ''}. Якщо не завантажите — дизайнер підбере найкраще фото із завантажених.`}
      </p>

      <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => pickCover(e.target.files)} />

      {coverPhoto ? (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-24 h-32 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
            {coverPhoto.preview && <img src={coverPhoto.preview} alt="" className="w-full h-full object-cover" />}
            <button onClick={removeCover} className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => coverRef.current?.click()} className="px-4 py-2 rounded-lg border border-[#1e2d7d] text-[#1e2d7d] font-semibold text-sm hover:bg-[#f0f3ff]">
            Замінити фото
          </button>
        </div>
      ) : (
        <button
          onClick={() => coverRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center gap-2 text-gray-500 hover:border-[#1e2d7d] hover:bg-[#f8f9fc] transition-colors mb-4"
        >
          <Upload className="w-6 h-6" />
          <span className="font-semibold text-sm">{generatedCover ? 'Додати референс (опційно)' : exampleUpload ? 'Додати приклад дизайну' : 'Завантажити фото обкладинки'}</span>
          <span className="text-xs text-gray-400">{optionalPhoto ? 'фото або приклад дизайну, який вам подобається (опційно)' : 'вертикальне фото, обличчя крупно'}</span>
        </button>
      )}

      {allowInscription && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{generatedCover ? 'Країна та напис на обкладинці' : exampleUpload ? 'Бажаний текст на обкладинці (опційно)' : 'Що має бути на обкладинці (опційно)'}</label>
          <textarea
            value={inscription}
            onChange={e => onChange('coverInscription', e.target.value)}
            rows={3}
            placeholder={generatedCover ? 'Напр.: AUSTRIA 2025 · Diana & Adrian — вкажіть країну, рік та імена для обкладинки.' : exampleUpload ? 'Напр.: «Наша історія 2024», ім&apos;я, дата чи цитата — те, що надрукувати на обкладинці.' : 'Опишіть, що хочете бачити на обкладинці: ім&apos;я, девіз, або яке фото — напр. "Книга про Марію", "наше весілля, фото з арки" або "найкраще спільне фото з відпустки"'}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none font-sans"
          />
          <p className="text-xs text-gray-400 mt-1.5">Можна залишити порожнім — тоді дизайнер обере на власний розсуд.</p>
        </div>
      )}
    </div>
  )
}

function OrderForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedConfig, setSavedConfig] = useState<any>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [formData, setFormData] = useState<OrderFormData>({
    files: [], comment: '', ownText: '', kalkaText: '', delivery: '', city: '', address: '',
    name: '', lastName: '', phone: '', contactChannel: '', contactHandle: '',
    coverInscription: '', coverPhoto: null,
  })

  useEffect(() => {
    // Load configuration from sessionStorage
    const configJson = sessionStorage.getItem('designerOrderConfig')
    if (configJson) {
      try {
        const config = JSON.parse(configJson)
        setSavedConfig(config)
      } catch (e) {
        console.error('Failed to parse saved configuration:', e)
      }
    }
  }, [])

  const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }))

  const canProceed = () => {
    if (step === 1) return formData.files.length > 0
    if (step === 3) return !!formData.delivery
    if (step === 4) return !!formData.name && !!formData.lastName && !!formData.phone && !!formData.contactChannel && !!formData.contactHandle
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      // Upload photos straight to Supabase Storage from the browser —
      // NOT through /api/order. Posting 10+ photos as multipart FormData
      // to a serverless function blows past Vercel's ~4.5 MB body limit
      // and returns 413 ("Сталася помилка"). Uploading client-side to
      // Storage (same approach as the magazine-text brief) sidesteps the
      // limit entirely and actually persists the order.
      const sessionId = `designer-order-${Date.now()}`
      const uploaded: Array<{ path: string; name: string; size: number; type: string; cover?: boolean }> = []
      let lastUploadError: any = null

      for (let i = 0; i < formData.files.length; i++) {
        const f = formData.files[i]
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${sessionId}/${String(i + 1).padStart(3, '0')}_${safeName}`
        // uploadImageToStorage now routes order-files through the server-side
        // service-role endpoint internally, so RLS never blocks the customer.
        const { error: upErr, file: up } = await uploadImageToStorage(supabase, 'order-files', path, f.file, { downscale: true })
        if (upErr) { console.error('photo upload error:', upErr); lastUploadError = upErr; continue }
        uploaded.push({ path, name: f.name, size: up.size, type: up.type || 'image/jpeg' })
      }

      if (uploaded.length === 0) {
        throw new Error(`Не вдалося завантажити фото${lastUploadError?.message ? `: ${lastUploadError.message}` : ''}`)
      }

      // Optional dedicated cover photo
      let coverPath: string | null = null
      if (formData.coverPhoto?.file) {
        const cf = formData.coverPhoto
        const safeName = cf.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${sessionId}/cover_${safeName}`
        const { error: cErr, file: up } = await uploadImageToStorage(supabase, 'order-files', path, cf.file, { downscale: true })
        if (!cErr) {
          coverPath = path
          uploaded.push({ path, name: `[ОБКЛАДИНКА] ${cf.name}`, size: up.size, type: up.type || 'image/jpeg', cover: true })
        } else {
          console.error('cover upload error:', cErr)
        }
      }

      const productSlug = savedConfig?.slug || searchParams.get('product') || ''
      const productName = savedConfig?.productName
        || (productSlug ? productSlug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Замовлення з дизайнером')

      // Price the customer saw on the product page (carried from the constructor
      // price calc). If present, the designer order lands with that price instead
      // of 0; the manager can still adjust it after the designer lays it out.
      const estPrice = Math.max(0, Math.round(Number(savedConfig?.price) || 0))

      const deliveryText = formData.delivery === 'pickup'
        ? 'Самовивіз — Тернопіль, вул. Омеляна Польового 4а'
        : `Нова Пошта — ${formData.city}${formData.address ? ', ' + formData.address : ''}`

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          // orders.order_number and orders.delivery_method are NOT NULL with no
          // default and no trigger — the regular checkout sets them server-side
          // (api/orders/submit). The designer flow inserts client-side, so it
          // order_number is assigned by the DB sequence default (TM-NNNNNN) and
          // read back via .select('id, order_number'). delivery_method is still
          // required (NOT NULL); the team confirms delivery afterwards.
          delivery_method: formData.delivery || 'pickup',
          customer_name: [formData.name, formData.lastName].filter(Boolean).join(' '),
          customer_first_name: formData.name,
          customer_last_name: formData.lastName,
          customer_phone: formData.phone,
          customer_email: formData.contactChannel === 'email' ? formData.contactHandle : null,
          customer_telegram: formData.contactChannel === 'telegram' ? formData.contactHandle : null,
          with_designer: true,
          items: [{
            product_slug: productSlug,
            product_name: productName,
            quantity: 1,
            price: estPrice,
            options: savedConfig?.config || {},
          }],
          notes: [
            'Замовлення з дизайнером',
            formData.ownText ? `Текст для журналу (власний текст клієнта):\n${formData.ownText}` : '',
            formData.kalkaText ? `Калька (що розмістити):\n${formData.kalkaText}` : '',
            formData.comment ? `Коментар: ${formData.comment}` : '',
            `Доставка: ${deliveryText}`,
            formData.coverInscription ? `Надпис на обкладинці: ${formData.coverInscription}` : '',
          ].filter(Boolean).join('\n---\n'),
          order_status: 'new',
          payment_status: 'pending',
          custom_attributes: {
            contact_channel: formData.contactChannel,
            contact_handle: formData.contactHandle,
            delivery: formData.delivery,
            city: formData.city,
            address: formData.address,
          },
          total: estPrice,
          subtotal: estPrice,
          text_brief: {
            own_text: formData.ownText || null,
            kalka_text: formData.kalkaText || null,
            cover: { inscription: formData.coverInscription, photo_path: coverPath },
            collected_at: new Date().toISOString(),
          },
        })
        .select('id, order_number')
        .single()

      if (orderError) throw orderError

      if (order && uploaded.length > 0) {
        await supabase.from('order_files').insert(
          uploaded.map((it) => ({
            order_id: order.id,
            file_path: it.path,
            file_name: it.name,
            file_type: 'upload',
            file_category: it.cover ? 'designer-cover' : 'designer-order',
            product_type: 'designer',
            bucket_name: 'order-files',
          }))
        )
      }

      if (order) { setOrderId(order.id); setOrderNumber(order.order_number) }
      sessionStorage.removeItem('designerOrderConfig')

      // Payment step — this flow used to END at "Підтвердити замовлення"
      // with no payment at all (customers wrote "немає оплати, лише
      // підтвердити"), and the team manually sent Monobank links from the
      // admin. Same tail as checkout: create the invoice and go to the
      // payment page. If the invoice can't be created (0 total, token
      // issue), fall back to the success screen — the manager confirms and
      // sends the link, and the order-placed email carries a pay button.
      if (order && estPrice > 0) {
        try {
          const invoiceRes = await fetch('/api/monobank/create-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, paymentRegion: 'UA' }),
          })
          const invoiceData = await invoiceRes.json()
          if (invoiceRes.ok && invoiceData.pageUrl) {
            window.location.href = invoiceData.pageUrl
            return
          }
        } catch { /* fall through to success screen */ }
      }
      setSubmitted(true)
    } catch (e: any) {
      console.error('designer order submit error:', e)
      // Log the FINAL failure (not just file uploads) so a customer's
      // "can't finish the order" report leaves a trace we can read. The file
      // uploads may all have succeeded and the real failure be here — e.g. an
      // RLS error on orders/order_files insert, a NOT NULL violation, etc.
      try {
        void supabase.from('upload_attempt_log').insert({
          bucket: 'order-files',
          file_name: '(order submit)',
          status: 'error',
          error_message: e?.message || String(e),
          context: 'designer-order-submit',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }).then(() => {}, () => {});
      } catch { /* logging must never break the handler */ }
      setError(e?.message ? `Сталася помилка: ${e.message}` : "Сталася помилка. Спробуйте ще раз або зв'яжіться з нами напряму.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return <SuccessScreen orderNumber={orderNumber} />

  return (
    <div className="min-h-screen bg-[#f0f2f8]">
      <FlowHeader />
      <div className="py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1e2d7d]">Оформлення замовлення з дизайнером</h1>
          <p className="text-gray-500 mt-2 text-sm">Наш дизайнер підготує для вас індивідуальний макет</p>
        </div>

        {/* Saved Configuration Display */}
        {savedConfig && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1e2d7d]">Обрана конфігурація</h3>
                {savedConfig.productName && (
                  <p className="text-sm text-gray-500 mt-1">{savedConfig.productName}</p>
                )}
              </div>
              <button
                onClick={() => {
                  sessionStorage.removeItem('designerOrderConfig')
                  setSavedConfig(null)
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Видалити конфігурацію"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {savedConfig.config && (() => {
                const cfg = savedConfig.config as Record<string, any>;

                // Friendly labels for the option keys themselves.
                const keyLabels: Record<string, string> = {
                  size: 'Розмір',
                  pages: 'Кількість сторінок',
                  coverType: 'Тип обкладинки',
                  tracingPaper: 'Калька',
                  lamination: 'Ламінація',
                };

                // Value-level mapping for the raw codes that come from the
                // product.options JSON (acryl_100x100, foto_100x100, etc.)
                // and from the selector itself (none, standard, own, with…).
                // Without this, the summary card shows ugly slugs instead of
                // human-readable labels. Falls back to the value as-is if it
                // isn't recognised — covers labels that already arrive
                // pre-formatted (e.g. "20×20 см", "16 сторінок").
                const valueLabels: Record<string, string> = {
                  'standard': 'Стандартний',
                  'round': 'Круглий',
                  'acryl': 'Акрил',
                  'photovstavka': 'Фотовставка',
                  'metal': 'Металева вставка',
                  'flex': 'Флекс',
                  'graviruvannya': 'Гравірування',
                  'acryl_100x100': 'Акрил 100×100 мм',
                  'acryl_d145': 'Акрил Ø145 мм',
                  'foto_100x100': 'Фотовставка 100×100 мм',
                  'glossy': 'Глянцева',
                  'matte': 'Матова',
                  'urgent': 'Термінова',
                };

                // Per-field overrides for ambiguous codes ('none' / 'with' /
                // 'own' / 'we' mean different things on different fields).
                // Resolved before the global valueLabels above.
                const fieldValueLabels: Record<string, Record<string, string>> = {
                  'Калька перед першою сторінкою': { 'none': 'Без кальки', 'with': 'З калькою' },
                  'tracingPaper':                  { 'none': 'Без кальки', 'with': 'З калькою' },
                  'Тип оздоблення':                { 'none': 'Без оздоблення' },
                  'Оздоблення':                    { 'none': 'Без оздоблення' },
                  'Верстка тексту':                { 'none': 'Без тексту (тільки фото)', 'own': 'Власний текст', 'we': 'Текст пише команда' },
                  'Ламінація сторінок':            { 'none': 'Без ламінації', 'with': 'З ламінацією' },
                  'Ламінація обкладинки':          { 'none': 'Без ламінації' },
                  'Ламінація':                     { 'none': 'Без ламінації' },
                  'Тип ламінації':                 { 'none': 'Без ламінації' },
                  'Друк на форзаці':               { 'none': 'Без друку', 'with': 'З друком' },
                  'Терміновість':                  { 'none': 'Стандартна', 'standard': 'Стандартна', 'urgent': 'Термінова (до 5 робочих днів)' },
                  'Колір напису':                  { 'white': 'Білий', 'black': 'Чорний', 'silver': 'Срібло', 'gold': 'Золото' },
                  'Колір флексу':                  { 'white': 'Білий', 'black': 'Чорний', 'silver': 'Срібло', 'gold': 'Золото' },
                  'Комплектація':                  { 'no_stand': 'Без мольберта', 'with_stand': "З дерев'яним мольбертом" },
                };

                const labelFor = (key: string, value: string): string => {
                  const perField = fieldValueLabels[key];
                  if (perField && perField[value]) return perField[value];
                  if (valueLabels[value]) return valueLabels[value];
                  return value;
                };

                // The product options dump can contain contradictory / stray
                // fields: a "Тип оздоблення=Фотовставка" alongside an unused
                // "Оздоблення=Без оздоблення", variant sub-options for EVERY
                // decoration (Варіант акрилу + Варіант фотовставки) when only
                // one was chosen, a "Колір напису" that only matters for flex,
                // and empty fields. Build a clean, non-contradictory summary.
                const decoRaw = String(cfg['Тип оздоблення'] || cfg['Оздоблення'] || '').toLowerCase();
                const noDecoration = !decoRaw || decoRaw === 'none' || decoRaw.includes('без оздоблення');
                const subOptionKeys = ['Варіант акрилу', 'Варіант фотовставки', 'Варіант металевої вставки', 'Варіант тиснення', 'Варіант гравірування'];
                // The single sub-option key that belongs to the chosen decoration.
                const variantKeyFor = (d: string): string | null => {
                  if (d.includes('акрил') || d.includes('acryl')) return 'Варіант акрилу';
                  if (d.includes('фотовставк') || d.includes('foto') || d.includes('photo')) return 'Варіант фотовставки';
                  if (d.includes('метал')) return 'Варіант металевої вставки';
                  if (d.includes('тиснен')) return 'Варіант тиснення';
                  if (d.includes('гравір') || d.includes('graviru')) return 'Варіант гравірування';
                  return null;
                };
                const chosenVariantKey = noDecoration ? null : variantKeyFor(decoRaw);
                const isFlex = !noDecoration && (decoRaw.includes('флекс') || decoRaw.includes('flex') || decoRaw.includes('друк кольор'));
                // Redundant decoration group: when one of «Оздоблення» /
                // «Тип оздоблення» carries the real decoration, drop the other
                // one if it's just "Без оздоблення".
                const ozdNone = (() => { const r = String(cfg['Оздоблення'] ?? '').toLowerCase(); return !r || r === 'none' || r.includes('без оздоблення'); })();
                const typNone = (() => { const r = String(cfg['Тип оздоблення'] ?? '').toLowerCase(); return !r || r === 'none' || r.includes('без оздоблення'); })();

                const entries = Object.entries(cfg).filter(([key, value]) => {
                  if (String(value ?? '').trim() === '') return false;       // hide empty fields
                  if (subOptionKeys.includes(key)) {                          // only the chosen decoration's variant
                    if (noDecoration) return false;
                    return key === chosenVariantKey;
                  }
                  if (key === 'Колір напису' || key === 'Колір флексу') return isFlex; // inscription colour: flex only
                  if (key === 'Оздоблення' && ozdNone && !typNone) return false;       // drop redundant "Без оздоблення"
                  if (key === 'Тип оздоблення' && typNone && !ozdNone) return false;
                  // Journals carry the cover finish as «Ламінація обкладинки».
                  // A stray «Тип обкладинки» with the same glossy/matte value
                  // (from an older session) is a duplicate — hide it.
                  if (key === 'Тип обкладинки' && (cfg['Ламінація обкладинки'] || cfg['Тип ламінації'])) return false;
                  // The same finish can also arrive under the constructor's
                  // camelCase `coverType` key, which an older session left in
                  // customProductOptions (its value becomes «Глянцева»/«Матова»).
                  // Drop it only when it IS a glossy/matte finish — a real
                  // material coverType (Велюр/Тканина/Друкована…) must stay.
                  if (key === 'coverType' && (cfg['Ламінація обкладинки'] || cfg['Тип ламінації'])) {
                    const cv = String(value ?? '').toLowerCase();
                    if (cv.includes('глянц') || cv.includes('матов')) return false;
                  }
                  return true;
                });

                return entries.map(([key, value]) => {
                  const v = String(value ?? '');
                  const displayValue = labelFor(key, v);
                  return (
                    <div key={key} className="bg-[#f0f2f8] rounded-lg p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                        {keyLabels[key] || key}
                      </p>
                      <p className="text-sm font-medium text-gray-800">{displayValue}</p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        <StepIndicator current={step} />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 1 && <PhotoUploadStep data={formData.files} onChange={files => update('files', files)} pageCount={(() => {
            // Pull the page count out of the saved product config (if any)
            // so the photo step can recommend a count and cap uploads.
            const slug = (savedConfig?.slug || '').toLowerCase();
            // Desk calendar: always 12 months = 12 photos
            if (slug.includes('desk-calendar') || slug.includes('calendar-table') || slug.includes('calendar-desk') || slug.includes('wall-calendar') || slug.includes('calendar-wall')) return 12;
            const raw = savedConfig?.config?.['Кількість сторінок'] ?? savedConfig?.config?.['pages'] ?? savedConfig?.pages;
            const n = parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
            return Number.isFinite(n) && n > 0 ? n : undefined;
          })()} />}
          {step === 2 && <CommentStep
            value={formData.comment}
            onChange={v => update('comment', v)}
            showOwnText={String(savedConfig?.config?.['Верстка тексту'] || '') === 'own'}
            ownText={formData.ownText}
            onOwnTextChange={v => update('ownText', v)}
            showKalka={(() => {
              const cfg = savedConfig?.config || {};
              let v = String(cfg['Калька перед першою сторінкою'] ?? cfg['tracingPaper'] ?? cfg['tracing'] ?? cfg['Калька'] ?? '').toLowerCase().trim();
              if (!v) {
                for (const [k, val] of Object.entries(cfg)) {
                  const kl = k.toLowerCase();
                  if (kl.includes('кальк') || kl.includes('tracing')) { v = String(val).toLowerCase().trim(); break; }
                }
              }
              return !!v && v !== 'none' && !v.includes('без');
            })()}
            kalkaText={formData.kalkaText}
            onKalkaTextChange={v => update('kalkaText', v)}
            productSlug={savedConfig?.slug || ''}
          />}
          {step === 2 && (() => {
            const cap = getCoverCapability(savedConfig);
            if (!cap.show) return null;
            return (
              <CoverBlock
                allowInscription={cap.allowInscription}
                inscription={formData.coverInscription}
                coverPhoto={formData.coverPhoto}
                onChange={update}
                exampleUpload={cap.exampleUpload}
                generatedCover={cap.generatedCover}
              />
            );
          })()}
          {step === 3 && <DeliveryStep delivery={formData.delivery} city={formData.city} address={formData.address} onChange={update} />}
          {step === 4 && <ContactsStep name={formData.name} lastName={formData.lastName} phone={formData.phone} channel={formData.contactChannel} handle={formData.contactHandle} onChange={update} />}
          {step === 5 && <ConfirmationStep data={formData} />}
          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
          <div className="flex justify-between mt-8 gap-4">
            <button
              onClick={step > 1 ? () => setStep(s => s - 1) : () => router.back()}
              className="flex items-center gap-2 px-6 py-3 border-2 border-[#1e2d7d] text-[#1e2d7d] rounded-lg font-semibold hover:bg-[#f0f2f8] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>
            {step < 5 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-colors ${canProceed() ? 'bg-[#1e2d7d] hover:bg-[#263a99] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                Далі <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 rounded-lg font-semibold bg-[#1e2d7d] hover:bg-[#263a99] text-white transition-colors disabled:opacity-60"
              >
                {submitting ? 'Відправляємо...' : 'Підтвердити замовлення'} <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]"><p className="text-gray-500">Завантаження...</p></div>}>
      <OrderForm />
    </Suspense>
  )
}
