'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { CheckCircle, XCircle, Loader2, MessageSquare } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export default function ReviewPageClient({ project: initialProject, token }: { project: any; token: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [project] = useState(initialProject);
  const [action, setAction] = useState<'idle' | 'loading' | 'done'>('idle');
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [result, setResult] = useState<'approved' | 'revision' | null>(null);

  const order = (project as any).order;
  const productName = (order?.items as any[])?.[0]?.name || 'Ваш продукт';

  const handleApprove = async () => {
    setAction('loading');
    await supabase.from('customer_projects').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    }).eq('share_token', token);
    if (project.order_id) {
      await supabase.from('design_briefs').update({ status: 'approved' }).eq('order_id', project.order_id);
    }
    setResult('approved');
    setAction('done');
  };

  const handleRevision = async () => {
    if (!revisionNote.trim()) return;
    setAction('loading');
    await supabase.from('customer_projects').update({
      status: 'revision_requested',
      revision_notes: revisionNote,
    }).eq('share_token', token);
    if (project.order_id) {
      await supabase.from('design_briefs').update({ status: 'revision_requested' }).eq('order_id', project.order_id);
    }
    setResult('revision');
    setAction('done');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-block bg-[#1e2d7d] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-wider uppercase">Макет для узгодження</div>
          <h1 className="text-3xl font-black text-[#1e2d7d] mb-2">{project.title}</h1>
          <p className="text-gray-500 text-sm">Замовлення #{order?.order_number} · {productName}</p>
        </div>

        {(result === 'approved' || project.status === 'approved') && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center mb-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-black text-green-700 mb-1">Макет затверджено! </h2>
            <p className="text-green-600 text-sm">Передаємо у виробництво. Дякуємо!</p>
          </div>
        )}
        {(result === 'revision' || (project.status === 'revision_requested' && result === null)) && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center mb-6">
            <MessageSquare className="w-14 h-14 text-orange-500 mx-auto mb-3" />
            <h2 className="text-xl font-black text-orange-700 mb-1">Правки надіслано</h2>
            {project.revision_notes && <p className="text-orange-600 text-sm italic mt-2">"{project.revision_notes}"</p>}
          </div>
        )}

        {project.thumbnail_url && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Попередній перегляд</p>
            <img src={project.thumbnail_url} alt="Макет" className="w-full rounded-xl" />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Деталі макету</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {project.format && <div><span className="text-gray-400">Розмір:</span> <span className="font-semibold">{project.format}</span></div>}
            {project.cover_type && <div><span className="text-gray-400">Обкладинка:</span> <span className="font-semibold">{project.cover_type}</span></div>}
            {project.page_count > 0 && <div><span className="text-gray-400">Сторінок:</span> <span className="font-semibold">{project.page_count}</span></div>}
            <div>
              <span className="text-gray-400">Статус:</span>{' '}
              <span className={`font-semibold ${project.status === 'approved' ? 'text-green-600' : project.status === 'revision_requested' ? 'text-orange-500' : 'text-blue-600'}`}>
                {project.status === 'sent_for_review' ? 'На узгодженні' : project.status === 'approved' ? 'Затверджено' : project.status === 'revision_requested' ? 'Правки надіслано' : project.status}
              </span>
            </div>
          </div>
        </div>

        {project.status === 'sent_for_review' && result === null && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">Ваше рішення</h3>
            <p className="text-gray-500 text-sm mb-5">Перегляньте макет і підтвердіть або надішліть правки.</p>
            {!showRevisionForm ? (
              <div className="flex gap-3 flex-wrap">
                <button onClick={handleApprove} disabled={action === 'loading'}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {action === 'loading' ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  Затвердити макет
                </button>
                <button onClick={() => setShowRevisionForm(true)} disabled={action === 'loading'}
                  className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-orange-400 text-orange-600 rounded-xl font-bold hover:bg-orange-50 disabled:opacity-50 transition-colors">
                  <XCircle className="w-5 h-5" /> Потрібні правки
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Що потрібно змінити?</label>
                <textarea value={revisionNote} onChange={e => setRevisionNote(e.target.value)}
                  placeholder="Наприклад: змінити колір обкладинки, переставити фото..." rows={4}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e2d7d] mb-4" />
                <div className="flex gap-3">
                  <button onClick={handleRevision} disabled={!revisionNote.trim() || action === 'loading'}
                    className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                    {action === 'loading' ? 'Надсилаємо...' : 'Надіслати правки'}
                  </button>
                  <button onClick={() => setShowRevisionForm(false)}
                    className="px-5 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50">
                    Назад
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer categories={[]} />
    </div>
  );
}
