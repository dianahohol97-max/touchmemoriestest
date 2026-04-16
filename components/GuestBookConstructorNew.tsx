'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Upload, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { CoverEditor, CoverConfig, VELOUR_COLORS, LEATHERETTE_COLORS, FABRIC_COLORS } from './CoverEditor';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';

//  Types 
type BookSize = '20x30' | '30x20' | '23x23';
type PageColor = 'white' | 'cream' | 'black';
type CoverMaterial = 'velour' | 'leatherette' | 'fabric' | 'printed';
type InteriorType = 'blank' | 'lined' | 'dotgrid' | 'prompted';

interface PromptItem { id: string; text: string; enabled: boolean; }

const DEFAULT_PROMPTS: PromptItem[] = [
  { id:'p1', text:'Моє побажання для вас...', enabled:true },
  { id:'p2', text:'Найкращий спогад з вами...', enabled:true },
  { id:'p3', text:'Порада на все життя...', enabled:true },
  { id:'p4', text:'Що я хочу вам побажати...', enabled:false },
  { id:'p5', text:'Найсмішніший момент...', enabled:false },
];

const SIZES: {id:BookSize; label:string; w:number; h:number; price:number}[] = [
  { id:'20x30', label:'20×30 см', w:200, h:300, price:559 },
  { id:'30x20', label:'30×20 см', w:300, h:200, price:599 },
  { id:'23x23', label:'23×23 см', w:230, h:230, price:579 },
];

const PAGE_COLORS: {id:PageColor; label:string; hex:string; textColor:string}[] = [
  { id:'white', label:'Білі', hex:'#ffffff', textColor:'#374151' },
  { id:'cream', label:'Кремові', hex:'#fdfaf2', textColor:'#3d2c1e' },
  { id:'black', label:'Чорні', hex:'#111111', textColor:'#f0f0f0' },
];

const PAGE_COUNTS = [32, 48, 64, 96];

const INTERIOR_TYPES: {id:InteriorType; label:string; icon:string; desc:string}[] = [
  { id:'blank',    label:'Чисті',        icon:'',   desc:'Порожні сторінки' },
  { id:'lined',    label:'З лініями',    icon:'≡',   desc:'Горизонтальні лінії' },
  { id:'dotgrid',  label:'Крапки',       icon:'',  desc:'Сітка з крапок' },
  { id:'prompted', label:'З підказками', icon:'', desc:'Питання для гостей' },
];

const MAT_COLORS: Record<CoverMaterial, {name:string; hex:string}[]> = {
  velour:      Object.entries(VELOUR_COLORS).map(([name,hex])=>({name,hex})),
  leatherette: Object.entries(LEATHERETTE_COLORS).map(([name,hex])=>({name,hex})),
  fabric:      Object.entries(FABRIC_COLORS).map(([name,hex])=>({name,hex})),
  printed:     [],
};

const MAT_LABELS: Record<CoverMaterial,string> = {
  velour:'Велюр', leatherette:'Шкірзам', fabric:'Тканина', printed:'Друкована'
};

const DECO_TYPES = [
  {id:'acryl',        label:'Акрил'},
  {id:'photovstavka', label:'Фотовставка'},
  {id:'flex',         label:'Друк кольором'},
  {id:'metal',        label:'Метал'},
  {id:'graviruvannya',label:'Гравіювання'},
  {id:'none',         label:'Без декору'},
];

const STEP_LABELS = ['1. Обкладинка', '2. Сторінки', '3. Розмір'];

const DEFAULT_COVER: CoverConfig = {
  coverMaterial: 'velour',
  coverColorName: Object.keys(VELOUR_COLORS)[0],
  decoType: 'acryl',
  decoVariant: '',
  decoColor: '',
  photoId: null,
  decoText: 'Книга побажань',
  textX: 50, textY: 50,
  textFontFamily: 'Playfair Display',
  textFontSize: 32,
  extraTexts: [],
  printedBgColor: '#1e2d7d',
  printedTextBlocks: [{ id:'t1', text:'Книга побажань', x:50, y:60, fontSize:24, fontFamily:'Playfair Display', color:'#ffffff', bold:false }],
  printedOverlay: { type:'none', color:'#000', opacity:0, gradient:'' },
};

