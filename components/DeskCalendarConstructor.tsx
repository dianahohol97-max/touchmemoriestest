'use client';

import { useState, useRef, useEffect } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, ShoppingCart } from 'lucide-react';
import { GOOGLE_FONTS_URL } from '@/lib/editor/constants';

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
  { id:'white',   name:'Білий',   bg:'#ffffff', headerBg:'#ffffff', headerText:'#1a1a2e', dayNameColor:'#94a3b8', dayColor:'#1a1a2e', sundayColor:'#ef4444', saturdayColor:'#3b82f6', gridLine:'#f1f5f9', font:'Montserrat', accentFont:'Montserrat' },
  { id:'minimal', name:'Мінімал', bg:'#f8fafc', headerBg:'#1e2d7d', headerText:'#ffffff', dayNameColor:'#94a3b8', dayColor:'#1a1a2e', sundayColor:'#ef4444', saturdayColor:'#3b82f6', gridLine:'#e2e8f0', font:'Montserrat', accentFont:'Montserrat' },
  { id:'warm',    name:'Теплий',  bg:'#faf7f2', headerBg:'#c8a96e', headerText:'#ffffff', dayNameColor:'#a0845c', dayColor:'#3d2c1e', sundayColor:'#c0392b', saturdayColor:'#7d6149', gridLine:'#ede8df', font:'Lora',       accentFont:'Playfair Display' },
  { id:'fresh',   name:'Свіжий',  bg:'#f0fdf4', headerBg:'#16a34a', headerText:'#ffffff', dayNameColor:'#4ade80', dayColor:'#14532d', sundayColor:'#dc2626', saturdayColor:'#2563eb', gridLine:'#dcfce7', font:'Nunito',     accentFont:'Nunito' },
];

type CollageId = 'single'|'two-h'|'two-v'|'three'|'four'|'five'|'six'|'seven'|'eight';
interface CollageLayout { id:CollageId; name:string; slots:number; preview:React.ReactNode; getSlots:(x:number,y:number,w:number,h:number)=>{x:number;y:number;w:number;h:number}[]; }

