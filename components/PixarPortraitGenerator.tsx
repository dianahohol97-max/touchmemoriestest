'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Wand2, X, Download, RefreshCw } from 'lucide-react';

export type PixarStyle = 'pixar' | 'anime' | 'cartoon' | 'watercolor' | 'sketch' | 'oilpainting';
export const AI_PORTRAIT_PRICE = 75; // UAH surcharge per order

interface StyleOption {
  id: PixarStyle;
  label: string;
  emoji: string;
  desc: string;
  color: string;
}

const STYLES: StyleOption[] = [
  { id: 'pixar',      label: 'Піксар',         emoji: '', desc: 'Pixar/Disney 3D персонаж', color: '#f0f3ff' },
  { id: 'anime',      label: 'Аніме',           emoji: '', desc: 'Studio Ghibli стиль',      color: '#fef3c7' },
  { id: 'cartoon',    label: 'Мультик',         emoji: '', desc: 'Disney 2D мультиплікація', color: '#f0fdf4' },
  { id: 'watercolor', label: 'Акварель',        emoji: '', desc: 'Акварельний живопис',       color: '#fce7f3' },
  { id: 'sketch',     label: 'Ескіз',           emoji: '', desc: 'Олівцевий малюнок',         color: '#f8fafc' },
  { id: 'oilpainting',label: 'Олія',            emoji: '', desc: 'Класичний олійний живопис', color: '#fff7ed' },
];

interface Props {
  /** Called when result image is ready — returns a data URL or remote URL */
  onResult: (imageUrl: string, style: PixarStyle) => void;
  /** Optional: already selected source photo */
  sourcePhotoUrl?: string;
  /** Compact mode for embedding in sidebars */
  compact?: boolean;
}