//  Page preview 
function PagePreview({ pageColor, interiorType, prompts, W, H }:
  { pageColor:PageColor; interiorType:InteriorType; prompts:PromptItem[]; W:number; H:number }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const c = PAGE_COLORS.find(p=>p.id===pageColor)!;
  useEffect(()=>{
    const canvas = ref.current; if(!canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = c.hex; ctx.fillRect(0,0,W,H);
    const pad = W*0.07; const s = W/200;
    const lineCol = pageColor==='black' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const txtCol  = pageColor==='black' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
    if (interiorType==='lined') {
      const sp = Math.round(16*s); ctx.strokeStyle=lineCol; ctx.lineWidth=0.7;
      for(let y=pad+sp*2; y<H-pad; y+=sp){ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();}
      // Name line
      ctx.strokeStyle=pageColor==='black'?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.15)';ctx.lineWidth=0.9;
      ctx.beginPath();ctx.moveTo(pad,pad+sp);ctx.lineTo(W-pad,pad+sp);ctx.stroke();
      ctx.fillStyle=txtCol;ctx.font=`${Math.round(6*s)}px sans-serif`;ctx.fillText("Ім'я",pad,pad+sp-3);
    } else if (interiorType==='dotgrid') {
      const ds=Math.round(11*s);ctx.fillStyle=lineCol;
      for(let x=pad;x<W-pad;x+=ds)for(let y=pad+ds;y<H-pad;y+=ds){ctx.beginPath();ctx.arc(x,y,0.7,0,Math.PI*2);ctx.fill();}
    } else if (interiorType==='prompted') {
      const active=prompts.filter(p=>p.enabled); const lh=Math.round(34*s);
      ctx.fillStyle=txtCol;ctx.font=`${Math.round(7*s)}px sans-serif`;
      active.slice(0,3).forEach((p,i)=>{
        const y=pad+i*(lh*2.1);ctx.fillText(p.text,pad,y+10);
        ctx.strokeStyle=lineCol;ctx.lineWidth=0.7;
        for(let l=0;l<2;l++){ctx.beginPath();ctx.moveTo(pad,y+18+l*lh*0.55);ctx.lineTo(W-pad,y+18+l*lh*0.55);ctx.stroke();}
      });
    }
    // Page number
    ctx.fillStyle=txtCol;ctx.font=`${Math.round(6.5*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText('1',W/2,H-pad*0.4);
  },[pageColor,interiorType,prompts,W,H]);
  return <canvas ref={ref} width={W} height={H} style={{width:'100%',height:'auto',display:'block',borderRadius:6}}/>;
}

//  Cover canvas preview 
function CoverPreview({ cover, photos, W, H }:
  { cover:CoverConfig; photos:{id:string;preview:string}[]; W:number; H:number }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas = ref.current; if(!canvas) return;
    canvas.width=W; canvas.height=H;
    const ctx = canvas.getContext('2d')!;
    let bg='#1e2d7d';
    if(cover.coverMaterial==='velour') bg=VELOUR_COLORS[cover.coverColorName]||'#1e2d7d';
    else if(cover.coverMaterial==='leatherette') bg=LEATHERETTE_COLORS[cover.coverColorName]||'#3d2c1e';
    else if(cover.coverMaterial==='fabric') bg=FABRIC_COLORS[cover.coverColorName]||'#c4aa88';
    else if(cover.coverMaterial==='printed') bg=cover.printedBgColor||'#1e2d7d';
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    const s=W/240;
    const isLight=['Кремовий','Білий','Бежевий','Пудровий рожевий'].includes(cover.coverColorName)||cover.coverMaterial==='fabric';
    const tc=isLight?'#1a1a1a':'#ffffff';
    // Photo for printed
    const drawText=()=>{
      const blocks = cover.coverMaterial==='printed' ? (cover.printedTextBlocks||[]) : [];
      if(blocks.length>0){
        blocks.forEach(b=>{
          ctx.fillStyle=b.color||tc;
          ctx.font=`${b.bold?700:400} ${Math.round(b.fontSize*s*0.6)}px '${b.fontFamily||cover.textFontFamily}',serif`;
          ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillText(b.text,(b.x/100)*W,(b.y/100)*H);
        });
      } else if(cover.decoText){
        ctx.fillStyle=tc;ctx.font=`400 ${Math.round(cover.textFontSize*s*0.6)}px '${cover.textFontFamily}',serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(cover.decoText,(cover.textX/100)*W,(cover.textY/100)*H);
      }
      // Border
      ctx.strokeStyle=isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.15)';ctx.lineWidth=0.8;
      ctx.strokeRect(W*0.05,H*0.04,W*0.9,H*0.92);
    };
    if(cover.coverMaterial==='printed'&&cover.photoId){
      const ph=photos.find(p=>p.id===cover.photoId);
      if(ph){const img=new Image();img.onload=()=>{
        const ia=img.width/img.height,sa=W/H;
        let dw,dh,dx,dy;if(ia>sa){dh=H;dw=dh*ia;dx=-(dw-W)/2;dy=0;}else{dw=W;dh=dw/ia;dx=0;dy=-(dh-H)/2;}
        ctx.globalAlpha=0.85;ctx.drawImage(img,dx,dy,dw,dh);ctx.globalAlpha=1;drawText();
      };img.src=ph.preview;return;}
    }
    drawText();
  },[cover,photos,W,H]);
  return <canvas ref={ref} width={W} height={H} style={{width:'100%',height:'auto',display:'block',borderRadius:8}}/>;
}