const COLLAGES: CollageLayout[] = [
  { id:'single', name:'1 фото', slots:1, preview:<div style={{width:'100%',height:'100%',background:'#c7d2fe',borderRadius:2}}/>, getSlots:(x,y,w,h)=>[{x,y,w,h}] },
  { id:'two-h',  name:'2 горизонт.', slots:2, preview:<div style={{display:'grid',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,hh=(h-g)/2;return [{x,y,w,h:hh},{x,y:y+hh+g,w,h:hh}];} },
  { id:'two-v',  name:'2 вертик.', slots:2, preview:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,ww=(w-g)/2;return [{x,y,w:ww,h},{x:x+ww+g,y,w:ww,h}];} },
  { id:'three',  name:'3 фото', slots:3, preview:<div style={{display:'grid',gridTemplateRows:'1.2fr 1fr',gap:2,width:'100%',height:'100%'}}><div style={{background:'#c7d2fe',borderRadius:2}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>{[0,1].map(i=><div key={i} style={{background:'#a5b4fc',borderRadius:2}}/>)}</div></div>, getSlots:(x,y,w,h)=>{const g=3,topH=Math.round((h-g)*0.55),botH=h-g-topH,ww=(w-g)/2;return [{x,y,w,h:topH},{x,y:y+topH+g,w:ww,h:botH},{x:x+ww+g,y:y+topH+g,w:ww,h:botH}];} },
  { id:'four',   name:'4 фото', slots:4, preview:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1,2,3].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,ww=(w-g)/2,hh=(h-g)/2;return [{x,y,w:ww,h:hh},{x:x+ww+g,y,w:ww,h:hh},{x,y:y+hh+g,w:ww,h:hh},{x:x+ww+g,y:y+hh+g,w:ww,h:hh}];} },
  { id:'five',   name:'5 фото', slots:5, preview:<div style={{display:'grid',gridTemplateRows:'1.2fr 1fr',gap:2,width:'100%',height:'100%'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>{[0,1].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2}}>{[0,1,2].map(i=><div key={i} style={{background:'#a5b4fc',borderRadius:2}}/>)}</div></div>, getSlots:(x,y,w,h)=>{const g=3,topH=Math.round((h-g)*0.55),botH=h-g-topH,tw=(w-g)/2,bw=(w-2*g)/3;return [{x,y,w:tw,h:topH},{x:x+tw+g,y,w:tw,h:topH},{x,y:y+topH+g,w:bw,h:botH},{x:x+bw+g,y:y+topH+g,w:bw,h:botH},{x:x+2*(bw+g),y:y+topH+g,w:bw,h:botH}];} },
  { id:'six',    name:'6 фото', slots:6, preview:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1,2,3,4,5].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,ww=(w-2*g)/3,hh=(h-g)/2;return Array.from({length:6},(_,i)=>({x:x+(i%3)*(ww+g),y:y+Math.floor(i/3)*(hh+g),w:ww,h:hh}));} },
  { id:'seven',  name:'7 фото', slots:7, preview:<div style={{display:'grid',gridTemplateRows:'1fr 1fr 1fr',gap:2,width:'100%',height:'100%'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>{[0,1].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2}}>{[0,1,2].map(i=><div key={i} style={{background:'#a5b4fc',borderRadius:2}}/>)}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>{[0,1].map(i=><div key={i} style={{background:'#818cf8',borderRadius:2}}/>)}</div></div>, getSlots:(x,y,w,h)=>{const g=3,rh=(h-2*g)/3,tw=(w-g)/2,tw3=(w-2*g)/3;return [{x,y,w:tw,h:rh},{x:x+tw+g,y,w:tw,h:rh},{x,y:y+rh+g,w:tw3,h:rh},{x:x+tw3+g,y:y+rh+g,w:tw3,h:rh},{x:x+2*(tw3+g),y:y+rh+g,w:tw3,h:rh},{x,y:y+2*(rh+g),w:tw,h:rh},{x:x+tw+g,y:y+2*(rh+g),w:tw,h:rh}];} },
  { id:'eight',  name:'8 фото', slots:8, preview:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr 1fr 1fr',gap:2,width:'100%',height:'100%'}}>{[0,1,2,3,4,5,6,7].map(i=><div key={i} style={{background:'#c7d2fe',borderRadius:2}}/>)}</div>, getSlots:(x,y,w,h)=>{const g=3,ww=(w-g)/2,hh=(h-3*g)/4;return Array.from({length:8},(_,i)=>({x:x+(i%2)*(ww+g),y:y+Math.floor(i/2)*(hh+g),w:ww,h:hh}));} },
];

interface MarkedDate { day:number; shape:'circle'|'heart'; color:string; }

// ── Cover config ───────────────────────────────────────────────────────────────
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
    slots.forEach((sl,i)=>drawSlot(ctx,sl,cover.photos[i]||null));

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

function drawSlot(ctx:CanvasRenderingContext2D,sl:{x:number;y:number;w:number;h:number},photo:string|null){
  if(!photo){ctx.save();ctx.fillStyle='rgba(200,210,255,0.22)';rr(ctx,sl.x,sl.y,sl.w,sl.h,4);ctx.fill();ctx.strokeStyle='rgba(100,130,220,0.3)';ctx.setLineDash([5,4]);ctx.lineWidth=1;rr(ctx,sl.x,sl.y,sl.w,sl.h,4);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(100,130,220,0.35)';ctx.font=`${Math.round(sl.h*0.28)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('📷',sl.x+sl.w/2,sl.y+sl.h/2);ctx.restore();return;}
  const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{ctx.save();rr(ctx,sl.x,sl.y,sl.w,sl.h,4);ctx.clip();const ia=img.width/img.height,sa=sl.w/sl.h;let dw,dh,dx,dy;if(ia>sa){dh=sl.h;dw=dh*ia;dx=sl.x-(dw-sl.w)/2;dy=sl.y;}else{dw=sl.w;dh=dw/ia;dx=sl.x;dy=sl.y-(dh-sl.h)/2;}ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();};img.src=photo;
}

function drawPage(canvas:HTMLCanvasElement,month:number,year:number,design:Design,lang:LangCode,photos:(string|null)[],collageId:CollageId,W:number,H:number,marks:MarkedDate[]){
  const ctx=canvas.getContext('2d')!;canvas.width=W;canvas.height=H;
  const loc=LOCALES[lang];
  ctx.fillStyle=design.bg;ctx.fillRect(0,0,W,H);
  const pad=Math.round(W*0.055),s=W/280;
  const headerH=Math.round(H*0.085);
  const isWhite=design.id==='white';
  if(!isWhite){ctx.fillStyle=design.headerBg;rr(ctx,pad,pad,W-2*pad,headerH,5);ctx.fill();}
  else{ctx.strokeStyle='#e2e8f0';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(pad,pad+headerH);ctx.lineTo(W-pad,pad+headerH);ctx.stroke();}
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

function MonthCanvas({month,year,design,lang,photos,collageId,W,H,marks}:{month:number;year:number;design:Design;lang:LangCode;photos:(string|null)[];collageId:CollageId;W:number;H:number;marks?:MarkedDate[]}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=ref.current;if(!c)return;drawPage(c,month,year,design,lang,photos,collageId,W,H,marks||[]);},[month,year,design,lang,photos,collageId,W,H,marks]);
  return <canvas ref={ref} width={W} height={H} style={{width:'100%',height:'auto',display:'block',borderRadius:6}}/>;
}

export default function DeskCalendarConstructor(){
  const router=useRouter();const {addItem}=useCartStore();
  const [design,setDesign]=useState<Design>(DESIGNS[0]);
  const [lang,setLang]=useState<LangCode>('uk');
  const [year,setYear]=useState(2026);
  const [active,setActive]=useState(1);
  const [collageId,setCollageId]=useState<CollageId>('single');
  const [monthPhotos,setMonthPhotos]=useState<(string|null)[][]>(Array.from({length:12},()=>Array(8).fill(null)));
  const [cover,setCover]=useState<CoverConfig>({...DEFAULT_COVER});
  const [showCover,setShowCover]=useState(false); // 0=cover editor, false=month editor
  const [marks,setMarks]=useState<Record<string,MarkedDate[]>>({});
  const [markShape,setMarkShape]=useState<'circle'|'heart'>('circle');
  const [markColor,setMarkColor]=useState('#1e2d7d');
  const fileRef=useRef<HTMLInputElement>(null);
  const upTarget=useRef<{m:number;s:number;isCover?:boolean}>({m:0,s:0});
  const coverFileRef=useRef<HTMLInputElement>(null);
  const coverBgFileRef=useRef<HTMLInputElement>(null);
  const PW=260,PH=Math.round(260*(21/15));
  useEffect(()=>{const l=document.createElement('link');l.rel='stylesheet';l.href=GOOGLE_FONTS_URL;document.head.appendChild(l);return()=>{try{document.head.removeChild(l);}catch{}};},[]);
  const handleUpload=(e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);const{m,s}=upTarget.current;setMonthPhotos(prev=>{const n=prev.map(x=>[...x]);n[m][s]=url;return n;});if(fileRef.current)fileRef.current.value='';};
  const openUp=(m:number,s:number)=>{upTarget.current={m,s};fileRef.current?.click();};
  const handleCoverPhotoUpload=(e:React.ChangeEvent<HTMLInputElement>,slot:number)=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);setCover(prev=>({...prev,photos:prev.photos.map((p,i)=>i===slot?url:p)}));if(e.target)e.target.value='';};
  const handleCoverBgUpload=(e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;setCover(prev=>({...prev,bgPhoto:URL.createObjectURL(f)}));if(e.target)e.target.value='';};
  const removeP=(m:number,s:number)=>setMonthPhotos(prev=>{const n=prev.map(x=>[...x]);n[m][s]=null;return n;});
  const toggleMark=(day:number)=>{const key=`m${active}`;setMarks(prev=>{const ex=prev[key]||[];const idx=ex.findIndex(m=>m.day===day);if(idx>=0){const same=ex[idx].shape===markShape&&ex[idx].color===markColor;if(same)return{...prev,[key]:ex.filter((_,i)=>i!==idx)};return{...prev,[key]:ex.map((m,i)=>i===idx?{...m,shape:markShape,color:markColor}:m)};}return{...prev,[key]:[...ex,{day,shape:markShape,color:markColor}]};});};
  const loc=LOCALES[lang];
  const collage=COLLAGES.find(c=>c.id===collageId)||COLLAGES[0];
  const curPhotos=monthPhotos[active-1];
  const curMarks=marks[`m${active}`]||[];
  const LANGS=[{code:'uk'as LangCode,flag:'🇺🇦',label:'Укр'},{code:'en'as LangCode,flag:'🇬🇧',label:'Eng'},{code:'de'as LangCode,flag:'🇩🇪',label:'Deu'},{code:'pl'as LangCode,flag:'🇵🇱',label:'Pol'},{code:'ro'as LangCode,flag:'🇷🇴',label:'Rom'}];
  return(
    <div style={{display:'flex',minHeight:'80vh',fontFamily:'var(--font-primary,sans-serif)'}}>
      {/* LEFT */}
      <div style={{width:310,flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'14px 14px 12px',borderBottom:'1px solid #f1f5f9'}}>
          <h2 style={{fontSize:15,fontWeight:800,color:'#1e2d7d',margin:0}}>Настільний календар</h2>
          <p style={{fontSize:10,color:'#94a3b8',margin:'3px 0 0'}}>12 місяців · вертикальний</p>
        </div>
        <div style={{flex:1,padding:13,display:'flex',flexDirection:'column',gap:14}}>

          {/* Design */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Дизайн</label>
            {DESIGNS.map(d=>(
              <button key={d.id} onClick={()=>setDesign(d)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',width:'100%',border:design.id===d.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:8,background:design.id===d.id?'#f0f3ff':'#fff',cursor:'pointer',marginBottom:4}}>
                <div style={{width:34,height:24,borderRadius:3,overflow:'hidden',flexShrink:0,border:'1px solid #e2e8f0'}}>
                  <div style={{height:'34%',background:d.headerBg}}/>
                  <div style={{flex:1,background:d.bg,display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,padding:'1px 2px'}}>
                    {Array.from({length:14}).map((_,i)=><div key={i} style={{height:3,borderRadius:1,background:i<7?d.dayNameColor:d.dayColor,opacity:i<7?0.4:0.6}}/>)}
                  </div>
                </div>
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:12,fontWeight:700,color:design.id===d.id?'#1e2d7d':'#374151'}}>{d.name}</div>
                  <div style={{fontSize:9,color:'#94a3b8',fontFamily:d.font}}>{d.font}</div>
                </div>
                {design.id===d.id&&<span style={{marginLeft:'auto',color:'#1e2d7d',fontSize:14}}>✓</span>}
              </button>
            ))}
          </div>

          {/* Collage */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Фото-слот</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,gridTemplateRows:'auto auto'}}>
              {COLLAGES.map(c=>(
                <button key={c.id} onClick={()=>setCollageId(c.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 3px',border:collageId===c.id?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:6,background:collageId===c.id?'#f0f3ff':'#fff',cursor:'pointer'}}>
                  <div style={{width:'100%',height:28,padding:2}}>{c.preview}</div>
                  <span style={{fontSize:7,fontWeight:700,color:collageId===c.id?'#1e2d7d':'#374151',textAlign:'center',lineHeight:1.2}}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Мова</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {LANGS.map(l=><button key={l.code} onClick={()=>setLang(l.code)} style={{padding:'4px 7px',borderRadius:14,border:lang===l.code?'2px solid #1e2d7d':'1px solid #e2e8f0',background:lang===l.code?'#1e2d7d':'#fff',color:lang===l.code?'#fff':'#374151',fontSize:10,fontWeight:700,cursor:'pointer'}}>{l.flag} {l.label}</button>)}
            </div>
          </div>

          {/* Year */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Рік</label>
            <div style={{display:'flex',gap:4}}>
              {[2025,2026,2027].map(y=><button key={y} onClick={()=>setYear(y)} style={{flex:1,padding:'6px',border:year===y?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:7,background:year===y?'#f0f3ff':'#fff',color:year===y?'#1e2d7d':'#374151',fontWeight:700,fontSize:12,cursor:'pointer'}}>{y}</button>)}
            </div>
          </div>

          {/* ── COVER EDITOR ── */}
          {showCover && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:12,fontWeight:800,color:'#7c3aed'}}>🎨 Редактор обкладинки</div>

              {/* BG Color */}
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Колір фону</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4}}>
                  {['#1e2d7d','#0a0e1a','#ffffff','#f5f0e8','#14532d','#3d2c1e','#7c3aed','#be185d','#1d4ed8','#475569'].map(c=>(
                    <button key={c} onClick={()=>setCover(p=>({...p,bgColor:c}))} style={{width:22,height:22,borderRadius:'50%',background:c,border:cover.bgColor===c?'3px solid #1e2d7d':'2px solid #fff',cursor:'pointer',boxShadow:'0 0 0 1px #e2e8f0',flexShrink:0}}/>
                  ))}
                  <input type="color" value={cover.bgColor} onChange={e=>setCover(p=>({...p,bgColor:e.target.value}))} style={{width:22,height:22,border:'1px solid #e2e8f0',borderRadius:5,cursor:'pointer',padding:1}}/>
                </div>
              </div>

              {/* BG photo */}
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Фото-фон (необов'язково)</label>
                <input ref={coverBgFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleCoverBgUpload}/>
                {cover.bgPhoto ? (
                  <div style={{position:'relative'}}>
                    <img src={cover.bgPhoto} style={{width:'100%',height:50,objectFit:'cover',borderRadius:6,border:'1.5px solid #c7d2fe'}}/>
                    <button onClick={()=>setCover(p=>({...p,bgPhoto:null}))} style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',cursor:'pointer',fontSize:10}}>×</button>
                    <div style={{marginTop:4,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:9,color:'#64748b'}}>Прозорість</span>
                      <input type="range" min={0.1} max={1} step={0.05} value={cover.photoOpacity} onChange={e=>setCover(p=>({...p,photoOpacity:+e.target.value}))} style={{flex:1,accentColor:'#7c3aed'}}/>
                    </div>
                  </div>
                ) : (
                  <button onClick={()=>coverBgFileRef.current?.click()} style={{width:'100%',padding:'8px',border:'2px dashed #c7d2fe',borderRadius:6,background:'#f8faff',color:'#1e2d7d',cursor:'pointer',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                    <Upload size={11}/> Додати фото-фон
                  </button>
                )}
              </div>

              {/* Photo collage on cover */}
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Фото-колаж на обкладинці</label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:3,marginBottom:6}}>
                  {COLLAGES.map(c=>(
                    <button key={c.id} onClick={()=>setCover(p=>({...p,collageId:c.id}))} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'4px 2px',border:cover.collageId===c.id?'2px solid #7c3aed':'1px solid #e2e8f0',borderRadius:5,background:cover.collageId===c.id?'#faf5ff':'#fff',cursor:'pointer'}}>
                      <div style={{width:'100%',height:24,padding:2}}>{c.preview}</div>
                      <span style={{fontSize:6,fontWeight:700,color:cover.collageId===c.id?'#7c3aed':'#374151',textAlign:'center'}}>{c.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:`repeat(${COLLAGES.find(c=>c.id===cover.collageId)?.slots||1},1fr)`,gap:4}}>
                  {Array.from({length:COLLAGES.find(c=>c.id===cover.collageId)?.slots||1},(_,si)=>{
                    const ph=cover.photos[si];
                    return ph?(
                      <div key={si} style={{position:'relative'}}>
                        <img src={ph} style={{width:'100%',height:50,objectFit:'cover',borderRadius:5,border:'1.5px solid #e9d5ff'}}/>
                        <button onClick={()=>setCover(p=>({...p,photos:p.photos.map((x,i)=>i===si?null:x)}))} style={{position:'absolute',top:2,right:2,width:14,height:14,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',cursor:'pointer',fontSize:9}}>×</button>
                      </div>
                    ):(
                      <label key={si} style={{height:50,border:'2px dashed #e9d5ff',borderRadius:5,background:'#fdf4ff',color:'#7c3aed',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1}}>
                        <Upload size={10}/>
                        <span style={{fontSize:7,fontWeight:700}}>{(COLLAGES.find(c=>c.id===cover.collageId)?.slots||1)>1?`Фото ${si+1}`:'Фото'}</span>
                        <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleCoverPhotoUpload(e,si)}/>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Title text */}
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Назва</label>
                <input type="text" value={cover.titleText} onChange={e=>setCover(p=>({...p,titleText:e.target.value}))} placeholder={`Наша сім'я ${year}`} style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:12,boxSizing:'border-box',marginBottom:5}}/>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  <input type="color" value={cover.titleColor} onChange={e=>setCover(p=>({...p,titleColor:e.target.value}))} style={{width:24,height:24,border:'1px solid #e2e8f0',borderRadius:5,cursor:'pointer',padding:1}}/>
                  <input type="range" min={14} max={50} value={cover.titleSize} onChange={e=>setCover(p=>({...p,titleSize:+e.target.value}))} style={{flex:1,accentColor:'#7c3aed'}}/>
                  <span style={{fontSize:9,color:'#94a3b8',width:20}}>{cover.titleSize}px</span>
                </div>
              </div>

              {/* Subtitle */}
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Підзаголовок</label>
                <input type="text" value={cover.subtitleText} onChange={e=>setCover(p=>({...p,subtitleText:e.target.value}))} placeholder={`Січень — Грудень ${year}`} style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:12,boxSizing:'border-box'}}/>
              </div>
            </div>
          )}

          {/* ── MONTH EDITOR ── */}
          {!showCover && (<>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Фото — {loc.months[active-1]}</label>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload}/>
            <div style={{display:'grid',gridTemplateColumns:`repeat(${collage.slots},1fr)`,gap:5}}>
              {Array.from({length:collage.slots},(_,si)=>{
                const ph=curPhotos[si];
                return ph?(
                  <div key={si} style={{position:'relative'}}>
                    <img src={ph} style={{width:'100%',height:55,objectFit:'cover',borderRadius:6,border:'1.5px solid #c7d2fe'}}/>
                    <button onClick={()=>removeP(active-1,si)} style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                  </div>
                ):(
                  <button key={si} onClick={()=>openUp(active-1,si)} style={{height:55,border:'2px dashed #c7d2fe',borderRadius:6,background:'#f8faff',color:'#1e2d7d',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                    <Upload size={11}/><span style={{fontSize:8,fontWeight:700}}>{collage.slots>1?`Фото ${si+1}`:'Фото'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Marked dates */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Виділені дні — {loc.months[active-1]}</label>
            <div style={{display:'flex',gap:4,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
              <button onClick={()=>setMarkShape('circle')} style={{padding:'3px 7px',border:markShape==='circle'?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:12,background:markShape==='circle'?'#f0f3ff':'#fff',color:markShape==='circle'?'#1e2d7d':'#374151',fontSize:10,fontWeight:700,cursor:'pointer'}}>⬤ Коло</button>
              <button onClick={()=>setMarkShape('heart')} style={{padding:'3px 7px',border:markShape==='heart'?'2px solid #e11d48':'1px solid #e2e8f0',borderRadius:12,background:markShape==='heart'?'#fff1f2':'#fff',color:markShape==='heart'?'#e11d48':'#374151',fontSize:10,fontWeight:700,cursor:'pointer'}}>♥ Серце</button>
              {['#1e2d7d','#e11d48','#16a34a','#c8a96e','#7c3aed','#ea580c','#000'].map(c=><button key={c} onClick={()=>setMarkColor(c)} style={{width:18,height:18,borderRadius:'50%',background:c,border:markColor===c?'3px solid #1e2d7d':'2px solid #fff',cursor:'pointer',boxShadow:'0 0 0 1px #e2e8f0',flexShrink:0}}/>)}
              <input type="color" value={markColor} onChange={e=>setMarkColor(e.target.value)} style={{width:22,height:22,border:'1px solid #e2e8f0',borderRadius:5,cursor:'pointer',padding:1}}/>
            </div>
            {(()=>{
              const {startOffset,daysInMonth}=getMonthDays(year,active);
              const cells:React.ReactNode[]=[];
              for(let i=0;i<startOffset;i++)cells.push(<div key={`e${i}`}/>);
              for(let d=1;d<=daysInMonth;d++){const mark=curMarks.find(m=>m.day===d);cells.push(<button key={d} onClick={()=>toggleMark(d)} style={{aspectRatio:'1',borderRadius:mark?.shape==='heart'?3:'50%',border:mark?'none':'1px solid #e2e8f0',background:mark?mark.color:'#fff',color:mark?'#fff':'#374151',fontSize:8,fontWeight:mark?700:400,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>{mark?.shape==='heart'&&<span style={{fontSize:10,lineHeight:1,position:'absolute'}}>♥</span>}<span style={{position:mark?.shape==='heart'?'absolute':'static',fontSize:7,fontWeight:700}}>{d}</span></button>);}
              return(<div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:2}}>{loc.days.map(d=><div key={d} style={{fontSize:7,fontWeight:700,color:'#94a3b8',textAlign:'center'}}>{d}</div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>{cells}</div></div>);
            })()}
            {curMarks.length>0&&<button onClick={()=>setMarks(prev=>({...prev,[`m${active}`]:[]}))} style={{marginTop:5,fontSize:9,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Очистити</button>}
          </div>
          </>)} {/* end !showCover */}

          {/* Month nav */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:6}}>Сторінки</label>
            <button onClick={()=>setShowCover(true)} style={{width:'100%',padding:'6px',border:showCover?'2px solid #7c3aed':'1px solid #e2e8f0',borderRadius:7,background:showCover?'#faf5ff':'#fff',color:showCover?'#7c3aed':'#374151',fontWeight:700,fontSize:11,cursor:'pointer',marginBottom:6}}>
              🎨 Обкладинка
            </button>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3}}>
              {Array.from({length:12},(_,i)=>{const m=i+1;const hp=monthPhotos[i].some(p=>p!==null);return(<button key={m} onClick={()=>{setActive(m);setShowCover(false);}} style={{padding:'5px 2px',border:active===m?'2px solid #1e2d7d':'1px solid #e2e8f0',borderRadius:5,background:active===m?'#f0f3ff':'#fff',fontSize:9,fontWeight:600,color:active===m?'#1e2d7d':'#374151',cursor:'pointer',position:'relative'}}>{loc.months[i].slice(0,3)}{hp&&<span style={{position:'absolute',top:1,right:1,width:4,height:4,borderRadius:'50%',background:'#10b981'}}/>}</button>);})}
            </div>
          </div>

        </div>

        <div style={{padding:13,borderTop:'1px solid #f1f5f9'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
            <span style={{fontSize:12,color:'#64748b'}}>Настільний календар {year}</span>
            <span style={{fontSize:16,fontWeight:800,color:'#1e2d7d'}}>450 ₴</span>
          </div>
          <button onClick={()=>{addItem({id:`desk-cal-${Date.now()}`,name:`Настільний календар ${year}`,price:450,qty:1,image:monthPhotos.flat().find(p=>p!==null)||'',options:{'Дизайн':design.name,'Мова':lang,'Рік':String(year)},personalization_note:`Дизайн: ${design.name}, Мова: ${lang}, Рік: ${year}`});toast.success('✅ Календар додано!');router.push('/cart');}} style={{width:'100%',padding:'11px',background:'#1e2d7d',color:'#fff',border:'none',borderRadius:8,fontWeight:800,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxShadow:'0 4px 12px rgba(30,45,125,0.28)'}}>
            <ShoppingCart size={14}/> Замовити — 450 ₴
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{flex:1,background:'#f4f6fb',display:'flex',flexDirection:'column',alignItems:'center',padding:'22px 18px',gap:14,overflowY:'auto'}}>
        <div style={{width:'100%',maxWidth:PW+20}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.1em',textTransform:'uppercase',textAlign:'center',marginBottom:8}}>
            {showCover ? 'Обкладинка' : loc.months[active-1]+' '+year}
          </div>
          <div style={{boxShadow:'0 6px 28px rgba(0,0,0,0.13)',borderRadius:8,overflow:'hidden'}}>
            {showCover
              ? <CoverCanvas cover={cover} year={year} W={PW} H={PH}/>
              : <MonthCanvas month={active} year={year} design={design} lang={lang} photos={curPhotos} collageId={collageId} W={PW} H={PH} marks={curMarks}/>
            }
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
            <button onClick={()=>setActive(m=>Math.max(1,m-1))} disabled={active===1} style={{padding:'5px 12px',border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:active===1?'not-allowed':'pointer',color:active===1?'#cbd5e1':'#374151',fontWeight:700,fontSize:12}}>‹</button>
            <span style={{fontSize:11,color:'#94a3b8',alignSelf:'center'}}>{active}/12</span>
            <button onClick={()=>setActive(m=>Math.min(12,m+1))} disabled={active===12} style={{padding:'5px 12px',border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:active===12?'not-allowed':'pointer',color:active===12?'#cbd5e1':'#374151',fontWeight:700,fontSize:12}}>›</button>
          </div>
        </div>

        <div style={{width:'100%',maxWidth:660}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>Всі сторінки</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5}}>
            {/* Cover thumbnail */}
            <div onClick={()=>setShowCover(true)} style={{cursor:'pointer',borderRadius:5,overflow:'hidden',border:showCover?'2px solid #7c3aed':'1px solid #e2e8f0',boxSizing:'border-box'}}>
              <CoverCanvas cover={cover} year={year} W={100} H={Math.round(100*(21/15))}/>
              <div style={{fontSize:7,textAlign:'center',padding:'2px 0',background:'#fff',color:'#64748b',fontWeight:600}}>Обкл.</div>
            </div>
            {Array.from({length:12},(_,i)=>(
              <div key={i} onClick={()=>setActive(i+1)} style={{cursor:'pointer',borderRadius:5,overflow:'hidden',border:active===i+1?'2px solid #1e2d7d':'1px solid #e2e8f0',boxSizing:'border-box'}}>
                <MonthCanvas month={i+1} year={year} design={design} lang={lang} photos={monthPhotos[i]} collageId={collageId} W={100} H={Math.round(100*(21/15))} marks={marks[`m${i+1}`]||[]}/>
                <div style={{fontSize:7,textAlign:'center',padding:'2px 0',background:'#fff',color:'#64748b',fontWeight:600}}>{loc.months[i].slice(0,3)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
