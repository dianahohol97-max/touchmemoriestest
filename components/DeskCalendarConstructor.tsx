'use client';

import { CartSuccessModal } from '@/components/ui/CartSuccessModal';
import { useState, useRef, useEffect } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, ShoppingCart } from 'lucide-react';
import { GOOGLE_FONTS_URL } from '@/lib/editor/constants';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import { useT } from '@/lib/i18n/context';
import { uploadCustomerFile } from '@/lib/upload-customer-file';

const LOCALES = {
  uk: { months:['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'], days:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'] },
  en: { months:['January','February','March','April','May','June','July','August','September','October','November','December'], days:['Mo','Tu','We','Th','Fr','Sa','Su'] },
  de: { months:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'], days:['Mo','Di','Mi','Do','Fr','Sa','So'] },
  pl: { months:['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'], days:['Pn','Wt','Śr','Cz','Pt','So','Nd'] },
  ro: { months:['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'], days:['Lu','Ma','Mi','Jo','Vi','Sâ','Du'] },
};
type LangCode = keyof typeof LOCALES;

interface Design { id:string; name:string; bg:string; headerBg:string; headerText:string; dayNameColor:string; dayColor:string; sundayColor:string; saturdayColor:string; gridLine:string; font:string; accentFont:string; }

const DESIGNS: Design[] = [
  // Clean white — мінімалістичний, безтрендовий
  { id:'white',   name:'Білий',   bg:'#ffffff', headerBg:'#ffffff', headerText:'#0f172a', dayNameColor:'#94a3b8', dayColor:'#0f172a', sundayColor:'#e11d48', saturdayColor:'#2563eb', gridLine:'#f1f5f9', font:'Montserrat', accentFont:'Montserrat' },
  // Slate — темно-сірий акцент, сучасний
  { id:'minimal', name:'Сучасний', bg:'#f8fafc', headerBg:'#0f172a', headerText:'#f8fafc', dayNameColor:'#64748b', dayColor:'#0f172a', sundayColor:'#e11d48', saturdayColor:'#3b82f6', gridLine:'#e2e8f0', font:'Montserrat', accentFont:'Montserrat' },
  // Ivory — кремовий, теплий, елегантний
  { id:'warm',    name:'Елегантний', bg:'#fdfaf5', headerBg:'#fdfaf5', headerText:'#1c1008', dayNameColor:'#b8956a', dayColor:'#1c1008', sundayColor:'#c0392b', saturdayColor:'#6b7280', gridLine:'#ede8df', font:'Lora', accentFont:'Cormorant Garamond' },
];

type CollageId = 'single'|'two-h'|'two-v'|'three'|'four';
interface CollageLayout { id:CollageId; name:string; slots:number; preview:React.ReactNode; getSlots:(x:number,y:number,w:number,h:number)=>{x:number;y:number;w:number;h:number}[]; }

const COLLAGES: CollageLayout[] = [
  { id:'single', name:'1 фото', slots:1, preview:<div style={{width:'100%',height:'100%',background:'#c7d2fe',borderRadius:2}}/>, getSlots:(x,y,w,h)=>[{x,y,w,h}] },
  { id:'two-h',  name:'2 горизонт.', slots:2, preview:<div style={{display:'grid',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,hh=(h-g)/2;return [{x,y,w,h:hh},{x,y:y+hh+g,w,h:hh}];} },
  { id:'two-v',  name:'2 вертик.', slots:2, preview:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,ww=(w-g)/2;return [{x,y,w:ww,h},{x:x+ww+g,y,w:ww,h}];} },
  { id:'three',  name:'3 фото', slots:3, preview:<div style={{display:'grid',gridTemplateRows:'1.2fr 1fr',gap:2,width:'100%',height:'100%'}}><div style={{background:'#c7d2fe',borderRadius:2}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>{[0,1].map(i=><div key={i} style={{background:'#a5b4fc',borderRadius:2}}/>)}</div></div>, getSlots:(x,y,w,h)=>{const g=3,topH=Math.round((h-g)*0.55),botH=h-g-topH,ww=(w-g)/2;return [{x,y,w,h:topH},{x,y:y+topH+g,w:ww,h:botH},{x:x+ww+g,y:y+topH+g,w:ww,h:botH}];} },
  { id:'four',   name:'4 фото', slots:4, preview:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1,2,3].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,ww=(w-g)/2,hh=(h-g)/2;return [{x,y,w:ww,h:hh},{x:x+ww+g,y,w:ww,h:hh},{x,y:y+hh+g,w:ww,h:hh},{x:x+ww+g,y:y+hh+g,w:ww,h:hh}];} },
];

interface MarkedDate { day:number; shape:'circle'|'heart'; color:string; }

//  Cover config 
interface CoverConfig {
  bgColor: string;
  bgPhoto: string|null;
  photoOpacity: number;
  collageId: CollageId;
  photos: (string|null)[];
  titleText: string;
  titleFont: string;
  titleColor: string;
  titleSize: number;
  subtitleText: string;
  subtitleColor: string;
}
const DEFAULT_COVER: CoverConfig = {
  bgColor:'#1e2d7d', bgPhoto:null, photoOpacity:0.5,
  collageId:'single', photos:Array(8).fill(null),
  titleText:'', titleFont:'Playfair Display', titleColor:'#ffffff', titleSize:28,
  subtitleText:'', subtitleColor:'rgba(255,255,255,0.7)',
};

function drawCoverPage(canvas:HTMLCanvasElement,cover:CoverConfig,year:number,W:number,H:number){
  const ctx=canvas.getContext('2d')!; canvas.width=W; canvas.height=H;
  // BG color
  ctx.fillStyle=cover.bgColor; ctx.fillRect(0,0,W,H);
  const pad=Math.round(W*0.06);

  // BG photo full bleed
  const drawBgAndRest=()=>{
    // Photo collage area (top ~60% of cover)
    const photoH=Math.round(H*0.58);
    const collage=COLLAGES.find(c=>c.id===cover.collageId)||COLLAGES[0];
    const slots=collage.getSlots(pad,pad,W-2*pad,photoH-pad);
    slots.forEach((sl,i)=>drawSlot(ctx,sl,cover.photos[i]?{url:cover.photos[i]!,zoom:1,cropX:50,cropY:50}:null));

    // Text area (bottom ~35%)
    const textY=photoH+Math.round(pad*0.3);
    const s=W/280;
    // Decorative line
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(W*0.2,textY); ctx.lineTo(W*0.8,textY); ctx.stroke();
    // Big year watermark
    ctx.fillStyle=cover.titleColor; ctx.globalAlpha=0.07;
    ctx.font=`900 ${Math.round(70*s)}px '${cover.titleFont}',sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(year),W/2,H*0.78);
    ctx.globalAlpha=1;
    // Title
    if(cover.titleText){
      ctx.fillStyle=cover.titleColor;
      ctx.font=`700 ${Math.round(cover.titleSize*s*0.9)}px '${cover.titleFont}',sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(cover.titleText,W/2,H*0.70);
    } else {
      ctx.fillStyle=cover.titleColor;
      ctx.font=`700 ${Math.round(22*s)}px '${cover.titleFont}',sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(year),W/2,H*0.70);
    }
    // Subtitle
    if(cover.subtitleText){
      ctx.fillStyle=cover.subtitleColor;
      ctx.font=`400 ${Math.round(11*s)}px '${cover.titleFont}',sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(cover.subtitleText,W/2,H*0.80);
    }
  };

  if(cover.bgPhoto){
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>{
      ctx.save();
      ctx.globalAlpha=cover.photoOpacity;
      const ia=img.width/img.height,sa=W/H;
      let dw,dh,dx,dy;
      if(ia>sa){dh=H;dw=dh*ia;dx=-(dw-W)/2;dy=0;}
      else{dw=W;dh=dw/ia;dx=0;dy=-(dh-H)/2;}
      ctx.drawImage(img,dx,dy,dw,dh);
      ctx.globalAlpha=1; ctx.restore();
      drawBgAndRest();
    };
    img.src=cover.bgPhoto;
  } else { drawBgAndRest(); }
}

