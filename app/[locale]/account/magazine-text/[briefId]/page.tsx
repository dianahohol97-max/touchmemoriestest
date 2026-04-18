'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { toast } from 'sonner';
import { Check, Edit2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const supabase = createClient();

interface Page { page: number; topic: string; title: string; text: string; edited_text: string | null; }

export default function MagazineTextPage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params?.briefId as string;

  const [brief, setBrief] = useState<any>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('magazine_briefs')
        .select('*')
        .eq('id', briefId)
        .single();

      if (data) {
        setBrief(data);
        const p = data.approved_pages || data.generated_pages || [];
        setPages(p);
        setApproved(data.status === 'approved');
      }
      setLoading(false);
    };
    load();
  }, [briefId]);

  const currentPageData = pages[currentPage];
  const displayText = currentPageData?.edited_text || currentPageData?.text || '';

  const startEdit = () => { setEditText(displayText); setEditing(true); };
  const cancelEdit = () => setEditing(false);

  const saveEdit = () => {
    const updated = pages.map((p, i) => i === currentPage ? { ...p, edited_text: editText } : p);
    setPages(updated);
    setEditing(false);
    toast.success('Текст збережено');
  };

  const approveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/magazine-brief/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, pages }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setApproved(true);
      toast.success('Текст підтверджено! Він буде додано до вашого журналу.');
    } catch {
      toast.error('Помилка. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <RefreshCw size={32} className="animate-spin" color="#1e2d7d" />
    </div>
  );

  if (!brief) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 18, color: '#6b7280' }}>Анкету не знайдено</p>
      <button onClick={() => router.push('/uk/account')} style={{ padding: '10px 24px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>До кабінету</button>
    </div>
  );

  if (brief.status === 'scheduled' || brief.status === 'pending') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, maxWidth: 600, margin: '0 auto', padding: '120px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 24 }}>⏳</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e2d7d', marginBottom: 16 }}>Текст ще готується</h1>
        <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.8 }}>
          Ми вже працюємо над вашим текстом. Очікуйте листа на пошту.<br />
          {brief.scheduled_for && `Орієнтовно: ${new Date(brief.scheduled_for).toLocaleString('uk-UA')}`}
        </p>
      </main>
      <Footer />
    </div>
  );

  if (brief.status === 'generating') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, maxWidth: 600, margin: '0 auto', padding: '120px 20px', textAlign: 'center' }}>
        <RefreshCw size={48} color="#1e2d7d" className="animate-spin" style={{ margin: '0 auto 24px' }} />
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e2d7d', marginBottom: 16 }}>Генеруємо текст...</h1>
        <p style={{ fontSize: 16, color: '#6b7280' }}>Зазвичай займає 1-2 хвилини. Оновіть сторінку через хвилину.</p>
      </main>
      <Footer />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, maxWidth: 780, margin: '0 auto', padding: '100px 20px 60px', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Ваш журнал · Текст</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', margin: 0 }}>Для {brief.subject_name}</h1>
          {approved && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 14px', fontSize: 13, color: '#16a34a', fontWeight: 700 }}>
              <Check size={14} /> Текст підтверджено
            </div>
          )}
        </div>

        {/* Page navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {pages.map((p, i) => (
            <button key={i} onClick={() => { setCurrentPage(i); setEditing(false); }}
              style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${currentPage === i ? '#1e2d7d' : '#e5e7eb'}`, background: currentPage === i ? '#1e2d7d' : '#fff', color: currentPage === i ? '#fff' : '#374151', fontSize: 13, cursor: 'pointer', fontWeight: currentPage === i ? 700 : 400, whiteSpace: 'nowrap' }}>
              {i + 1}. {p.title}
            </button>
          ))}
        </div>

        {/* Current page */}
        {currentPageData && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '32px', marginBottom: 24, boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Сторінка {currentPage + 1}</p>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e2d7d', margin: 0 }}>{currentPageData.title}</h2>
                {currentPageData.edited_text && (
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginTop: 4, display: 'block' }}>✏️ Відредаговано вами</span>
                )}
              </div>
              {!approved && !editing && (
                <button onClick={startEdit}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Edit2 size={14} /> Редагувати
                </button>
              )}
            </div>

            {editing ? (
              <>
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                  style={{ width: '100%', minHeight: 250, padding: '16px', border: '2px solid #1e2d7d', borderRadius: 10, fontSize: 16, lineHeight: 1.8, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={cancelEdit} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>Скасувати</button>
                  <button onClick={saveEdit} style={{ padding: '10px 24px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Зберегти зміни</button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 16, lineHeight: 1.9, color: '#1a1a1a', fontFamily: 'Georgia, serif', whiteSpace: 'pre-line', margin: 0 }}>{displayText}</p>
            )}
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <button onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); setEditing(false); }} disabled={currentPage === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', opacity: currentPage === 0 ? 0.4 : 1, fontSize: 14 }}>
            <ChevronLeft size={16} /> Попередня
          </button>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{currentPage + 1} / {pages.length}</span>
          <button onClick={() => { setCurrentPage(p => Math.min(pages.length - 1, p + 1)); setEditing(false); }} disabled={currentPage === pages.length - 1}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: currentPage === pages.length - 1 ? 'not-allowed' : 'pointer', opacity: currentPage === pages.length - 1 ? 0.4 : 1, fontSize: 14 }}>
            Наступна <ChevronRight size={16} />
          </button>
        </div>

        {/* Approve */}
        {!approved && (
          <div style={{ background: '#f0f3ff', border: '1px solid #c7d2fe', borderRadius: 14, padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: '#374151', marginBottom: 6, fontWeight: 600 }}>Все підходить?</p>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Після підтвердження текст автоматично додасться у ваш журнал</p>
            <button onClick={approveAll} disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 36px', background: saving ? '#9ca3af' : '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <Check size={18} /> {saving ? 'Зберігаємо...' : 'Підтвердити текст'}
            </button>
          </div>
        )}

        {approved && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: '#166534', fontWeight: 700, marginBottom: 8 }}>✅ Текст підтверджено і додано до журналу!</p>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Дизайнер вже бачить ваш текст і додасть його в макет</p>
            <button onClick={() => router.push('/uk/account')}
              style={{ padding: '10px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              До кабінету
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
