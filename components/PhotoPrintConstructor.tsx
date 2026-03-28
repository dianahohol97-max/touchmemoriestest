'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, X, AlertTriangle, ShoppingCart, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';

// ─── Size definitions ─────────────────────────────────────────────────────────
const STANDARD_SIZES: Record<string, { w: number; h: number; label: string }> = {
  '10x15': { w: 10, h: 15, label: '10×15 см' },
  '13x18': { w: 13, h: 18, label: '13×18 см' },
  '15x21': { w: 15, h: 21, label: '15×21 см' },
  '20x25': { w: 20, h: 25, label: '20×25 см' },
  '20x30': { w: 20, h: 30, label: '20×30 см' },
  '30x40': { w: 30, h: 40, label: '30×40 см' },
};

// Polaroid sizes (both vertical) — full print dimensions
// Photo zone = total minus borders (side 0.6cm each, top 0.6cm, bottom 1.8cm)
const POLAROID_SIZES: Record<string, { totalW: number; totalH: number; borderSide: number; borderTop: number; borderBottom: number; label: string }> = {
  '7.6x10.1': { totalW: 7.6, totalH: 10.1, borderSide: 0.6, borderTop: 0.6, borderBottom: 1.8, label: '7.6×10.1 см' },
  '8.6x10.7': { totalW: 8.6, totalH: 10.7, borderSide: 0.65, borderTop: 0.65, borderBottom: 2.0, label: '8.6×10.7 см' },
};

interface PhotoFile {
  id: string; file: File; preview: string; width: number; height: number;
  cropX: number; cropY: number; zoom: number;
}
interface ProductOption {
  name: string;
  values?: Array<{ name: string; price?: number; priceModifier?: number }>;
  options?: Array<{ label: string; value: string; price?: number }>;
}
interface PhotoPrintConstructorProps { productSlug: string; }