export default function PixarPortraitGenerator({ onResult, sourcePhotoUrl, compact = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string>(sourcePhotoUrl || '');
  const [selectedStyle, setSelectedStyle] = useState<PixarStyle>('pixar');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string>('');
  const [predictionId, setPredictionId] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Тільки зображення'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Файл занадто великий (макс. 10MB)'); return; }
    setSourceFile(file);
    setResultUrl('');
    const reader = new FileReader();
    reader.onload = e => setSourcePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const pollPrediction = async (id: string, attempts = 0): Promise<void> => {
    if (attempts > 40) {
      setIsGenerating(false);
      toast.error('Час очікування вийшов. Спробуйте ще раз.');
      return;
    }

    await new Promise(r => setTimeout(r, 3000));
    setProgress(Math.min(90, 20 + attempts * 2));

    try {
      const res = await fetch(`/api/pixar-portrait?id=${id}`);
      const data = await res.json();

      if (data.status === 'succeeded' && data.url) {
        setProgress(100);
        setResultUrl(data.url);
        setIsGenerating(false);
        toast.success(' Портрет готовий!');
        onResult(data.url, selectedStyle);
        return;
      } else if (data.status === 'failed') {
        setIsGenerating(false);
        toast.error('Помилка генерації. Спробуйте ще раз.');
        return;
      }
      // Still processing
      return pollPrediction(id, attempts + 1);
    } catch {
      setIsGenerating(false);
      toast.error('Помилка зв\'язку');
    }
  };

  const handleGenerate = async () => {
    if (!sourceFile && !sourcePhotoUrl) {
      toast.error('Спочатку завантажте фото');
      return;
    }
    setIsGenerating(true);
    setProgress(10);
    setResultUrl('');

    try {
      const formData = new FormData();
      if (sourceFile) {
        formData.append('image', sourceFile);
      } else if (sourcePhotoUrl) {
        // Fetch the source URL and convert to file
        const res = await fetch(sourcePhotoUrl);
        const blob = await res.blob();
        formData.append('image', blob, 'photo.jpg');
      }
      formData.append('style', selectedStyle);

      setProgress(20);
      const res = await fetch('/api/pixar-portrait', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'API error');
      }

      if (data.url) {
        // Immediate result
        setProgress(100);
        setResultUrl(data.url);
        setIsGenerating(false);
        toast.success(' Портрет готовий!');
        onResult(data.url, selectedStyle);
      } else if (data.predictionId && data.polling) {
        // Need to poll
        setPredictionId(data.predictionId);
        await pollPrediction(data.predictionId);
      }
    } catch (err: any) {
      setIsGenerating(false);
      setProgress(0);
      toast.error('Помилка: ' + (err.message || 'Спробуйте ще раз'));
    }
  };

  const handleUseResult = () => {
    if (resultUrl) onResult(resultUrl, selectedStyle);
  };

  const styleObj = STYLES.find(s => s.id === selectedStyle) || STYLES[0];

  //  Compact mode (for sidebar in BookLayoutEditor/PosterConstructor) 
  if (compact) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {/* Source photo */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6 }}>Фото для перетворення</div>
          {sourcePreview ? (
            <div style={{ position:'relative', marginBottom:8 }}>
              <img src={sourcePreview} style={{ width:'100%', height:90, objectFit:'cover', borderRadius:8 }}/>
              <button onClick={() => { setSourcePreview(''); setSourceFile(null); setResultUrl(''); }}
                style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              style={{ width:'100%', padding:'10px', border:'2px dashed #c7d2fe', borderRadius:8, background:'#f8faff', color:'#1e2d7d', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Upload size={14}/> Завантажити фото
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleFileChange}/>
        </div>

        {/* Style pills */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6 }}>Стиль</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                style={{ padding:'4px 8px', borderRadius:20, border: selectedStyle===s.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  background: selectedStyle===s.id ? '#1e2d7d' : s.color,
                  color: selectedStyle===s.id ? '#fff' : '#374151',
                  fontSize:10, fontWeight:700, cursor:'pointer' }}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button onClick={handleGenerate} disabled={isGenerating || (!sourceFile && !sourcePhotoUrl)}
          style={{ width:'100%', padding:'10px', background: isGenerating ? '#94a3b8' : '#7c3aed',
            color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:13,
            cursor: isGenerating ? 'wait' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <Wand2 size={14}/>
          {isGenerating ? `Генерую... ${progress}%` : ` Перетворити в ${styleObj.label} (+${AI_PORTRAIT_PRICE} ₴)`}
        </button>

        {/* Progress bar */}
        {isGenerating && (
          <div style={{ background:'#e2e8f0', borderRadius:4, height:4, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'#7c3aed', width:`${progress}%`, transition:'width 0.5s ease', borderRadius:4 }}/>
          </div>
        )}

        {/* Result */}
        {resultUrl && (
          <div style={{ border:'2px solid #7c3aed', borderRadius:8, overflow:'hidden' }}>
            <img src={resultUrl} style={{ width:'100%', display:'block' }}/>
            <button onClick={handleUseResult}
              style={{ width:'100%', padding:'8px', background:'#7c3aed', color:'#fff', border:'none', fontWeight:700, fontSize:12, cursor:'pointer' }}>
               Використати цю фотографію
            </button>
          </div>
        )}
      </div>
    );
  }

  //  Full mode 
  return (
    <div style={{ maxWidth:700, margin:'0 auto', fontFamily:'var(--font-primary, sans-serif)' }}>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ fontSize:32, marginBottom:8 }}></div>
        <h2 style={{ fontSize:22, fontWeight:800, color:'#1e2d7d', margin:'0 0 6px' }}>AI Портрет</h2>
        <p style={{ fontSize:14, color:'#64748b', margin:0 }}>Перетворіть фото в художній стиль за допомогою штучного інтелекту</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* LEFT: Upload + Settings */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Photo upload */}
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:8 }}>Ваше фото</div>
            {sourcePreview ? (
              <div style={{ position:'relative' }}>
                <img src={sourcePreview} style={{ width:'100%', height:200, objectFit:'cover', borderRadius:10, border:'2px solid #c7d2fe' }}/>
                <button onClick={() => { setSourcePreview(''); setSourceFile(null); setResultUrl(''); }}
                  style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(0,0,0,0.65)', color:'#fff', border:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:10, padding:'2px 6px', borderRadius:4 }}>Оригінал</div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()}
                style={{ width:'100%', height:200, border:'2px dashed #c7d2fe', borderRadius:10, background:'#f8faff', color:'#1e2d7d', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
                <Upload size={28}/>
                <span>Завантажити фото</span>
                <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>JPG, PNG до 10 МБ</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleFileChange}/>
          </div>

          {/* Style selector */}
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:8 }}>Оберіть стиль</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                  style={{ padding:'8px 10px', borderRadius:10, textAlign:'left',
                    border: selectedStyle===s.id ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                    background: selectedStyle===s.id ? '#faf5ff' : s.color,
                    cursor:'pointer', transition:'all 0.15s' }}>
                  <div style={{ fontSize:16, marginBottom:2 }}>{s.emoji}</div>
                  <div style={{ fontSize:11, fontWeight:700, color: selectedStyle===s.id ? '#7c3aed' : '#374151' }}>{s.label}</div>
                  <div style={{ fontSize:9, color:'#94a3b8' }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button onClick={handleGenerate} disabled={isGenerating || !sourcePreview}
            style={{ width:'100%', padding:'14px', background: (!sourcePreview || isGenerating) ? '#e2e8f0' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: (!sourcePreview || isGenerating) ? '#94a3b8' : '#fff',
              border:'none', borderRadius:12, fontWeight:800, fontSize:15,
              cursor: (!sourcePreview || isGenerating) ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow: sourcePreview && !isGenerating ? '0 4px 20px rgba(124,58,237,0.35)' : 'none' }}>
            {isGenerating ? <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/> : <Wand2 size={18}/>}
            {isGenerating ? `Генерую... ${progress}%` : ` Перетворити в ${styleObj.emoji} ${styleObj.label} (+${AI_PORTRAIT_PRICE} ₴)`}
          </button>

          {/* Progress */}
          {isGenerating && (
            <div>
              <div style={{ background:'#e2e8f0', borderRadius:6, height:6, overflow:'hidden', marginBottom:6 }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg, #7c3aed, #a855f7)', width:`${progress}%`, transition:'width 0.5s ease', borderRadius:6 }}/>
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', textAlign:'center' }}>
                {progress < 30 ? 'Відправляємо фото...' : progress < 70 ? 'AI обробляє портрет (~20-40 сек)...' : 'Майже готово...'}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Result */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:2 }}>Результат</div>
          {resultUrl ? (
            <>
              <div style={{ position:'relative' }}>
                <img src={resultUrl} style={{ width:'100%', height:280, objectFit:'cover', borderRadius:10, border:'2px solid #a855f7' }}/>
                <div style={{ position:'absolute', top:8, left:8, background:'rgba(124,58,237,0.85)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>
                  {styleObj.emoji} {styleObj.label}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleUseResult}
                  style={{ flex:1, padding:'10px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                   Використати
                </button>
                <a href={resultUrl} download="portrait.jpg" target="_blank"
                  style={{ padding:'10px 12px', background:'#f0f3ff', color:'#1e2d7d', border:'1px solid #c7d2fe', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                  <Download size={14}/> Зберегти
                </a>
                <button onClick={() => setResultUrl('')}
                  style={{ padding:'10px 12px', background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                  Ще раз
                </button>
              </div>
            </>
          ) : (
            <div style={{ height:280, border:'2px dashed #e2e8f0', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#94a3b8', background:'#fafafa' }}>
              <div style={{ fontSize:48 }}></div>
              <div style={{ fontSize:13, textAlign:'center', padding:'0 20px' }}>
                {sourcePreview ? `Натисніть "Перетворити" для генерації` : 'Завантажте фото та оберіть стиль'}
              </div>
              {sourcePreview && !isGenerating && (
                <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center' }}>~20–40 секунд</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info note */}
      <div style={{ background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#7c3aed' }}>
         <b>AI перетворення (+75 ₴):</b> Штучний інтелект (FLUX 2 Pro) зберігає риси обличчя і трансформує стиль. Результат ~20–40 секунд.
      </div>
    </div>
  );
}