function CoverCanvas({cover,year,W,H}:{cover:CoverConfig;year:number;W:number;H:number}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=ref.current;if(!c)return;drawCoverPage(c,cover,year,W,H);},[cover,year,W,H]);
  return <canvas ref={ref} width={W} height={H} style={{width:'100%',height:'auto',display:'block',borderRadius:6}}/>;
}

function getMonthDays(year:number,month:number){const fd=new Date(year,month-1,1).getDay();return {startOffset:fd===0?6:fd-1,daysInMonth:new Date(year,month,0).getDate()};}

function rr(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);}

function drawHeart(ctx:CanvasRenderingContext2D,cx:number,cy:number,r:number){ctx.save();ctx.translate(cx,cy-r*0.1);const s=r/8;ctx.beginPath();for(let i=0;i<=100;i++){const t=(i/100)*Math.PI*2;const x=s*16*Math.pow(Math.sin(t),3);const y=-s*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.restore();}

interface DrawSlotOpts { url:string|null; zoom?:number; cropX?:number; cropY?:number; }
function drawSlot(ctx:CanvasRenderingContext2D,sl:{x:number;y:number;w:number;h:number},p:DrawSlotOpts|null){
  const photo=p?.url||null;
  if(!photo){ctx.save();ctx.fillStyle='rgba(200,210,255,0.18)';rr(ctx,sl.x,sl.y,sl.w,sl.h,4);ctx.fill();ctx.strokeStyle='rgba(100,130,220,0.25)';ctx.setLineDash([5,4]);ctx.lineWidth=0.8;rr(ctx,sl.x,sl.y,sl.w,sl.h,4);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(100,130,220,0.3)';ctx.font=`${Math.round(sl.h*0.25)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('',sl.x+sl.w/2,sl.y+sl.h/2);ctx.restore();return;}
  const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{
    ctx.save();rr(ctx,sl.x,sl.y,sl.w,sl.h,4);ctx.clip();
    const zoom=p?.zoom||1;const cx=(p?.cropX??50)/100;const cy=(p?.cropY??50)/100;
    const ia=img.width/img.height,sa=sl.w/sl.h;
    let dw,dh;if(ia>sa){dh=sl.h*zoom;dw=dh*ia;}else{dw=sl.w*zoom;dh=dw/ia;}
    const dx=sl.x+(sl.w-dw)*cx;const dy=sl.y+(sl.h-dh)*cy;
    ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();};img.src=photo;
}

function drawPage(canvas:HTMLCanvasElement,month:number,year:number,design:Design,lang:LangCode,photos:{url:string|null;zoom:number;cropX:number;cropY:number}[],collageId:CollageId,W:number,H:number,marks:MarkedDate[]){
  const ctx=canvas.getContext('2d')!;canvas.width=W;canvas.height=H;
  const loc=LOCALES[lang];
  ctx.fillStyle=design.bg;ctx.fillRect(0,0,W,H);
  const pad=Math.round(W*0.055),s=W/280;
  const headerH=Math.round(H*0.085);
  const noHeaderBar = design.id==='white'||design.id==='warm'||design.id==='blush';
  if(!noHeaderBar){ctx.fillStyle=design.headerBg;rr(ctx,pad,pad,W-2*pad,headerH,5);ctx.fill();}
  else{
    // For designs with bg=header: just a thin bottom border
    const lineCol = design.id==='ink'?'#2d3748':'#e8e0d8';
    ctx.strokeStyle=lineCol;ctx.lineWidth=0.7;
    ctx.beginPath();ctx.moveTo(pad,pad+headerH);ctx.lineTo(W-pad,pad+headerH);ctx.stroke();
  }
  ctx.fillStyle=design.headerText;
  ctx.font=`800 ${Math.round(headerH*0.44)}px '${design.accentFont}',sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(loc.months[month-1].toUpperCase(),W/2,pad+headerH/2);
  ctx.font=`400 ${Math.round(headerH*0.27)}px '${design.font}',sans-serif`;
  ctx.globalAlpha=0.5;ctx.fillText(String(year),W/2,pad+headerH*0.83);ctx.globalAlpha=1;
  const photoTop=pad+headerH+Math.round(pad*0.4);
  const photoH=Math.round(H*0.37);
  const collage=COLLAGES.find(c=>c.id===collageId)||COLLAGES[0];
  collage.getSlots(pad,photoTop,W-2*pad,photoH).forEach((sl,i)=>drawSlot(ctx,sl,photos[i]||null));
  const calTop=photoTop+photoH+Math.round(pad*0.4);
  const calH=H-calTop-pad;
  const dnH=Math.round(19*s),cellH=Math.round((calH-dnH)/6),cellW=(W-2*pad)/7;
  loc.days.forEach((d,i)=>{ctx.fillStyle=i>=5?design.sundayColor:design.dayNameColor;ctx.font=`600 ${Math.round(9*s)}px '${design.font}',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d,pad+i*cellW+cellW/2,calTop+dnH/2);});
  ctx.strokeStyle=design.gridLine;ctx.lineWidth=0.7;
  for(let r=0;r<=6;r++){ctx.beginPath();ctx.moveTo(pad,calTop+dnH+r*cellH);ctx.lineTo(W-pad,calTop+dnH+r*cellH);ctx.stroke();}
  const {startOffset,daysInMonth}=getMonthDays(year,month);
  for(let day=1;day<=daysInMonth;day++){
    const pos=startOffset+day-1,col=pos%7,row=Math.floor(pos/7);
    const x=pad+col*cellW+cellW/2,y=calTop+dnH+row*cellH+cellH/2,r=Math.round(cellH*0.33);
    const isSun=col===6,isSat=col===5;
    const mark=marks.find(m=>m.day===day);
    if(mark){ctx.fillStyle=mark.color;if(mark.shape==='circle'){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}else{drawHeart(ctx,x,y,r*1.1);ctx.fill();}}
    ctx.fillStyle=mark?'#ffffff':isSun?design.sundayColor:isSat?design.saturdayColor:design.dayColor;
    ctx.font=`${mark?700:400} ${Math.round(11*s)}px '${design.font}',sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(day),x,y);
  }
}

function MonthCanvas({month,year,design,lang,photos,collageId,W,H,marks}:{month:number;year:number;design:Design;lang:LangCode;photos:{url:string|null;zoom:number;cropX:number;cropY:number}[];collageId:CollageId;W:number;H:number;marks?:MarkedDate[]}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=ref.current;if(!c)return;drawPage(c,month,year,design,lang,photos,collageId,W,H,marks||[]);},[month,year,design,lang,photos,collageId,W,H,marks]);
  return <canvas ref={ref} width={W} height={H} style={{width:'100%',height:'auto',display:'block',borderRadius:6}}/>;
}

export default function DeskCalendarConstructor(){
    const t = useT();
  const router=useRouter();const {addItem}=useCartStore();
  const searchParams=useSearchParams();
  const [showCartModal, setShowCartModal] = useState(false);
  const [design,setDesign]=useState<Design>(DESIGNS[0]);
  const [lang,setLang]=useState<LangCode>('uk');
  const [year,setYear]=useState(2026);
  const [active,setActive]=useState(1);
  // Per-month collage layout — each month can have its own photo slot layout
  const [monthCollageIds,setMonthCollageIds]=useState<CollageId[]>(Array(12).fill('single'));
  const setMonthCollageId=(m:number,id:CollageId)=>setMonthCollageIds(prev=>prev.map((v,i)=>i===m?id:v));
  // URL params from product page
  const standParam=searchParams.get('Комплектація')||searchParams.get('stand')||'with_stand';
  const hasStand=standParam!=='no_stand';
  const obvedParam=parseInt(searchParams.get('Обведення дат')||searchParams.get('obvedennya')||'0',10);
  const paidMarkedDates=obvedParam>0;
  interface PhotoSlot { url:string|null; zoom:number; cropX:number; cropY:number; }
  const makeSlot=():PhotoSlot=>({url:null,zoom:1,cropX:50,cropY:50});
  const [monthPhotos,setMonthPhotos]=useState<PhotoSlot[][]>(Array.from({length:12},()=>Array(8).fill(null).map(makeSlot)));
  const [activeCropSlot,setActiveCropSlot]=useState<{month:number;slot:number}|null>(null);
  const [cover,setCover]=useState<CoverConfig>({...DEFAULT_COVER});
  const [showCover,setShowCover]=useState(false);
  const [marks,setMarks]=useState<Record<string,MarkedDate[]>>({});
  const [markShape,setMarkShape]=useState<'circle'|'heart'>('circle');
  const [markColor,setMarkColor]=useState('#1e2d7d');
  // Shared photo library — upload once, drag to any month slot
  const [libPhotos,setLibPhotos]=useState<{id:string;url:string}[]>([]);
  const libFileRef=useRef<HTMLInputElement>(null);
  const addToLib=(files:FileList|null)=>{if(!files)return;Array.from(files).forEach(f=>{if(!f.type.startsWith('image/'))return;const url=URL.createObjectURL(f);setLibPhotos(prev=>[...prev,{id:`lib_${Date.now()}_${Math.random()}`,url}]);});};
  const removeFromLib=(id:string)=>setLibPhotos(prev=>prev.filter(p=>p.id!==id));
  const fileRef=useRef<HTMLInputElement>(null);
  const upTarget=useRef<{m:number;s:number;isCover?:boolean}>({m:0,s:0});
  const coverFileRef=useRef<HTMLInputElement>(null);
  const coverBgFileRef=useRef<HTMLInputElement>(null);
  const PW=260,PH=Math.round(260*(21/15));
  useEffect(()=>{const l=document.createElement('link');l.rel='stylesheet';l.href=GOOGLE_FONTS_URL;document.head.appendChild(l);return()=>{try{document.head.removeChild(l);}catch{}};},[]);
  const setMonthSlotFile=(m:number,s:number,f:File)=>{if(!f||!f.type.startsWith('image/'))return;const url=URL.createObjectURL(f);setMonthPhotos(prev=>{const n=prev.map(x=>x.map(p=>({...p})));n[m][s]={url,zoom:1,cropX:50,cropY:50};return n;});};
  const handleUpload=(e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;const{m,s}=upTarget.current;setMonthSlotFile(m,s,f);if(fileRef.current)fileRef.current.value='';};
  const updateSlot=(m:number,s:number,patch:Partial<PhotoSlot>)=>setMonthPhotos(prev=>{const n=prev.map(x=>x.map(p=>({...p})));n[m][s]={...n[m][s],...patch};return n;});
  const openUp=(m:number,s:number)=>{upTarget.current={m,s};fileRef.current?.click();};
  const handleCoverPhotoUpload=(e:React.ChangeEvent<HTMLInputElement>,slot:number)=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);setCover((prev:CoverConfig)=>({...prev,photos:(prev.photos as (string|null)[]).map((p,i)=>i===slot?url:p)}));if(e.target)e.target.value='';};
  const handleCoverBgUpload=(e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;setCover(prev=>({...prev,bgPhoto:URL.createObjectURL(f)}));if(e.target)e.target.value='';};
  const removeP=(m:number,s:number)=>setMonthPhotos(prev=>{const n=prev.map(x=>x.map(p=>({...p})));n[m][s]=makeSlot();return n;});
  const toggleMark=(day:number)=>{const key=`m${active}`;setMarks(prev=>{const ex=prev[key]||[];const idx=ex.findIndex(m=>m.day===day);if(idx>=0){const same=ex[idx].shape===markShape&&ex[idx].color===markColor;if(same)return{...prev,[key]:ex.filter((_,i)=>i!==idx)};return{...prev,[key]:ex.map((m,i)=>i===idx?{...m,shape:markShape,color:markColor}:m)};}return{...prev,[key]:[...ex,{day,shape:markShape,color:markColor}]};});};
  const loc=LOCALES[lang];
  // Per-month collage (active month index = active-1)
  const curCollageId=monthCollageIds[active-1]||'single';
  const collage=COLLAGES.find(c=>c.id===curCollageId)||COLLAGES[0];
  const curPhotos=monthPhotos[active-1];
  const curMarks=marks[`m${active}`]||[];
  // Dynamic price: computed after marks state is available
  const totalMarkedDates=Object.values(marks as Record<string,MarkedDate[]>).reduce((sum,arr:MarkedDate[])=>sum+arr.length,0);
  const dynamicPrice=319+(hasStand?0:-50)+(paidMarkedDates?Math.min(totalMarkedDates,obvedParam)*10:0);

  const handleOrder = async () => {
    const cartItemId = `desk-cal-${Date.now()}`;
    const cartPayload = {
      id: cartItemId,
      name:`Настільний календар ${year}`,
      price:dynamicPrice, qty:1,
      image:monthPhotos.flat().find(p=>p.url!==null)?.url||'',
      options:{ 'Дизайн':design.name, 'Мова':lang, 'Рік':String(year) },
      personalization_note:`Дизайн: ${design.name}, Мова: ${lang}, Рік: ${year}`,
    };
    addItem(cartPayload);

    // Upload originals to Storage. The slot state only keeps blob URLs, so
    // for each filled slot we fetch the blob and persist it. Without this
    // step the manager only sees previews and has no source to print from.
    // Durable storage descriptors of the uploaded photos — declared out here
    // because the projects insert below also references them (saved designs
    // must point at storage paths, not dead blob: URLs).
    const exportedFiles: any[] = [];

    try {
      const { createBrowserClient } = await import('@supabase/auth-helpers-nextjs');
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await sb.auth.getUser();
      const userKey = user?.id || 'anon';
      exportedFiles.length = 0;
      let pageIdx = 0;
      for (let m = 0; m < monthPhotos.length; m++) {
        for (let s = 0; s < monthPhotos[m].length; s++) {
          const url = monthPhotos[m][s]?.url;
          if (!url) continue;
          pageIdx++;
          try {
            const blob = await (await fetch(url)).blob();
            const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '');
            const path = `${userKey}/${cartItemId}/m${String(m + 1).padStart(2, '0')}-s${s + 1}.${ext === 'jpg' ? 'jpeg' : ext}`;
            const { error: uploadError } = await uploadCustomerFile(path, blob, { contentType: blob.type || 'image/jpeg' });
            if (uploadError) { console.warn('desk-cal upload failed:', uploadError); continue; }
            exportedFiles.push({
              path, fileName: `month_${m + 1}_slot_${s + 1}.${ext === 'jpg' ? 'jpeg' : ext}`,
              bucket: 'order-files', fileCategory: 'photo-upload',
              productType: 'desk-calendar', fileType: 'upload',
              size: blob.size, mimeType: blob.type || 'image/jpeg',
              pageNumber: pageIdx,
            });
          } catch (e) {
            console.warn('desk-cal blob fetch failed:', e);
          }
        }
      }
      if (exportedFiles.length > 0) {
        sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify(exportedFiles));
      }
    } catch (e) {
      console.warn('desk-cal storage step skipped:', e);
    }

    // Persist as a project so the calendar appears in "Мої дизайни" (it only
    // went to the cart before). cart_payload lets the account "Замовити"
    // button replay the exact priced payload. Non-blocking, logged-in only.
    try {
      const { createBrowserClient } = await import('@supabase/auth-helpers-nextjs');
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        await sb.from('projects').insert({
          user_id: user.id,
          product_type: 'desk-calendar',
          format: String(year),
          status: 'draft',
          name: `Настільний календар ${year}`,
          pages_data: [{ year, lang, designName: design.name, monthCollageIds, monthPhotos, marks }],
          cart_payload: cartPayload,
          // Durable storage paths, not blob: previews (blob dies with the tab).
          uploaded_photos: exportedFiles.length > 0
            ? exportedFiles.map((f: any) => ({ path: f.path, bucket: f.bucket }))
            : [],
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Saving desk-calendar project failed (non-blocking):', e);
    }

    toast.success(t('deskcal.order_success'));
    setShowCartModal(true);
  };
  const LANGS=[{code:'uk'as LangCode,flag:'',label:'Укр'},{code:'en'as LangCode,flag:'',label:'Eng'},{code:'de'as LangCode,flag:'',label:'Deu'},{code:'pl'as LangCode,flag:'',label:'Pol'},{code:'ro'as LangCode,flag:'',label:'Rom'}];
  return(
    <>
    <div style={{display:'flex',minHeight:'80vh',fontFamily:'var(--font-primary,sans-serif)'}}>
      {/* LEFT */}
      <div style={{width:310,flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'14px 14px 12px',borderBottom:'1px solid #f1f5f9'}}>
          <h2 style={{fontSize:15,fontWeight:800,color:'#1e2d7d',margin:0}}>{t('deskcal.title')}</h2>
          <p style={{fontSize:10,color:'#94a3b8',margin:'3px 0 0'}}>{t('deskcal.subtitle')}</p>
        </div>
        <div style={{flex:1,padding:13,display:'flex',flexDirection:'column',gap:14}}>

          {/* Design */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>{t('deskcal.design_label')}</label>
            {DESIGNS.map(d=>(
              <button key={d.id} onClick={()=>setDesign(d)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',width:'100%',border:design.id===d.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:8,background:design.id===d.id?'#f0f3ff':'#fff',cursor:'pointer',marginBottom:4}}>
                <div style={{width:34,height:24,borderRadius:3,overflow:'hidden',flexShrink:0,border:'1px solid #e2e8f0'}}>
                  <div style={{height:'34%',background:d.headerBg}}/>
                  <div style={{flex:1,background:d.bg,display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:1,padding:'1px 2px'}}>
                    {Array.from({length:14}).map((_,i)=><div key={i} style={{height:3,borderRadius:1,background:i<7?d.dayNameColor:d.dayColor,opacity:i<7?0.4:0.6}}/>)}
                  </div>
                </div>
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:12,fontWeight:700,color:design.id===d.id?'#1e2d7d':'#374151'}}>{d.name}</div>
                  <div style={{fontSize:9,color:'#94a3b8',fontFamily:d.font}}>{d.font}</div>
                </div>
                {design.id===d.id&&<span style={{marginLeft:'auto',color:'#1e2d7d',fontSize:14}}></span>}
              </button>
            ))}
          </div>

          {/* Collage */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>{t('deskcal.collage_label')}</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,gridTemplateRows:'auto auto'}}>
              {COLLAGES.map(c=>(
                <button key={c.id} onClick={()=>setMonthCollageId(active-1,c.id as CollageId)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 3px',border:curCollageId===c.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:6,background:curCollageId===c.id?'#f0f3ff':'#fff',cursor:'pointer'}}>
                  <div style={{width:'100%',height:28,padding:2}}>{c.preview}</div>
                  <span style={{fontSize:7,fontWeight:700,color:curCollageId===c.id?'#1e2d7d':'#374151',textAlign:'center',lineHeight:1.2}}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>{t('deskcal.language_label')}</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {LANGS.map(l=><button key={l.code} onClick={()=>setLang(l.code)} style={{padding:'4px 7px',borderRadius:14,border:lang===l.code?'2px solid #1e2d7d':'1px solid #e2e8f0',background:lang===l.code?'#1e2d7d':'#fff',color:lang===l.code?'#fff':'#374151',fontSize:10,fontWeight:700,cursor:'pointer'}}>{l.flag} {l.label}</button>)}
            </div>
          </div>

          {/* Year */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>{t('deskcal.year_label')}</label>
            <div style={{display:'flex',gap:4}}>
              {[2025,2026,2027].map(y=><button key={y} onClick={()=>setYear(y)} style={{flex:1,padding:'6px',border:year===y?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:7,background:year===y?'#f0f3ff':'#fff',color:year===y?'#1e2d7d':'#374151',fontWeight:700,fontSize:12,cursor:'pointer'}}>{y}</button>)}
            </div>
          </div>

          {/* Photo Library */}
          <div style={{borderRadius:8,border:'1px solid #e2e8f0',background:'#f8faff',padding:'8px 10px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:800,color:'#1e2d7d'}}>Бібліотека фото</span>
              <button onClick={()=>libFileRef.current?.click()} style={{padding:'3px 8px',border:'1px solid #c7d2fe',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:9,fontWeight:700,color:'#1e2d7d'}}>+ Додати</button>
            </div>
            <input ref={libFileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>addToLib(e.target.files)}/>
            {libPhotos.length===0 ? (
              <p style={{fontSize:9,color:'#94a3b8',margin:0,textAlign:'center',padding:'6px 0'}}>Завантажте фото — потім тягніть на місяці</p>
            ) : (
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {libPhotos.map(p=>(
                  <div key={p.id} draggable
                    onDragStart={e=>e.dataTransfer.setData('desk-photo-id',p.id)}
                    style={{position:'relative',width:46,height:46,borderRadius:5,overflow:'hidden',border:'1.5px solid #c7d2fe',cursor:'grab',flexShrink:0}}>
                    <img src={p.url} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false}/>
                    <button onClick={e=>{e.stopPropagation();removeFromLib(p.id);}}
                      style={{position:'absolute',top:1,right:1,width:13,height:13,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*  MONTH EDITOR  */}
          <>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Фото — {loc.months[active-1]}</label>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload}/>
            <div style={{display:'grid',gridTemplateColumns:`repeat(${collage.slots},1fr)`,gap:5}}>
              {Array.from({length:collage.slots},(_,si)=>{
                const slotData=curPhotos[si];
                const ph=slotData?.url||null;
                const isCropActive=activeCropSlot?.month===active-1&&activeCropSlot?.slot===si;
                return ph?(
                  <div key={si}>
                    <div style={{position:'relative',marginBottom:isCropActive?4:0}}>
                      <img src={ph} style={{width:'100%',height:52,objectFit:'cover',borderRadius:6,border:isCropActive?'2px solid #3b82f6':'1.5px solid #c7d2fe'}}/>
                      <button onClick={()=>setActiveCropSlot(isCropActive?null:{month:active-1,slot:si})}
                        style={{position:'absolute',bottom:3,left:3,padding:'1px 5px',borderRadius:4,background:isCropActive?'#3b82f6':'rgba(0,0,0,0.6)',color:'#fff',border:'none',cursor:'pointer',fontSize:8,fontWeight:700}}>
                         {isCropActive?'Готово':'Кадр'}
                      </button>
                      <button onClick={()=>removeP(active-1,si)} style={{position:'absolute',top:2,right:2,width:15,height:15,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                    </div>
                    {isCropActive&&(
                      <div style={{background:'#f0f9ff',borderRadius:7,padding:'6px 8px',border:'1px solid #bae6fd',marginBottom:4}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                          <span style={{fontSize:9,color:'#0369a1',width:28}}>{t('deskcal.zoom_label')}</span>
                          <input type="range" min={100} max={300} value={Math.round((slotData.zoom)*100)}
                            onChange={e=>updateSlot(active-1,si,{zoom:+e.target.value/100})}
                            style={{flex:1,accentColor:'#3b82f6'}}/>
                          <span style={{fontSize:9,color:'#475569',width:24}}>{Math.round(slotData.zoom*100)}%</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                          <span style={{fontSize:9,color:'#0369a1',width:28}}>{t('deskcal.x_label')}</span>
                          <input type="range" min={0} max={100} value={slotData.cropX}
                            onChange={e=>updateSlot(active-1,si,{cropX:+e.target.value})}
                            style={{flex:1,accentColor:'#3b82f6'}}/>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:9,color:'#0369a1',width:28}}>{t('deskcal.y_label')}</span>
                          <input type="range" min={0} max={100} value={slotData.cropY}
                            onChange={e=>updateSlot(active-1,si,{cropY:+e.target.value})}
                            style={{flex:1,accentColor:'#3b82f6'}}/>
                        </div>
                        <button onClick={()=>updateSlot(active-1,si,{zoom:1,cropX:50,cropY:50})}
                          style={{marginTop:4,fontSize:8,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>
                          ↺ Скинути
                        </button>
                      </div>
                    )}
                  </div>
                ):(
                  <button key={si} onClick={()=>openUp(active-1,si)} onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{e.preventDefault();
                    const photoId=e.dataTransfer.getData('desk-photo-id');
                    if(photoId){const lp=libPhotos.find(p=>p.id===photoId);if(lp){setMonthPhotos(prev=>{const n=prev.map(x=>x.map(p=>({...p})));n[active-1][si]={url:lp.url,zoom:1,cropX:50,cropY:50};return n;});return;}}
                    const f=e.dataTransfer.files?.[0];if(f)setMonthSlotFile(active-1,si,f);
                  }} style={{height:52,border:'2px dashed #c7d2fe',borderRadius:6,background:'#f8faff',color:'#1e2d7d',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                    <Upload size={11}/><span style={{fontSize:8,fontWeight:700}}>{collage.slots>1?`Фото ${si+1}`:t('constructor.photo')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Marked dates */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Виділені дні — {loc.months[active-1]}</label>
            <div style={{display:'flex',gap:4,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
              <button onClick={()=>setMarkShape('circle')} style={{padding:'3px 7px',border:markShape==='circle'?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:12,background:markShape==='circle'?'#f0f3ff':'#fff',color:markShape==='circle'?'#1e2d7d':'#374151',fontSize:10,fontWeight:700,cursor:'pointer'}}> Коло</button>
              <button onClick={()=>setMarkShape('heart')} style={{padding:'3px 7px',border:markShape==='heart'?'2px solid #e11d48':'1px solid #e2e8f0',borderRadius:12,background:markShape==='heart'?'#fff1f2':'#fff',color:markShape==='heart'?'#e11d48':'#374151',fontSize:10,fontWeight:700,cursor:'pointer'}}>{t('deskcal.heart_mark')}</button>
              {['#1e2d7d','#e11d48','#16a34a','#c8a96e','#7c3aed','#ea580c','#000'].map(c=><button key={c} onClick={()=>setMarkColor(c)} style={{width:18,height:18,borderRadius:'50%',background:c,border:markColor===c?'3px solid #1e2d7d':'2px solid #fff',cursor:'pointer',boxShadow:'0 0 0 1px #e2e8f0',flexShrink:0}}/>)}
              <input type="color" value={markColor} onChange={e=>setMarkColor(e.target.value)} style={{width:22,height:22,border:'1px solid #e2e8f0',borderRadius:5,cursor:'pointer',padding:1}}/>
            </div>
            {(()=>{
              const {startOffset,daysInMonth}=getMonthDays(year,active);
              const cells:React.ReactNode[]=[];
              for(let i=0;i<startOffset;i++)cells.push(<div key={`e${i}`}/>);
              for(let d=1;d<=daysInMonth;d++){const mark=curMarks.find(m=>m.day===d);cells.push(<button key={d} onClick={()=>{if(!paidMarkedDates){toast.error('Обведення дат не включено у замовлення. Оберіть цю опцію на сторінці товару.');return;}toggleMark(d);}} style={{aspectRatio:'1',borderRadius:mark?.shape==='heart'?3:'50%',border:mark?'none':'1px solid #e2e8f0',background:mark?mark.color:'#fff',color:mark?'#fff':'#374151',fontSize:8,fontWeight:mark?700:400,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>{mark?.shape==='heart'&&<span style={{fontSize:10,lineHeight:1,position:'absolute'}}></span>}<span style={{position:mark?.shape==='heart'?'absolute':'static',fontSize:7,fontWeight:700}}>{d}</span></button>);}
              {/* 7 columns — a week has 7 days; repeat(6,1fr) misaligned every header/date */}
              return(<div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:2}}>{loc.days.map(d=><div key={d} style={{fontSize:7,fontWeight:700,color:'#94a3b8',textAlign:'center'}}>{d}</div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>{cells}</div></div>);
            })()}
            {curMarks.length>0&&<button onClick={()=>setMarks(prev=>({...prev,[`m${active}`]:[]}))} style={{marginTop:5,fontSize:9,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>{t('deskcal.clear_marks')}</button>}
          </div>
          </>

          {/* Month nav */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>{t('deskcal.pages_label')}</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3}}>
              {Array.from({length:12},(_,i)=>{const m=i+1;const hp=monthPhotos[i].some(p=>p!==null);return(<button key={m} onClick={()=>{setActive(m);}} style={{padding:'5px 2px',border:active===m?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:5,background:active===m?'#f0f3ff':'#fff',fontSize:9,fontWeight:600,color:active===m?'#1e2d7d':'#374151',cursor:'pointer',position:'relative'}}>{loc.months[i].slice(0,3)}{hp&&<span style={{position:'absolute',top:1,right:1,width:4,height:4,borderRadius:'50%',background:'#10b981'}}/>}</button>);})}
            </div>
          </div>

        </div>

        <div style={{padding:13,borderTop:'1px solid #f1f5f9'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
            <span style={{fontSize:12,color:'#64748b'}}>{t('deskcal.price_label')}</span>
            <span style={{fontSize:16,fontWeight:800,color:'#1e2d7d'}}>{dynamicPrice} ₴</span>
          </div>
          {/* QR Code Generator */}
          <div style={{ marginBottom: 12 }}><QRCodeGenerator compact label="QR-код до замовлення" /></div>

          <button onClick={handleOrder} style={{width:'100%',padding:'11px',background:'#1e2d7d',color:'#fff',border:'none',borderRadius:8,fontWeight:800,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxShadow:'0 4px 12px rgba(30,45,125,0.28)'}}>
            <ShoppingCart size={14}/> Замовити — {dynamicPrice} ₴
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{flex:1,background:'#f4f6fb',display:'flex',flexDirection:'column',alignItems:'center',padding:'22px 18px',gap:14,overflowY:'auto'}}>
        <div style={{width:'100%',maxWidth:PW+20}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.1em',textTransform:'uppercase',textAlign:'center',marginBottom:8}}>
            {loc.months[active-1]+' '+year}
          </div>
          <div style={{boxShadow:'0 6px 28px rgba(0,0,0,0.13)',borderRadius:8,overflow:'hidden'}}>
            <MonthCanvas month={active} year={year} design={design} lang={lang} photos={curPhotos} collageId={curCollageId} W={PW} H={PH} marks={curMarks}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
            <button onClick={()=>setActive(m=>Math.max(1,m-1))} disabled={active===1} style={{padding:'5px 12px',border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:active===1?'not-allowed':'pointer',color:active===1?'#cbd5e1':'#374151',fontWeight:700,fontSize:12}}>‹</button>
            <span style={{fontSize:11,color:'#94a3b8',alignSelf:'center'}}>{active}/12</span>
            <button onClick={()=>setActive(m=>Math.min(12,m+1))} disabled={active===12} style={{padding:'5px 12px',border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:active===12?'not-allowed':'pointer',color:active===12?'#cbd5e1':'#374151',fontWeight:700,fontSize:12}}>›</button>
          </div>
        </div>

        <div style={{width:'100%',maxWidth:660}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>{t('deskcal.all_pages_label')}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:5}}>
            {Array.from({length:12},(_,i)=>(
              <div key={i} onClick={()=>setActive(i+1)} style={{cursor:'pointer',borderRadius:5,overflow:'hidden',border:active===i+1?'2px solid #1e2d7d':'1px solid #e2e8f0',boxSizing:'border-box'}}>
                <MonthCanvas month={i+1} year={year} design={design} lang={lang} photos={monthPhotos[i]} collageId={monthCollageIds[i]||'single'} W={100} H={Math.round(100*(21/15))} marks={marks[`m${i+1}`]||[]}/>
                <div style={{fontSize:7,textAlign:'center',padding:'2px 0',background:'#fff',color:'#64748b',fontWeight:600}}>{loc.months[i].slice(0,3)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    {showCartModal && <CartSuccessModal onClose={() => setShowCartModal(false)} />}
    </>
  );
}