// ─── Photo Preview Component ──────────────────────────────────────────────────
function PhotoPreview({
  photo, sizeKey, showBorder, isPolaroid, isNonstandard,
  onCropChange,
}: {
  photo: PhotoFile;
  sizeKey: string;
  showBorder: boolean;
  isPolaroid: boolean;
  isNonstandard: boolean;
  onCropChange: (id: string, cropX: number, cropY: number, zoom: number) => void;
}) {
  const MAX_W = 320;
  const size = STANDARD_SIZES[sizeKey];
  
  // Calculate canvas dimensions
  let photoW: number, photoH: number;
  let borderMm = 0;
  let polaroidBottomMm = 0;
  let polaroidSideMm = 0;

  if (isPolaroid) {
    // sizeKey for polaroid is like "7.6x10.1" or "8.6x10.7"
    const pSize = POLAROID_SIZES[sizeKey] || POLAROID_SIZES['7.6x10.1'];
    polaroidSideMm = pSize.borderSide;
    const polaroidTopMm = pSize.borderTop;
    polaroidBottomMm = pSize.borderBottom;
    photoW = pSize.totalW - polaroidSideMm * 2;
    photoH = pSize.totalH - polaroidTopMm - polaroidBottomMm;
    // Override totalW/H calculation
    const totalWPolaroid = pSize.totalW;
    const totalHPolaroid = pSize.totalH;
    const scalePolaroid = MAX_W / totalWPolaroid;
    const canvasWPolaroid = MAX_W;
    const canvasHPolaroid = Math.round(totalHPolaroid * scalePolaroid);
    const borderPxPolaroid = polaroidSideMm * scalePolaroid;
    const borderTopPx = polaroidTopMm * scalePolaroid;
    const borderBottomPxP = polaroidBottomMm * scalePolaroid;
    const photoAreaWP = photoW * scalePolaroid;
    const photoAreaHP = photoH * scalePolaroid;
    // Render using these values directly
    return (
      <div style={{ display:'inline-block', position:'relative' }}>
        <div style={{ width:canvasWPolaroid, height:canvasHPolaroid, position:'relative', background:'#fff', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', userSelect:'none' }} onWheel={(e)=>{e.preventDefault();const delta=e.deltaY>0?-0.05:0.05;onCropChange(photo.id,photo.cropX,photo.cropY,Math.max(0.5,Math.min(3,(photo.zoom||1)+delta)));}}>
          <div style={{ position:'absolute', left:borderPxPolaroid, top:borderTopPx, width:photoAreaWP, height:photoAreaHP, overflow:'hidden', cursor:'grab', background:'#f0f0f0' }} onMouseDown={handleMouseDown}>
            <img src={photo.preview} draggable={false} style={{ width:`${(photo.zoom||1)*100}%`, height:`${(photo.zoom||1)*100}%`, objectFit:'cover', objectPosition:`${photo.cropX}% ${photo.cropY}%`, position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', userSelect:'none', pointerEvents:'none' }}/>
          </div>
          {/* White borders */}
          <div style={{ position:'absolute', left:0, top:0, width:canvasWPolaroid, height:borderTopPx, background:'#fff', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', left:0, bottom:0, width:canvasWPolaroid, height:borderBottomPxP, background:'#fff', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', left:0, top:0, width:borderPxPolaroid, height:canvasHPolaroid, background:'#fff', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', right:0, top:0, width:borderPxPolaroid, height:canvasHPolaroid, background:'#fff', pointerEvents:'none' }}/>
          {/* Crop marks */}
          {[{x:borderPxPolaroid-14,y:borderTopPx,w:10,h:1},{x:borderPxPolaroid,y:borderTopPx-14,w:1,h:10},{x:borderPxPolaroid+photoAreaWP+4,y:borderTopPx,w:10,h:1},{x:borderPxPolaroid+photoAreaWP,y:borderTopPx-14,w:1,h:10},{x:borderPxPolaroid-14,y:borderTopPx+photoAreaHP,w:10,h:1},{x:borderPxPolaroid,y:borderTopPx+photoAreaHP+4,w:1,h:10},{x:borderPxPolaroid+photoAreaWP+4,y:borderTopPx+photoAreaHP,w:10,h:1},{x:borderPxPolaroid+photoAreaWP,y:borderTopPx+photoAreaHP+4,w:1,h:10}].map((l,i)=><div key={i} style={{position:'absolute',left:l.x,top:l.y,width:l.w,height:l.h,background:'#aaa',pointerEvents:'none'}}/>)}
          <div style={{ position:'absolute', left:borderPxPolaroid, bottom:6, width:photoAreaWP, textAlign:'center', fontSize:10, color:'#bbb', pointerEvents:'none', fontStyle:'italic' }}>напис тут</div>
          {(photo.zoom||1)!==1 && <div style={{ position:'absolute', bottom:borderBottomPxP+4, right:borderPxPolaroid+4, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:8, pointerEvents:'none' }}>{Math.round((photo.zoom||1)*100)}%</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:6 }}>
          <button onClick={()=>onCropChange(photo.id,photo.cropX,photo.cropY,Math.max(0.5,(photo.zoom||1)-0.1))} style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 }}>−</button>
          <span style={{ fontSize:11, fontWeight:700, color:'#475569', minWidth:40, textAlign:'center' }}>{Math.round((photo.zoom||1)*100)}%</span>
          <button onClick={()=>onCropChange(photo.id,photo.cropX,photo.cropY,Math.min(3,(photo.zoom||1)+0.1))} style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 }}>+</button>
          <button onClick={()=>onCropChange(photo.id,50,50,1)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:10, color:'#64748b' }}>↺</button>
        </div>
        <p style={{ fontSize:10, color:'#94a3b8', textAlign:'center', marginTop:4 }}>Тягніть фото для кадрування • коліщатко для масштабу</p>
      </div>
    );
  } else if (isNonstandard) {
    // Default ratio 4:3 for nonstandard
    photoW = 15; photoH = 10;
    borderMm = 3; // always 3mm white border
  } else if (size) {
    photoW = size.w; photoH = size.h;
    borderMm = showBorder ? 3 : 0;
  } else {
    photoW = 10; photoH = 15; borderMm = showBorder ? 3 : 0;
  }

  // Total print dimensions including border
  const totalW = photoW + (isPolaroid ? polaroidSideMm * 2 : borderMm * 2);
  const totalH = photoH + (isPolaroid ? polaroidSideMm + polaroidBottomMm : borderMm * 2);

  // Scale to fit MAX_W
  const scale = MAX_W / totalW;
  const canvasW = MAX_W;
  const canvasH = Math.round(totalH * scale);
  const borderPx = (isPolaroid ? polaroidSideMm : borderMm) * scale;
  const borderBottomPx = isPolaroid ? polaroidBottomMm * scale : borderMm * scale;
  const photoAreaW = photoW * scale;
  const photoAreaH = photoH * scale;

  // Crop drag
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, cropX: 50, cropY: 50 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, cropX: photo.cropX, cropY: photo.cropY };
    const onMove = (me: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = (me.clientX - dragStart.current.x) / photoAreaW * 100;
      const dy = (me.clientY - dragStart.current.y) / photoAreaH * 100;
      onCropChange(photo.id, Math.max(0,Math.min(100,dragStart.current.cropX-dx*0.5)), Math.max(0,Math.min(100,dragStart.current.cropY-dy*0.5)), photo.zoom);
    };
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    onCropChange(photo.id, photo.cropX, photo.cropY, Math.max(0.5, Math.min(3, (photo.zoom||1) + delta)));
  };

  const cropMarkLen = 10;
  const cropMarkGap = 4;

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <div
        style={{ width: canvasW, height: canvasH, position: 'relative', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', userSelect: 'none' }}
        onWheel={handleWheel}
      >
        {/* Photo area */}
        <div style={{
          position: 'absolute',
          left: borderPx, top: borderPx,
          width: photoAreaW, height: photoAreaH,
          overflow: 'hidden', cursor: 'grab',
          background: '#f0f0f0',
        }}
          onMouseDown={handleMouseDown}
        >
          <img
            src={photo.preview}
            draggable={false}
            style={{
              width: `${(photo.zoom||1)*100}%`,
              height: `${(photo.zoom||1)*100}%`,
              objectFit: 'cover',
              objectPosition: `${photo.cropX}% ${photo.cropY}%`,
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              userSelect: 'none', pointerEvents: 'none',
            }}
          />
        </div>

        {/* White border areas */}
        {(showBorder || isNonstandard || isPolaroid) && (
          <>
            {/* top */}
            <div style={{ position:'absolute', left:0, top:0, width:canvasW, height:borderPx, background:'#fff', pointerEvents:'none' }}/>
            {/* bottom */}
            <div style={{ position:'absolute', left:0, bottom:0, width:canvasW, height:borderBottomPx, background:'#fff', pointerEvents:'none' }}/>
            {/* left */}
            <div style={{ position:'absolute', left:0, top:0, width:borderPx, height:canvasH, background:'#fff', pointerEvents:'none' }}/>
            {/* right */}
            <div style={{ position:'absolute', right:0, top:0, width:borderPx, height:canvasH, background:'#fff', pointerEvents:'none' }}/>
          </>
        )}

        {/* Crop marks (corner + edge lines in grey) */}
        {[
          // Top-left
          { x: borderPx - cropMarkGap - cropMarkLen, y: borderPx, w: cropMarkLen, h: 1 },
          { x: borderPx, y: borderPx - cropMarkGap - cropMarkLen, w: 1, h: cropMarkLen },
          // Top-right
          { x: borderPx + photoAreaW + cropMarkGap, y: borderPx, w: cropMarkLen, h: 1 },
          { x: borderPx + photoAreaW, y: borderPx - cropMarkGap - cropMarkLen, w: 1, h: cropMarkLen },
          // Bottom-left
          { x: borderPx - cropMarkGap - cropMarkLen, y: borderPx + photoAreaH, w: cropMarkLen, h: 1 },
          { x: borderPx, y: borderPx + photoAreaH + cropMarkGap, w: 1, h: cropMarkLen },
          // Bottom-right
          { x: borderPx + photoAreaW + cropMarkGap, y: borderPx + photoAreaH, w: cropMarkLen, h: 1 },
          { x: borderPx + photoAreaW, y: borderPx + photoAreaH + cropMarkGap, w: 1, h: cropMarkLen },
        ].map((line, i) => (
          <div key={i} style={{ position:'absolute', left:line.x, top:line.y, width:line.w, height:line.h, background:'#aaa', pointerEvents:'none' }}/>
        ))}

        {/* Polaroid handwriting area hint */}
        {isPolaroid && (
          <div style={{ position:'absolute', left:borderPx, bottom:4, width:photoAreaW, textAlign:'center', fontSize:9, color:'#bbb', pointerEvents:'none', letterSpacing:'0.1em' }}>
            напис тут
          </div>
        )}

        {/* Zoom indicator */}
        {(photo.zoom||1) !== 1 && (
          <div style={{ position:'absolute', bottom:borderBottomPx+4, right:borderPx+4, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:8, pointerEvents:'none' }}>
            {Math.round((photo.zoom||1)*100)}%
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:6 }}>
        <button onClick={() => onCropChange(photo.id, photo.cropX, photo.cropY, Math.max(0.5,(photo.zoom||1)-0.1))}
          style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 }}>−</button>
        <span style={{ fontSize:11, fontWeight:700, color:'#475569', minWidth:40, textAlign:'center' }}>{Math.round((photo.zoom||1)*100)}%</span>
        <button onClick={() => onCropChange(photo.id, photo.cropX, photo.cropY, Math.min(3,(photo.zoom||1)+0.1))}
          style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 }}>+</button>
        <button onClick={() => onCropChange(photo.id, 50, 50, 1)}
          style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:10, color:'#64748b' }}>↺</button>
      </div>
      <p style={{ fontSize:10, color:'#94a3b8', textAlign:'center', marginTop:4 }}>Тягніть фото для кадрування • коліщатко для масштабу</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PhotoPrintConstructor({ productSlug }: PhotoPrintConstructorProps) {
  const { addItem } = useCartStore();
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedFinish, setSelectedFinish] = useState('');
  const [selectedBorder, setSelectedBorder] = useState('none');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const isPolaroid = productSlug === 'polaroid-print';
  const isNonstandard = productSlug === 'photoprint-nonstandard';

  useEffect(() => {
    async function fetchProduct() {
      const { data } = await supabase.from('products').select('*').eq('slug', productSlug).eq('is_active', true).single();
      if (data) {
        setProduct(data);
        const options = (data.options as ProductOption[]) || [];
        const sizeOpt = options.find(o => o.name === 'Розмір');
        const sizes = sizeOpt?.values || sizeOpt?.options?.map(o=>({name:o.label})) || [];
        if (sizes.length > 0) setSelectedSize(sizes[0].name || '');
        const finishOpt = options.find(o => o.name === 'Покриття');
        const finishes = finishOpt?.values || finishOpt?.options?.map(o=>({name:o.label})) || [];
        if (finishes.length > 0) setSelectedFinish(finishes[0].name || '');
      }
      setLoading(false);
    }
    fetchProduct();
  }, [productSlug]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newPhotos: PhotoFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      if (photos.length + newPhotos.length >= 500) { toast.error('Максимум 500 фото'); break; }
      const preview = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new window.Image(); im.onload=()=>res(im); im.onerror=rej; im.src=preview; });
        newPhotos.push({ id: Math.random().toString(36).slice(7), file, preview, width: img.width, height: img.height, cropX: 50, cropY: 50, zoom: 1 });
      } catch { URL.revokeObjectURL(preview); }
    }
    setPhotos(prev => [...prev, ...newPhotos]);
    if (newPhotos.length) { toast.success(`Завантажено ${newPhotos.length} фото`); setActivePhotoIdx(photos.length); }
  };

  const updateCrop = (id: string, cropX: number, cropY: number, zoom: number) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, cropX, cropY, zoom } : p));
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => { const updated = prev.filter(p => p.id !== id); if (activePhotoIdx >= updated.length) setActivePhotoIdx(Math.max(0, updated.length - 1)); return updated; });
  };

  // Parse size key from label like "10×15 см — 8 грн" → "10x15"
  const getSizeKey = (label: string): string => {
    // Handle decimal sizes like "7.6×10.1" and integers like "10×15"
    const m = label.match(/([\d.]+)[×x]([\d.]+)/);
    return m ? `${m[1]}x${m[2]}` : '';
  };

  const getSizeOptions = () => {
    if (!product) return [];
    const opts = (product.options as ProductOption[]) || [];
    const sizeOpt = opts.find(o => o.name === 'Розмір');
    return sizeOpt?.values || sizeOpt?.options?.map(o=>({name:o.label, price:o.price})) || [];
  };

  const getFinishOptions = () => {
    if (!product) return [];
    const opts = (product.options as ProductOption[]) || [];
    const fOpt = opts.find(o => o.name === 'Покриття');
    return fOpt?.values || fOpt?.options?.map(o=>({name:o.label})) || [];
  };

  const calculatePrice = () => {
    if (!product || photos.length === 0) return 0;
    const sizeOptions = getSizeOptions();
    let unitPrice = product.price || 0;
    if (selectedSize) {
      const sel = sizeOptions.find(o => o.name === selectedSize);
      if (sel?.price !== undefined) unitPrice = sel.price;
    }
    return unitPrice * photos.length;
  };

  const handleAddToCart = () => {
    const minOrder = 20;
  if (photos.length === 0) { toast.error('Додайте хоча б одне фото'); return; }
  if (photos.length < minOrder) { toast.error(`Мінімальне замовлення — ${minOrder} фото`); return; }
    addItem({
      id: `${product.id}_${Date.now()}`,
      product_id: product.id, name: product.name,
      price: calculatePrice(), qty: 1,
      image: product.images?.[0] || '', slug: product.slug,
      options: { 'Кількість фото': photos.length.toString(), ...(selectedSize && {'Розмір': selectedSize}), ...(selectedFinish && {'Покриття': selectedFinish}), ...(!isNonstandard && !isPolaroid && {'Біла рамочка': selectedBorder === 'with' ? 'Так' : 'Ні'}) },
      personalization_note: `${photos.length} фото для друку`
    });
    toast.success('Додано до кошика!');
    setPhotos([]);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Завантаження...</div>;
  if (!product) return <div className="flex items-center justify-center py-12 text-red-500">Продукт не знайдено</div>;

  const activePhoto = photos[activePhotoIdx];
  const sizeOptions = getSizeOptions();
  const finishOptions = getFinishOptions();
  const sizeKey = getSizeKey(selectedSize);
  const showBorder = !isNonstandard && !isPolaroid && selectedBorder === 'with';
  const hasBorderOption = !isNonstandard && !isPolaroid && (product.options as ProductOption[])?.some(o => o.name === 'Біла рамочка 3мм');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-primary, sans-serif)' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>{product.name}</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>{product.short_description}</p>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* LEFT: Preview */}
        <div style={{ flex: '0 0 auto' }}>
          {activePhoto ? (
            <div>
              <PhotoPreview
                photo={activePhoto}
                sizeKey={sizeKey || '10x15'}
                showBorder={showBorder}
                isPolaroid={isPolaroid}
                isNonstandard={isNonstandard}
                onCropChange={updateCrop}
              />
              {/* Photo navigation */}
              {photos.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12 }}>
                  <button onClick={() => setActivePhotoIdx(i=>Math.max(0,i-1))} disabled={activePhotoIdx===0}
                    style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', opacity:activePhotoIdx===0?0.3:1 }}>←</button>
                  <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>{activePhotoIdx+1} / {photos.length}</span>
                  <button onClick={() => setActivePhotoIdx(i=>Math.min(photos.length-1,i+1))} disabled={activePhotoIdx===photos.length-1}
                    style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', opacity:activePhotoIdx===photos.length-1?0.3:1 }}>→</button>
                </div>
              )}
            </div>
          ) : (
            /* Upload placeholder */
            <div
              onDrop={async e => { e.preventDefault(); setDragging(false); await handleFileSelect(e.dataTransfer.files); }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{ width:320, height:280, border:`2px dashed ${dragging?'#1e2d7d':'#cbd5e1'}`, borderRadius:12, background:dragging?'#dbeafe':'#f8fafc', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, cursor:'pointer', transition:'all 0.2s' }}>
              <Upload size={40} color="#1e2d7d" />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontWeight:700, color:'#1e2d7d', fontSize:15 }}>Завантажте фото</div>
                <div style={{ color:'#94a3b8', fontSize:12, marginTop:4 }}>або перетягніть сюди</div>
              </div>
              <button style={{ padding:'8px 20px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Вибрати фото
              </button>
            </div>
          )}

          {/* Thumbnail strip */}
          {photos.length > 0 && (
            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap', maxWidth:320 }}>
              {photos.map((ph, idx) => (
                <div key={ph.id} onClick={() => setActivePhotoIdx(idx)}
                  style={{ position:'relative', width:52, height:52, borderRadius:6, overflow:'hidden', border:idx===activePhotoIdx?'2px solid #1e2d7d':'2px solid transparent', cursor:'pointer', flexShrink:0 }}>
                  <img src={ph.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={e=>{e.stopPropagation();removePhoto(ph.id);}} style={{ position:'absolute',top:1,right:1,width:16,height:16,borderRadius:'50%',background:'rgba(239,68,68,0.85)',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',opacity:0 }} className="thumb-del">×</button>
                </div>
              ))}
              <style>{`.thumb-del{opacity:0!important} div:hover>.thumb-del{opacity:1!important}`}</style>
              {/* Add more */}
              <div onClick={() => fileInputRef.current?.click()} style={{ width:52, height:52, borderRadius:6, border:'2px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#94a3b8', fontSize:20, flexShrink:0 }}>+</div>
            </div>
          )}
        </div>

        {/* RIGHT: Options */}
        <div style={{ flex:1, minWidth:260 }}>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:20, marginBottom:16 }}>
            <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:16 }}>Налаштування</h3>

            {/* Photo counter */}
            <div style={{ padding:'10px 14px', borderRadius:8, background:photos.length===0?'#fff7ed':'#eff6ff', border:`1px solid ${photos.length===0?'#fed7aa':'#bfdbfe'}`, marginBottom:16 }}>
              <span style={{ fontWeight:700, color:photos.length===0?'#c2410c':photos.length<20?'#d97706':'#1d4ed8', fontSize:13 }}>
              {photos.length}/500 фотографій
              {photos.length > 0 && photos.length < 20 && <span style={{ fontWeight:400, fontSize:11, color:'#d97706', marginLeft:8 }}>мінімум 20 шт</span>}
            </span>
            </div>

            {/* Size */}
            {sizeOptions.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>Розмір *</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {sizeOptions.map(opt => (
                    <button key={opt.name} onClick={() => setSelectedSize(opt.name)}
                      style={{ padding:'6px 12px', border:selectedSize===opt.name?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:selectedSize===opt.name?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:600, fontSize:12, color:selectedSize===opt.name?'#1e2d7d':'#374151' }}>
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Finish */}
            {finishOptions.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>Покриття</label>
                <div style={{ display:'flex', gap:6 }}>
                  {finishOptions.map(opt => (
                    <button key={opt.name} onClick={() => setSelectedFinish(opt.name)}
                      style={{ padding:'6px 14px', border:selectedFinish===opt.name?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:selectedFinish===opt.name?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:600, fontSize:12, color:selectedFinish===opt.name?'#1e2d7d':'#374151' }}>
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Border */}
            {hasBorderOption && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>Біла рамочка 3мм</label>
                <div style={{ display:'flex', gap:6 }}>
                  {[{v:'none',l:'Без рамочки'},{v:'with',l:'З рамочкою'}].map(({v,l}) => (
                    <button key={v} onClick={() => setSelectedBorder(v)}
                      style={{ padding:'6px 14px', border:selectedBorder===v?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:selectedBorder===v?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:600, fontSize:12, color:selectedBorder===v?'#1e2d7d':'#374151' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Nonstandard info */}
            {isNonstandard && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0', marginBottom:16 }}>
                <p style={{ fontSize:12, color:'#15803d', fontWeight:600, margin:0 }}>✓ Автоматична біла рамка 3мм</p>
              </div>
            )}

            {/* Price */}
            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
              {selectedSize && photos.length > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, color:'#64748b' }}>{photos.length} фото × {(() => { const s = sizeOptions.find(o=>o.name===selectedSize); return s?.price ?? product.price ?? 0; })()} ₴</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:800, fontSize:16, color:'#1e2d7d' }}>Разом:</span>
                <span style={{ fontWeight:900, fontSize:26, color:'#1e2d7d' }}>{calculatePrice()} ₴</span>
              </div>
            </div>
          </div>

          {/* Add to cart */}
          <button onClick={handleAddToCart} disabled={photos.length < 20}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'14px', background:photos.length < 20?'#94a3b8':'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontWeight:800, fontSize:16, cursor:photos.length < 20?'not-allowed':'pointer', boxShadow:photos.length < 20?'none':'0 4px 16px rgba(30,45,125,0.3)', transition:'all 0.2s' }}>
            <ShoppingCart size={18} /> Додати до кошика
          </button>

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e=>handleFileSelect(e.target.files)} style={{ display:'none' }} />
        </div>
      </div>
    </div>
  );
}
