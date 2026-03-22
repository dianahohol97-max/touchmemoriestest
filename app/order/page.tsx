'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload, X, FileImage, ChevronRight, ChevronLeft, Check, MessageCircle, Instagram, Mail, Phone, User } from 'lucide-react'

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
  delivery: 'nova_poshta' | 'pickup' | ''
  city: string
  address: string
  name: string
  phone: string
  contactChannel: 'telegram' | 'instagram' | 'email' | ''
  contactHandle: string
}

const STEPS = ['Фото', 'Коментар', 'Доставка', 'Контакти', 'Підтвердження']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done || active ? 'bg-[#1e2d7d] text-white' : 'bg-gray-200 text-gray-500'}`}>
                {done ? <Check className="w-5 h-5" /> : idx}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? 'text-[#1e2d7d]' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-10 h-0.5 mb-4 mx-1 ${idx < current ? 'bg-[#1e2d7d]' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PhotoUploadStep({ data, onChange }: { data: UploadedFile[], onChange: (files: UploadedFile[]) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).slice(2),
      name: file.name,
      size: file.size,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    onChange([...data, ...newFiles])
  }

  const removeFile = (id: string) => onChange(data.filter(f => f.id !== id))
  const fmt = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`

  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 1: Завантажте ваші фотографії</h2>
      <p className="text-gray-500 text-sm mb-6">Підтримуються JPG, PNG, HEIC, ZIP. Максимум 200 МБ загалом.</p>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-[#1e2d7d] bg-[#dbeafe]' : 'border-gray-300 bg-[#f8f9fc] hover:border-[#1e2d7d] hover:bg-[#f0f2f8]'}`}
      >
        <Upload className="w-10 h-10 text-[#1e2d7d] mx-auto mb-3" />
        <p className="font-semibold text-[#1e2d7d]">Перетягніть фото сюди або натисніть для вибору</p>
        <p className="text-gray-400 text-sm mt-1">JPG, PNG, HEIC, ZIP — до 200 МБ</p>
        <input ref={inputRef} type="file" multiple accept="image/*,.zip,.heic" className="hidden" onChange={e => processFiles(e.target.files)} />
      </div>

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

function CommentStep({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 2: Коментар до замовлення</h2>
      <p className="text-gray-500 text-sm mb-6">Розкажіть про ваші побажання: тематика, кольори, стиль, особливості.</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={5}
        placeholder="Наприклад: хочу фотокнигу у теплих тонах, акцент на сімейні фото..."
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none"
      />
      <p className="text-xs text-gray-400 mt-2">Необов'язково — можна обговорити з дизайнером</p>
    </div>
  )
}

function DeliveryStep({ delivery, city, address, onChange }: { delivery: string, city: string, address: string, onChange: (f: string, v: string) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 3: Доставка</h2>
      <p className="text-gray-500 text-sm mb-6">Оберіть зручний спосіб отримання.</p>
      <div className="space-y-3 mb-6">
        {[
          { val: 'nova_poshta', label: 'Нова Пошта', desc: 'Доставка по всій Україні' },
          { val: 'pickup', label: 'Самовивіз', desc: 'Тернопіль, вул. Київська 2' },
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Місто</label>
            <input value={city} onChange={e => onChange('city', e.target.value)} placeholder="Наприклад: Київ" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Відділення або адреса</label>
            <input value={address} onChange={e => onChange('address', e.target.value)} placeholder="Відділення №5 або вулиця" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
          </div>
        </div>
      )}
    </div>
  )
}

function ContactsStep({ name, phone, channel, handle, onChange }: { name: string, phone: string, channel: string, handle: string, onChange: (f: string, v: string) => void }) {
  const channels = [
    { val: 'telegram', label: 'Telegram', desc: "Рекомендовано — найшвидший зв'язок", icon: MessageCircle, badge: true },
    { val: 'instagram', label: 'Instagram', desc: 'Direct повідомлення @touch.memories', icon: Instagram, badge: false },
    { val: 'email', label: 'Email', desc: 'touch.memories3@gmail.com', icon: Mail, badge: false },
  ]
  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 4: Контакти та канал зв'язку</h2>
      <p className="text-gray-500 text-sm mb-6">Дизайнер зв'яжеться з вами для підтвердження деталей.</p>
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ваше ім'я *</label>
          <div className="relative">
            <User className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input value={name} onChange={e => onChange('name', e.target.value)} placeholder="Як до вас звертатись?" className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
          </div>
        </div>
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
            {channel === 'telegram' ? 'Ваш Telegram @нікнейм або номер' : channel === 'instagram' ? 'Ваш Instagram @нікнейм' : 'Ваша Email адреса'}
          </label>
          <input
            value={handle}
            onChange={e => onChange('contactHandle', e.target.value)}
            type={channel === 'email' ? 'email' : 'text'}
            placeholder={channel === 'telegram' ? '@username або +380...' : channel === 'instagram' ? '@username' : 'your@email.com'}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
          />
        </div>
      )}
    </div>
  )
}