//  Main constructor 
export default function GuestBookConstructorNew() {
  const t = useT();
  const router = useRouter();
  const { addItem } = useCartStore();
  const [step, setStep] = useState(0); // 0=cover, 1=pages, 2=size

  // Cover state
  const [cover, setCover] = useState<CoverConfig>({...DEFAULT_COVER});
  const [photos, setPhotos] = useState<{id:string;preview:string}[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pages state
  const [interiorType, setInteriorType] = useState<InteriorType>('lined');
  const [pageColor, setPageColor] = useState<PageColor>('cream');
  const [pageCount, setPageCount] = useState(48);
  const [prompts, setPrompts] = useState<PromptItem[]>(DEFAULT_PROMPTS);

  // Size state
  const [size, setSize] = useState<BookSize>('20x30');

  const sizeObj = SIZES.find(s=>s.id===size)!;
  const matPrice = cover.coverMaterial==='printed' ? -200 : 0;
  const totalPrice = sizeObj.price + matPrice;

  // Preview dimensions
  const PW = sizeObj.id==='30x20' ? 300 : 220;
  const PH = sizeObj.id==='30x20' ? Math.round(300*200/300) : Math.round(220*(sizeObj.h/sizeObj.w));

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    const url = URL.createObjectURL(f);
    const id = `p-${Date.now()}`;
    setPhotos(prev=>[...prev,{id,preview:url}]);
    setCover(prev=>({...prev,photoId:id}));
    if(fileRef.current) fileRef.current.value='';
  };

  const handleOrder = () => {
    addItem({
      id:`guestbook-${Date.now()}`,
      name:`Книга побажань ${sizeObj.label}`,
      price:totalPrice, qty:1,
      image:photos[0]?.preview||'',
      options:{
        'Розмір':sizeObj.label,
        'Матеріал':MAT_LABELS[cover.coverMaterial as CoverMaterial],
        'Колір':cover.coverColorName||'—',
        'Сторінки':INTERIOR_TYPES.find(t=>t.id===interiorType)?.label||interiorType,
        'Кількість сторінок':String(pageCount),
        'Колір сторінок':PAGE_COLORS.find(c=>c.id===pageColor)?.label||pageColor,
      },
      personalization_note:`Текст: ${cover.decoText||cover.printedTextBlocks?.[0]?.text||''}`,
    });
    toast.success(t('guestbooknew.successMessage'));
    router.push('/cart');
  };

  return (
    <div style={{fontFamily:'var(--font-primary,sans-serif)',minHeight:'100vh',background:'#f8fafc'}}>
      {/*  Header  */}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
        <a href="/catalog/guestbook-wedding" style={{color:'#64748b',textDecoration:'none',fontSize:13,display:'flex',alignItems:'center',gap:4}}>
          <ChevronLeft size={14}/> Назад
        </a>
        <span style={{color:'#e2e8f0'}}>|</span>
        <h1 style={{fontSize:16,fontWeight:800,color:'#1e2d7d',margin:0}}>{t('guestbooknew.title')}</h1>
        <div style={{marginLeft:'auto',fontSize:18,fontWeight:900,color:'#1e2d7d'}}>{totalPrice} ₴</div>
        {step===2&&<button onClick={handleOrder} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',background:'#1e2d7d',color:'#fff',border:'none',borderRadius:9,fontWeight:800,fontSize:13,cursor:'pointer',boxShadow:'0 4px 16px rgba(30,45,125,0.25)'}}>
          <ShoppingCart size={15}/> {t('guestbooknew.order')}
        </button>}
      </div>

      {/*  Step tabs  */}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex'}}>
        {STEP_LABELS.map((label,i)=>(
          <button key={i} onClick={()=>setStep(i)}
            style={{padding:'11px 22px',border:'none',background:step===i?'#f0f3ff':'transparent',
              color:step===i?'#1e2d7d':'#64748b',fontWeight:step===i?800:500,fontSize:13,cursor:'pointer',
              borderBottom:step===i?'3px solid #1e2d7d':'3px solid transparent',display:'flex',alignItems:'center',gap:6}}>
            {step>i&&<Check size={13} color="#10b981"/>}{label}
          </button>
        ))}
      </div>

      {/*  Body  */}
      <div style={{display:'flex',maxWidth:1400,margin:'0 auto',minHeight:'calc(100vh - 110px)'}}>

        {/*  Left panel  */}
        <div style={{width:340,flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>

          {/* STEP 0: Cover */}
          {step===0&&(<>
            <div>
              <h3 style={{fontSize:14,fontWeight:800,color:'#1e2d7d',margin:'0 0 4px'}}>{t('guestbooknew.coverMaterial')}</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {(['velour','leatherette','fabric','printed'] as CoverMaterial[]).map(mat=>(
                  <button key={mat} onClick={()=>setCover(prev=>({...prev,coverMaterial:mat,coverColorName:MAT_COLORS[mat][0]?.name||''}))}
                    style={{padding:'10px 8px',border:cover.coverMaterial===mat?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:10,background:cover.coverMaterial===mat?'#f0f3ff':'#fff',cursor:'pointer',textAlign:'left'}}>
                    <div style={{fontSize:12,fontWeight:700,color:cover.coverMaterial===mat?'#1e2d7d':'#374151'}}>{MAT_LABELS[mat]}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{mat==='velour'?t('guestbooknew.velourDesc'):mat==='leatherette'?t('guestbooknew.leatheretteDesc'):mat==='fabric'?t('guestbooknew.fabricDesc'):t('guestbooknew.printedDesc')}</div>
                    {mat==='printed'&&<div style={{fontSize:9,color:'#10b981',fontWeight:700,marginTop:2}}>{t('guestbooknew.printedDiscount')}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Color swatches — only for non-printed */}
            {cover.coverMaterial!=='printed'&&(
              <div>
                <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>
                  {cover.coverMaterial==='velour'?t('guestbooknew.coverColorVelour'):cover.coverMaterial==='leatherette'?t('guestbooknew.coverColorLeatherette'):t('guestbooknew.coverColorFabric')}
                </h4>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:5}}>
                  {MAT_COLORS[cover.coverMaterial as CoverMaterial].map(({name,hex})=>(
                    <button key={name} title={name} onClick={()=>setCover(prev=>({...prev,coverColorName:name}))}
                      style={{width:30,height:30,borderRadius:'50%',background:hex,
                        border:cover.coverColorName===name?'3px solid #1e2d7d':'1.5px solid #e2e8f0',
                        cursor:'pointer',boxShadow:'0 0 0 0.5px #ddd'}}/>
                  ))}
                </div>
                <div style={{fontSize:11,color:'#64748b'}}>{t('guestbooknew.selected')} <b>{cover.coverColorName}</b></div>
              </div>
            )}

            {/* Printed: photo upload + bg color */}
            {cover.coverMaterial==='printed'&&(
              <div>
                <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>{t('guestbooknew.photoForCover')}</h4>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoUpload}/>
                {photos.length>0&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:8}}>
                    {photos.map(p=>(
                      <div key={p.id} onClick={()=>setCover(prev=>({...prev,photoId:p.id}))}
                        style={{position:'relative',borderRadius:6,overflow:'hidden',border:cover.photoId===p.id?'2px solid #1e2d7d':'1px solid #e2e8f0',cursor:'pointer'}}>
                        <img src={p.preview} style={{width:'100%',height:55,objectFit:'cover'}}/>
                        {cover.photoId===p.id&&<div style={{position:'absolute',top:3,right:3,width:14,height:14,borderRadius:'50%',background:'#1e2d7d',display:'flex',alignItems:'center',justifyContent:'center'}}><Check size={8} color="#fff"/></div>}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={()=>fileRef.current?.click()}
                  style={{width:'100%',padding:'9px',border:'2px dashed #c7d2fe',borderRadius:8,background:'#f8faff',color:'#1e2d7d',fontWeight:700,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                  <Upload size={13}/> {t('guestbooknew.uploadPhoto')}
                </button>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:6}}>Колір фону</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {['#1e2d7d','#14532d','#3d2c1e','#1a1a1a','#7c3aed','#be185d','#0369a1','#ffffff','#faf6ee'].map(c=>(
                      <button key={c} onClick={()=>setCover(prev=>({...prev,printedBgColor:c}))}
                        style={{width:24,height:24,borderRadius:'50%',background:c,border:(cover.printedBgColor||'#1e2d7d')===c?'3px solid #1e2d7d':'1.5px solid #e2e8f0',cursor:'pointer'}}/>
                    ))}
                    <input type="color" value={cover.printedBgColor||'#1e2d7d'} onChange={e=>setCover(prev=>({...prev,printedBgColor:e.target.value}))}
                      style={{width:24,height:24,borderRadius:4,border:'1px solid #e2e8f0',cursor:'pointer',padding:1}}/>
                  </div>
                </div>
              </div>
            )}

            {/* Text on cover */}
            <div>
              <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>{t('guestbooknew.coverText')}</h4>
              <input type="text"
                value={cover.coverMaterial==='printed'?(cover.printedTextBlocks?.[0]?.text||''):(cover.decoText||'')}
                onChange={e=>{
                  if(cover.coverMaterial==='printed'){
                    setCover(prev=>({...prev,printedTextBlocks:[
                      {...(prev.printedTextBlocks?.[0]||{id:'t1',x:50,y:60,fontSize:24,fontFamily:'Playfair Display',bold:false,color:'#ffffff'}), text:e.target.value},
                      ...(prev.printedTextBlocks?.slice(1)||[])
                    ]}));
                  } else {
                    setCover(prev=>({...prev,decoText:e.target.value}));
                  }
                }}
                placeholder={t('guestbooknew.book')}
                style={{width:'100%',padding:'9px 11px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,boxSizing:'border-box',marginBottom:6}}/>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {['Книга побажань','Наше весілля','Guest Book','Mr & Mrs','З Днем Народження!'].map(s=>(
                  <button key={s} onClick={()=>{
                    if(cover.coverMaterial==='printed'){setCover(prev=>({...prev,printedTextBlocks:[{...(prev.printedTextBlocks?.[0]||{id:'t1',x:50,y:60,fontSize:24,fontFamily:'Playfair Display',bold:false,color:'#ffffff'}),text:s},...(prev.printedTextBlocks?.slice(1)||[])]}))}
                    else setCover(prev=>({...prev,decoText:s}));
                  }} style={{padding:'3px 9px',borderRadius:14,border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:11,cursor:'pointer',color:'#374151'}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Decoration */}
            <div>
              <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>{t('guestbooknew.decoration')}</h4>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
                {DECO_TYPES.map(d=>(
                  <button key={d.id} onClick={()=>setCover(prev=>({...prev,decoType:d.id as any}))}
                    style={{padding:'7px 4px',border:cover.decoType===d.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:7,background:cover.decoType===d.id?'#f0f3ff':'#fff',fontSize:10,fontWeight:600,color:cover.decoType===d.id?'#1e2d7d':'#374151',cursor:'pointer'}}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </>)}

          {/* STEP 1: Pages */}
          {step===1&&(<>
            <div>
              <h3 style={{fontSize:14,fontWeight:800,color:'#1e2d7d',margin:'0 0 4px'}}>{t('guestbooknew.pageTypes')}</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {INTERIOR_TYPES.map(t=>(
                  <button key={t.id} onClick={()=>setInteriorType(t.id)}
                    style={{padding:'12px 8px',border:interiorType===t.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:10,background:interiorType===t.id?'#f0f3ff':'#fff',cursor:'pointer',textAlign:'left'}}>
                    <div style={{fontSize:18,marginBottom:3}}>{t.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:interiorType===t.id?'#1e2d7d':'#374151'}}>{t.label}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {interiorType==='prompted'&&(
              <div>
                <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>Підказки для гостей</h4>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {prompts.map((p,i)=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:6}}>
                      <input type="checkbox" checked={p.enabled} onChange={()=>setPrompts(prev=>prev.map((pp,j)=>j===i?{...pp,enabled:!pp.enabled}:pp))} style={{accentColor:'#1e2d7d',width:13,height:13}}/>
                      <input type="text" value={p.text} onChange={e=>setPrompts(prev=>prev.map((pp,j)=>j===i?{...pp,text:e.target.value}:pp))}
                        style={{flex:1,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,fontSize:11,opacity:p.enabled?1:0.5}}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>{t('guestbooknew.pageColor')}</h4>
              <div style={{display:'flex',gap:8}}>
                {PAGE_COLORS.map(c=>(
                  <button key={c.id} onClick={()=>setPageColor(c.id)}
                    style={{flex:1,padding:'10px 4px',border:pageColor===c.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:9,background:pageColor===c.id?'#f0f3ff':'#fff',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                    <div style={{width:26,height:26,borderRadius:4,background:c.hex,border:'1px solid #e2e8f0'}}/>
                    <span style={{fontSize:11,fontWeight:700,color:pageColor===c.id?'#1e2d7d':'#374151'}}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 8px'}}>{t('guestbooknew.pageCount')}</h4>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {PAGE_COUNTS.map(n=>(
                  <button key={n} onClick={()=>setPageCount(n)}
                    style={{padding:'9px 4px',border:pageCount===n?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:8,background:pageCount===n?'#f0f3ff':'#fff',cursor:'pointer',textAlign:'center'}}>
                    <div style={{fontSize:16,fontWeight:800,color:pageCount===n?'#1e2d7d':'#374151'}}>{n}</div>
                    <div style={{fontSize:9,color:'#94a3b8'}}>стор.</div>
                  </button>
                ))}
              </div>
            </div>
          </>)}

          {/* STEP 2: Size + order */}
          {step===2&&(<>
            <div>
              <h3 style={{fontSize:14,fontWeight:800,color:'#1e2d7d',margin:'0 0 12px'}}>{t('guestbooknew.size')}</h3>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {SIZES.map(s=>(
                  <button key={s.id} onClick={()=>setSize(s.id)}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:size===s.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:10,background:size===s.id?'#f0f3ff':'#fff',cursor:'pointer'}}>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:14,fontWeight:700,color:size===s.id?'#1e2d7d':'#374151'}}>{s.label}</div>
                      <div style={{fontSize:10,color:'#94a3b8'}}>{s.id==='30x20'?t('guestbooknew.horizontal'):s.id==='23x23'?t('guestbooknew.square'):t('guestbooknew.vertical')}</div>
                    </div>
                    <span style={{fontSize:15,fontWeight:800,color:size===s.id?'#1e2d7d':'#374151'}}>{s.price} ₴</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{background:'#f0f3ff',borderRadius:12,padding:14}}>
              <div style={{fontSize:12,color:'#64748b',marginBottom:6}}>{t('guestbooknew.yourOrder')}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:13,color:'#374151'}}>{t('guestbooknew.book')} {sizeObj.label}</span>
                <span style={{fontSize:13,fontWeight:700,color:'#1e2d7d'}}>{sizeObj.price} ₴</span>
              </div>
              {cover.coverMaterial==='printed'&&(
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:12,color:'#64748b'}}>{t('guestbooknew.printedCover')}</span>
                  <span style={{fontSize:12,color:'#10b981',fontWeight:700}}>{t('guestbooknew.printedDiscount')}</span>
                </div>
              )}
              <div style={{borderTop:'1px solid #c7d2fe',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between'}}>
                <span style={{fontWeight:700}}>{t('guestbooknew.total')}</span>
                <span style={{fontSize:18,fontWeight:800,color:'#1e2d7d'}}>{totalPrice} ₴</span>
              </div>
            </div>

            {/* QR Code Generator */}
            <div style={{ marginBottom: 12 }}><QRCodeGenerator compact label={t('guestbooknew.addQRCode')} /></div>

            <button onClick={handleOrder}
              style={{width:'100%',padding:'13px',background:'#1e2d7d',color:'#fff',border:'none',borderRadius:10,fontWeight:800,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(30,45,125,0.3)'}}>
              <ShoppingCart size={17}/> {t('guestbooknew.order')} — {totalPrice} ₴
            </button>
          </>)}

          {/* Navigation */}
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'auto',paddingTop:10,borderTop:'1px solid #f1f5f9'}}>
            <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}
              style={{display:'flex',alignItems:'center',gap:4,padding:'8px 14px',border:'1px solid #e2e8f0',borderRadius:8,background:'#fff',cursor:step===0?'not-allowed':'pointer',color:step===0?'#cbd5e1':'#374151',fontWeight:600,fontSize:13}}>
              <ChevronLeft size={14}/> Назад
            </button>
            {step<2&&<button onClick={()=>setStep(s=>Math.min(2,s+1))}
              style={{display:'flex',alignItems:'center',gap:4,padding:'8px 16px',background:'#1e2d7d',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
              Далі <ChevronRight size={14}/>
            </button>}
          </div>
        </div>

        {/*  Right: Preview  */}
        <div style={{flex:1,background:'#f4f6fb',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',padding:'32px 24px',overflowY:'auto',gap:20}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            {step===0?t('guestbooknew.coverPreview'):step===1?t('guestbooknew.pagePreview'):t('guestbooknew.bookPreview')} — {sizeObj.label}
          </div>

          {step===0&&(
            <div style={{width:'100%',maxWidth:PW+20}}>
              <div style={{boxShadow:'0 8px 40px rgba(0,0,0,0.18)',borderRadius:10,overflow:'hidden'}}>
                <CoverPreview cover={cover} photos={photos} W={PW} H={PH}/>
              </div>
              <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:8}}>
                {MAT_LABELS[cover.coverMaterial as CoverMaterial]} · {cover.coverColorName||'Кольоровий'}
              </div>
            </div>
          )}

          {step===1&&(
            <div style={{width:'100%',maxWidth:PW+20}}>
              <div style={{boxShadow:'0 8px 40px rgba(0,0,0,0.15)',borderRadius:10,overflow:'hidden'}}>
                <PagePreview pageColor={pageColor} interiorType={interiorType} prompts={prompts} W={PW} H={PH}/>
              </div>
              <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:8}}>
                {INTERIOR_TYPES.find(t=>t.id===interiorType)?.label} · {PAGE_COLORS.find(c=>c.id===pageColor)?.label} · {pageCount} стор.
              </div>
            </div>
          )}

          {step===2&&(<>
            <div style={{width:'100%',maxWidth:PW+20}}>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:5,textAlign:'center'}}>{t('guestbooknew.coverPreview')}</div>
              <div style={{boxShadow:'0 6px 28px rgba(0,0,0,0.15)',borderRadius:8,overflow:'hidden'}}>
                <CoverPreview cover={cover} photos={photos} W={PW} H={PH}/>
              </div>
            </div>
            <div style={{width:'100%',maxWidth:PW+20}}>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:5,textAlign:'center'}}>Сторінки</div>
              <div style={{boxShadow:'0 4px 18px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                <PagePreview pageColor={pageColor} interiorType={interiorType} prompts={prompts} W={PW} H={Math.round(PH*0.6)}/>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