function ConfirmationStep({ data }: { data: OrderFormData }) {
  const ch = { telegram: 'Telegram', instagram: 'Instagram', email: 'Email' }[data.contactChannel as 'telegram' | 'instagram' | 'email'] || ''
  return (
    <div>
      <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Крок 5: Підтвердження</h2>
      <p className="text-gray-500 text-sm mb-6">Перевірте дані перед відправкою.</p>
      <div className="space-y-3">
        <div className="bg-[#f0f2f8] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Фотографії</p>
          <p className="font-medium text-gray-800">{data.files.length} файл(ів) завантажено</p>
        </div>
        {data.comment && (
          <div className="bg-[#f0f2f8] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Коментар</p>
            <p className="text-sm text-gray-700">{data.comment}</p>
          </div>
        )}
        <div className="bg-[#f0f2f8] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Доставка</p>
          <p className="font-medium text-gray-800">
            {data.delivery === 'pickup' ? 'Самовивіз — Тернопіль, вул. Київська 2' : `Нова Пошта — ${data.city}${data.address ? ', ' + data.address : ''}`}
          </p>
        </div>
        <div className="bg-[#f0f2f8] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Контакти</p>
          <p className="font-medium text-gray-800">{data.name} · {data.phone}</p>
          <p className="text-sm text-gray-500">{ch}: {data.contactHandle}</p>
        </div>
      </div>
    </div>
  )
}

function SuccessScreen() {
  const router = useRouter()
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-[#dbeafe] rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-[#1e2d7d]" />
      </div>
      <h2 className="text-2xl font-bold text-[#1e2d7d] mb-3">Замовлення відправлено!</h2>
      <p className="text-gray-500 max-w-md mx-auto mb-8">Дякуємо! Наш дизайнер зв'яжеться з вами протягом 1–2 годин для підтвердження деталей.</p>
      <button onClick={() => router.push('/catalog')} className="bg-[#1e2d7d] hover:bg-[#263a99] text-white font-semibold px-8 py-3 rounded-lg transition-colors">
        Повернутись до каталогу
      </button>
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

  const [formData, setFormData] = useState<OrderFormData>({
    files: [], comment: '', delivery: '', city: '', address: '',
    name: '', phone: '', contactChannel: '', contactHandle: '',
  })

  const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }))

  const canProceed = () => {
    if (step === 1) return formData.files.length > 0
    if (step === 3) return !!formData.delivery
    if (step === 4) return !!formData.name && !!formData.phone && !!formData.contactChannel && !!formData.contactHandle
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      formData.files.forEach(f => fd.append('photos', f.file))
      fd.append('comment', formData.comment)
      fd.append('delivery', formData.delivery)
      fd.append('city', formData.city)
      fd.append('address', formData.address)
      fd.append('name', formData.name)
      fd.append('phone', formData.phone)
      fd.append('contactChannel', formData.contactChannel)
      fd.append('contactHandle', formData.contactHandle)
      fd.append('productSlug', searchParams.get('product') || '')
      const res = await fetch('/api/order', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Server error')
      setSubmitted(true)
    } catch {
      setError("Сталася помилка. Спробуйте ще раз або зв'яжіться з нами напряму.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return <SuccessScreen />

  return (
    <div className="min-h-screen bg-[#f0f2f8] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1e2d7d]">Оформлення замовлення з дизайнером</h1>
          <p className="text-gray-500 mt-2 text-sm">Наш дизайнер підготує для вас індивідуальний макет</p>
        </div>
        <StepIndicator current={step} />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 1 && <PhotoUploadStep data={formData.files} onChange={files => update('files', files)} />}
          {step === 2 && <CommentStep value={formData.comment} onChange={v => update('comment', v)} />}
          {step === 3 && <DeliveryStep delivery={formData.delivery} city={formData.city} address={formData.address} onChange={update} />}
          {step === 4 && <ContactsStep name={formData.name} phone={formData.phone} channel={formData.contactChannel} handle={formData.contactHandle} onChange={update} />}
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
  )
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]"><p className="text-gray-500">Завантаження...</p></div>}>
      <OrderForm />
    </Suspense>
  )
}
