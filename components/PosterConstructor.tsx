'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, Plus, Trash2, Type, ChevronLeft, ChevronRight, ShoppingCart, RotateCcw, Move, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { FONT_GROUPS, GOOGLE_FONTS_URL } from '@/lib/editor/constants';
import PixarPortraitGenerator, { AI_PORTRAIT_PRICE } from './PixarPortraitGenerator';
import { exportCanvasAt300DPI, uploadOrderFile } from '@/lib/export-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhotoSlot {
  id: string;
  photoUrl: string;
  cropX: number;
  cropY: number;
  zoom: number;
  rotation: number;
}

interface TextBlock {
  id: string;
  text: string;
  x: number; // % of poster width
  y: number; // % of poster height
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
}

interface PosterConfig {
  // Photos
  photos: PhotoSlot[];
  // Layout
  layoutId: string;
  // Design
  bgColor: string;
  frameStyle: 'none' | 'thin' | 'thick' | 'double' | 'rounded';
  frameColor: string;
  padding: number; // px
  // Text
  textBlocks: TextBlock[];
  // Size
  size: 'a4' | 'a3' | '30x40' | '40x50' | '50x70';
}

interface Layout {
  id: string;
  name: string;
  slots: number;
  preview: React.ReactNode;
  getSlots: (W: number, H: number, pad: number) => { x: number; y: number; w: number; h: number; clipPath?: string; shape?: 'rect'|'circle'|'heart' }[];
}

// ── Layouts ───────────────────────────────────────────────────────────────────

const LAYOUTS: Layout[] = [
  // ── 1 фото ───────────────────────────────────────────
  {
    id: 'single',
    name: '1 фото',
    slots: 1,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => [{ x:p, y:p, w:W-2*p, h:H-2*p }],
  },
  {
    id: 'circle-single',
    name: '1 коло',
    slots: 1,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><circle cx="30" cy="38" r="26" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => [{ x:p, y:p, w:W-2*p, h:H-2*p, shape:'circle' as const }],
  },
  {
    id: 'heart-single',
    name: '1 серце',
    slots: 1,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><path d="M30 62 C30 62 5 44 5 26 C5 14 14 8 22 14 C26 16 30 22 30 22 C30 22 34 16 38 14 C46 8 55 14 55 26 C55 44 30 62 30 62Z" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => [{ x:p, y:p, w:W-2*p, h:H-2*p, shape:'heart' as const }],
  },
  // ── 2 фото ───────────────────────────────────────────
  {
    id: 'two-h',
    name: '2 горизонт.',
    slots: 2,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="37" rx="2" fill="#c7d2fe"/><rect x="2" y="41" width="56" height="37" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const h=(H-2*p-g)/2; return [{x:p,y:p,w:W-2*p,h},{x:p,y:p+h+g,w:W-2*p,h}]; },
  },
  {
    id: 'two-v',
    name: '2 вертик.',
    slots: 2,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="27" height="76" rx="2" fill="#c7d2fe"/><rect x="31" y="2" width="27" height="76" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-g)/2; return [{x:p,y:p,w,h:H-2*p},{x:p+w+g,y:p,w,h:H-2*p}]; },
  },
  {
    id: 'two-uneven',
    name: '2 нерівних',
    slots: 2,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="37" height="76" rx="2" fill="#c7d2fe"/><rect x="41" y="2" width="17" height="76" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const w1=Math.round((W-2*p-g)*0.63); const w2=W-2*p-g-w1; return [{x:p,y:p,w:w1,h:H-2*p},{x:p+w1+g,y:p,w:w2,h:H-2*p}]; },
  },
  {
    id: 'two-circles',
    name: '2 кола',
    slots: 2,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><circle cx="18" cy="40" r="14" fill="#c7d2fe"/><circle cx="42" cy="40" r="14" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-g)/2; return [{x:p,y:p,w,h:H-2*p,shape:'circle' as const},{x:p+w+g,y:p,w,h:H-2*p,shape:'circle' as const}]; },
  },
  // ── 3 фото ───────────────────────────────────────────
  {
    id: 'three-top',
    name: '3 (великий+2)',
    slots: 3,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="44" rx="2" fill="#c7d2fe"/><rect x="2" y="48" width="27" height="30" rx="2" fill="#a5b4fc"/><rect x="31" y="48" width="27" height="30" rx="2" fill="#818cf8"/></svg>,
    getSlots: (W, H, p) => { const g=4; const topH=Math.round((H-2*p-g)*0.55); const botH=H-2*p-g-topH; const w=(W-2*p-g)/2; return [{x:p,y:p,w:W-2*p,h:topH},{x:p,y:p+topH+g,w,h:botH},{x:p+w+g,y:p+topH+g,w,h:botH}]; },
  },
  {
    id: 'three-bot',
    name: '3 (2+великий)',
    slots: 3,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="27" height="30" rx="2" fill="#a5b4fc"/><rect x="31" y="2" width="27" height="30" rx="2" fill="#818cf8"/><rect x="2" y="34" width="56" height="44" rx="2" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => { const g=4; const botH=Math.round((H-2*p-g)*0.55); const topH=H-2*p-g-botH; const w=(W-2*p-g)/2; return [{x:p,y:p,w,h:topH},{x:p+w+g,y:p,w,h:topH},{x:p,y:p+topH+g,w:W-2*p,h:botH}]; },
  },
  {
    id: 'triptych',
    name: 'Триптих',
    slots: 3,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="15" height="76" rx="2" fill="#a5b4fc"/><rect x="19" y="2" width="22" height="76" rx="2" fill="#c7d2fe"/><rect x="43" y="2" width="15" height="76" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const side=Math.round((W-2*p-2*g)*0.28); const mid=W-2*p-2*g-2*side; return [{x:p,y:p,w:side,h:H-2*p},{x:p+side+g,y:p,w:mid,h:H-2*p},{x:p+side+g+mid+g,y:p,w:side,h:H-2*p}]; },
  },
  {
    id: 'three-circles',
    name: '3 кола',
    slots: 3,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><circle cx="12" cy="40" r="9" fill="#a5b4fc"/><circle cx="30" cy="40" r="9" fill="#c7d2fe"/><circle cx="48" cy="40" r="9" fill="#818cf8"/></svg>,
    getSlots: (W, H, p) => { const g=8; const w=(W-2*p-2*g)/3; return [{x:p,y:p,w,h:H-2*p,shape:'circle' as const},{x:p+w+g,y:p,w,h:H-2*p,shape:'circle' as const},{x:p+2*(w+g),y:p,w,h:H-2*p,shape:'circle' as const}]; },
  },
  // ── 4 фото ───────────────────────────────────────────
  {
    id: 'four-grid',
    name: '4 рівна сітка',
    slots: 4,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="27" height="37" rx="2" fill="#c7d2fe"/><rect x="31" y="2" width="27" height="37" rx="2" fill="#a5b4fc"/><rect x="2" y="41" width="27" height="37" rx="2" fill="#818cf8"/><rect x="31" y="41" width="27" height="37" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-g)/2; const h=(H-2*p-g)/2; return [{x:p,y:p,w,h},{x:p+w+g,y:p,w,h},{x:p,y:p+h+g,w,h},{x:p+w+g,y:p+h+g,w,h}]; },
  },
  {
    id: 'four-left',
    name: '4 (велике+3)',
    slots: 4,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="36" height="76" rx="2" fill="#c7d2fe"/><rect x="40" y="2" width="18" height="23" rx="2" fill="#a5b4fc"/><rect x="40" y="27" width="18" height="23" rx="2" fill="#818cf8"/><rect x="40" y="52" width="18" height="26" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const leftW=Math.round((W-2*p-g)*0.6); const rightW=W-2*p-g-leftW; const rh=(H-2*p-2*g)/3; return [{x:p,y:p,w:leftW,h:H-2*p},{x:p+leftW+g,y:p,w:rightW,h:rh},{x:p+leftW+g,y:p+rh+g,w:rightW,h:rh},{x:p+leftW+g,y:p+2*(rh+g),w:rightW,h:rh}]; },
  },
  {
    id: 'four-right',
    name: '4 (3+велике)',
    slots: 4,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="18" height="23" rx="2" fill="#a5b4fc"/><rect x="2" y="27" width="18" height="23" rx="2" fill="#818cf8"/><rect x="2" y="52" width="18" height="26" rx="2" fill="#a5b4fc"/><rect x="22" y="2" width="36" height="76" rx="2" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => { const g=4; const rightW=Math.round((W-2*p-g)*0.6); const leftW=W-2*p-g-rightW; const rh=(H-2*p-2*g)/3; return [{x:p,y:p,w:leftW,h:rh},{x:p,y:p+rh+g,w:leftW,h:rh},{x:p,y:p+2*(rh+g),w:leftW,h:rh},{x:p+leftW+g,y:p,w:rightW,h:H-2*p}]; },
  },
  {
    id: 'four-diagonal',
    name: '4 нерівних',
    slots: 4,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="36" height="44" rx="2" fill="#c7d2fe"/><rect x="40" y="2" width="18" height="44" rx="2" fill="#a5b4fc"/><rect x="2" y="48" width="18" height="30" rx="2" fill="#818cf8"/><rect x="22" y="48" width="36" height="30" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const topH=Math.round((H-2*p-g)*0.55); const botH=H-2*p-g-topH; const topW1=Math.round((W-2*p-g)*0.63); const topW2=W-2*p-g-topW1; const botW1=Math.round((W-2*p-g)*0.33); const botW2=W-2*p-g-botW1; return [{x:p,y:p,w:topW1,h:topH},{x:p+topW1+g,y:p,w:topW2,h:topH},{x:p,y:p+topH+g,w:botW1,h:botH},{x:p+botW1+g,y:p+topH+g,w:botW2,h:botH}]; },
  },
  {
    id: 'four-circles',
    name: '4 кола',
    slots: 4,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><circle cx="18" cy="25" r="13" fill="#c7d2fe"/><circle cx="42" cy="25" r="13" fill="#a5b4fc"/><circle cx="18" cy="56" r="13" fill="#818cf8"/><circle cx="42" cy="56" r="13" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=8; const w=(W-2*p-g)/2; const h=(H-2*p-g)/2; return [{x:p,y:p,w,h,shape:'circle' as const},{x:p+w+g,y:p,w,h,shape:'circle' as const},{x:p,y:p+h+g,w,h,shape:'circle' as const},{x:p+w+g,y:p+h+g,w,h,shape:'circle' as const}]; },
  },
  // ── 5 фото ───────────────────────────────────────────
  {
    id: 'five-cross',
    name: '5 хрест',
    slots: 5,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="30" width="17" height="20" rx="2" fill="#a5b4fc"/><rect x="21" y="2" width="18" height="26" rx="2" fill="#c7d2fe"/><rect x="21" y="30" width="18" height="20" rx="2" fill="#818cf8"/><rect x="21" y="52" width="18" height="26" rx="2" fill="#c7d2fe"/><rect x="41" y="30" width="17" height="20" rx="2" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=4; const w3=(W-2*p-2*g)/3; const h3=(H-2*p-2*g)/3; return [{x:p,y:p+h3+g,w:w3,h:h3},{x:p+w3+g,y:p,w:w3,h:h3},{x:p+w3+g,y:p+h3+g,w:w3,h:h3},{x:p+w3+g,y:p+2*(h3+g),w:w3,h:h3},{x:p+2*(w3+g),y:p+h3+g,w:w3,h:h3}]; },
  },
  {
    id: 'five-grid',
    name: '5 (2+3)',
    slots: 5,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="27" height="37" rx="2" fill="#c7d2fe"/><rect x="31" y="2" width="27" height="37" rx="2" fill="#a5b4fc"/><rect x="2" y="41" width="17" height="37" rx="2" fill="#818cf8"/><rect x="21" y="41" width="17" height="37" rx="2" fill="#a5b4fc"/><rect x="40" y="41" width="18" height="37" rx="2" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => { const g=4; const topH=Math.round((H-2*p-g)*0.5); const botH=H-2*p-g-topH; const tw=(W-2*p-g)/2; const bw=(W-2*p-2*g)/3; return [{x:p,y:p,w:tw,h:topH},{x:p+tw+g,y:p,w:tw,h:topH},{x:p,y:p+topH+g,w:bw,h:botH},{x:p+bw+g,y:p+topH+g,w:bw,h:botH},{x:p+2*(bw+g),y:p+topH+g,w:bw,h:botH}]; },
  },
  // ── 6 фото ───────────────────────────────────────────
  {
    id: 'six-grid',
    name: '6 рівна сітка',
    slots: 6,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}>{[0,1,2,3,4,5].map(i=><rect key={i} x={2+(i%3)*20} y={2+Math.floor(i/3)*40} width="18" height="37" rx="2" fill={['#c7d2fe','#a5b4fc','#818cf8'][i%3]}/>)}</svg>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-2*g)/3; const h=(H-2*p-g)/2; return Array.from({length:6},(_,i)=>({x:p+(i%3)*(w+g),y:p+Math.floor(i/3)*(h+g),w,h})); },
  },
  {
    id: 'six-3rows',
    name: '6 (3 рядки)',
    slots: 6,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}>{[0,1,2,3,4,5].map(i=><rect key={i} x={2+(i%2)*31} y={2+Math.floor(i/2)*27} width="27" height="23" rx="2" fill={['#c7d2fe','#a5b4fc'][i%2]}/>)}</svg>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-g)/2; const h=(H-2*p-2*g)/3; return Array.from({length:6},(_,i)=>({x:p+(i%2)*(w+g),y:p+Math.floor(i/2)*(h+g),w,h})); },
  },
  {
    id: 'six-circles',
    name: '6 кола',
    slots: 6,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/>{[0,1,2,3,4,5].map(i=><circle key={i} cx={12+(i%3)*18} cy={22+Math.floor(i/3)*38} r="7" fill={['#c7d2fe','#a5b4fc','#818cf8'][i%3]}/>)}</svg>,
    getSlots: (W, H, p) => { const g=8; const w=(W-2*p-2*g)/3; const h=(H-2*p-g)/2; return Array.from({length:6},(_,i)=>({x:p+(i%3)*(w+g),y:p+Math.floor(i/3)*(h+g),w,h,shape:'circle' as const})); },
  },
  // ── 9 фото ───────────────────────────────────────────
  {
    id: 'nine-grid',
    name: '9 сітка',
    slots: 9,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}>{Array.from({length:9},(_,i)=><rect key={i} x={2+(i%3)*20} y={2+Math.floor(i/3)*27} width="18" height="23" rx="1" fill={['#c7d2fe','#a5b4fc','#818cf8'][i%3]}/>)}</svg>,
    getSlots: (W, H, p) => { const g=3; const w=(W-2*p-2*g)/3; const h=(H-2*p-2*g)/3; return Array.from({length:9},(_,i)=>({x:p+(i%3)*(w+g),y:p+Math.floor(i/3)*(h+g),w,h})); },
  },
  // ── Фігурні ─────────────────────────────────────────
  {
    id: 'heart-collage-4',
    name: '4 серця',
    slots: 4,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/>{[{cx:18,cy:28},{cx:42,cy:28},{cx:18,cy:56},{cx:42,cy:56}].map((p2,i)=><path key={i} d={`M${p2.cx} ${p2.cy+10} C${p2.cx} ${p2.cy+10} ${p2.cx-12} ${p2.cy+2} ${p2.cx-12} ${p2.cy-4} C${p2.cx-12} ${p2.cy-10} ${p2.cx-5} ${p2.cy-14} ${p2.cx} ${p2.cy-8} C${p2.cx+5} ${p2.cy-14} ${p2.cx+12} ${p2.cy-10} ${p2.cx+12} ${p2.cy-4} C${p2.cx+12} ${p2.cy+2} ${p2.cx} ${p2.cy+10} ${p2.cx} ${p2.cy+10}Z`} fill="#c7d2fe"/>)}</svg>,
    getSlots: (W, H, p) => { const g=8; const w=(W-2*p-g)/2; const h=(H-2*p-g)/2; return [{x:p,y:p,w,h,shape:'heart' as const},{x:p+w+g,y:p,w,h,shape:'heart' as const},{x:p,y:p+h+g,w,h,shape:'heart' as const},{x:p+w+g,y:p+h+g,w,h,shape:'heart' as const}]; },
  },
  {
    id: 'heart-collage-2',
    name: '2 серця',
    slots: 2,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><path d="M18 58 C18 58 2 44 2 32 C2 22 9 16 16 22 C17 23 18 26 18 26 C18 26 19 23 20 22 C27 16 34 22 34 32 C34 44 18 58 18 58Z" fill="#c7d2fe"/><path d="M42 58 C42 58 26 44 26 32 C26 22 33 16 40 22 C41 23 42 26 42 26 C42 26 43 23 44 22 C51 16 58 22 58 32 C58 44 42 58 42 58Z" fill="#a5b4fc"/></svg>,
    getSlots: (W, H, p) => { const g=8; const w=(W-2*p-g)/2; return [{x:p,y:p,w,h:H-2*p,shape:'heart' as const},{x:p+w+g,y:p,w,h:H-2*p,shape:'heart' as const}]; },
  },
  {
    id: 'mixed-heart-grid',
    name: 'Серце+сітка',
    slots: 5,
    preview: <svg viewBox="0 0 60 80" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="56" height="76" rx="2" fill="#f0f3ff"/><path d="M30 52 C30 52 8 38 8 24 C8 14 16 8 24 14 C27 16 30 22 30 22 C30 22 33 16 36 14 C44 8 52 14 52 24 C52 38 30 52 30 52Z" fill="#c7d2fe"/><rect x="2" y="56" width="13" height="22" rx="2" fill="#a5b4fc"/><rect x="17" y="56" width="13" height="22" rx="2" fill="#818cf8"/><rect x="32" y="56" width="13" height="22" rx="2" fill="#a5b4fc"/><rect x="47" y="56" width="11" height="22" rx="2" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => { const g=4; const topH=Math.round((H-2*p-g)*0.62); const botH=H-2*p-g-topH; const bw=(W-2*p-3*g)/4; return [{x:p,y:p,w:W-2*p,h:topH,shape:'heart' as const},{x:p,y:p+topH+g,w:bw,h:botH},{x:p+bw+g,y:p+topH+g,w:bw,h:botH},{x:p+2*(bw+g),y:p+topH+g,w:bw,h:botH},{x:p+3*(bw+g),y:p+topH+g,w:bw,h:botH}]; },
  },
  // ── Панорама ─────────────────────────────────────────
  {
    id: 'panorama',
    name: 'Панорама',
    slots: 1,
    preview: <svg viewBox="0 0 80 40" style={{width:'100%',height:'100%'}}><rect x="2" y="2" width="76" height="36" rx="2" fill="#c7d2fe"/></svg>,
    getSlots: (W, H, p) => [{ x:p, y:p, w:W-2*p, h:H-2*p }],
  },
];

// ── Size definitions ──────────────────────────────────────────────────────────

const SIZES = [
  { id: 'a4',    label: 'A4 (21×30)',  price: 350, ratio: 21/30  },
  { id: 'a3',    label: 'A3 (30×42)',  price: 450, ratio: 30/42  },
  { id: '30x40', label: '30×40 см',   price: 500, ratio: 30/40  },
  { id: '40x50', label: '40×50 см',   price: 650, ratio: 40/50  },
  { id: '50x70', label: '50×70 см',   price: 850, ratio: 50/70  },
];

const FRAME_STYLES = [
  { id: 'none',    label: 'Без рамки' },
  { id: 'thin',    label: 'Тонка' },
  { id: 'thick',   label: 'Товста' },
  { id: 'double',  label: 'Подвійна' },
  { id: 'rounded', label: 'Округла' },
];

const BG_PRESETS = ['#ffffff','#f8f4f0','#f0f3ff','#0a0e1a','#1e2d7d','#111111','#fef3c7','#fce7f3','#f0fdf4','#f5f0e8','#1a1a2e','#e8e0d8'];

// ── Helper: Poster Canvas ────────────────────────────────────────────────────

function PosterPreview({ config, canvasRef, W }: { config: PosterConfig; canvasRef: React.RefObject<HTMLCanvasElement | null>; W: number }) {
  const sizeObj = SIZES.find(s => s.id === config.size) || SIZES[0];
  const H = Math.round(W / sizeObj.ratio);
  const layout = LAYOUTS.find(l => l.id === config.layoutId) || LAYOUTS[0];
  const slots = layout.getSlots(W, H, config.padding);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, W, H);

    // Frame
    if (config.frameStyle !== 'none') {
      ctx.save();
      const fw = config.frameStyle === 'thick' ? 8 : config.frameStyle === 'double' ? 3 : 4;
      ctx.strokeStyle = config.frameColor;
      ctx.lineWidth = fw;
      if (config.frameStyle === 'rounded') {
        const r = 12;
        ctx.beginPath(); ctx.roundRect(fw/2, fw/2, W-fw, H-fw, r); ctx.stroke();
      } else {
        ctx.strokeRect(fw/2, fw/2, W-fw, H-fw);
      }
      if (config.frameStyle === 'double') {
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, 10, W-20, H-20);
      }
      ctx.restore();
    }

    // Draw photo slots
    // Helper: apply shape clip path
    const applyShapeClip = (ctx: CanvasRenderingContext2D, slot: {x:number;y:number;w:number;h:number;shape?:string}) => {
      ctx.beginPath();
      if (slot.shape === 'circle') {
        const cx = slot.x + slot.w/2, cy = slot.y + slot.h/2;
        const r = Math.min(slot.w, slot.h) / 2;
        ctx.arc(cx, cy, r, 0, Math.PI*2);
      } else if (slot.shape === 'heart') {
        // Parametric heart centered in slot
        const cx = slot.x + slot.w/2;
        const cy = slot.y + slot.h/2 + slot.h*0.05;
        const scaleX = slot.w * 0.5;
        const scaleY = slot.h * 0.5 * 0.88;
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const x = cx + scaleX * (16 * Math.pow(Math.sin(t), 3)) / 16;
          const y = cy - scaleY * (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) / 17;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.rect(slot.x, slot.y, slot.w, slot.h);
      }
    };

    const drawPromises = slots.map((slot, i) => {
      const photo = config.photos[i];
      if (!photo?.photoUrl) {
        // Empty slot placeholder
        ctx.save();
        applyShapeClip(ctx, slot);
        ctx.fillStyle = 'rgba(200,210,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,130,220,0.4)';
        ctx.setLineDash([6,4]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        // Icon
        ctx.fillStyle = 'rgba(100,130,220,0.5)';
        ctx.font = `${Math.round(slot.w*0.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', slot.x + slot.w/2, slot.y + slot.h/2);
        ctx.restore();
        return Promise.resolve();
      }
      return new Promise<void>(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          applyShapeClip(ctx, slot);
          ctx.clip();
          // Calculate zoom and crop
          const zoom = photo.zoom || 1;
          const imgAspect = img.width / img.height;
          const slotAspect = slot.w / slot.h;
          let dw, dh;
          if (imgAspect > slotAspect) {
            dh = slot.h * zoom;
            dw = dh * imgAspect;
          } else {
            dw = slot.w * zoom;
            dh = dw / imgAspect;
          }
          const dx = slot.x + (slot.w - dw) * (photo.cropX / 100);
          const dy = slot.y + (slot.h - dh) * (photo.cropY / 100);
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = photo.photoUrl;
      });
    });

    Promise.all(drawPromises).then(() => {
      // Draw text blocks
      config.textBlocks.forEach(tb => {
        ctx.save();
        const fs = Math.round(tb.fontSize * (W / 600));
        ctx.font = `${tb.italic ? 'italic ' : ''}${tb.bold ? 'bold ' : ''}${fs}px '${tb.fontFamily}', sans-serif`;
        ctx.fillStyle = tb.color;
        ctx.textAlign = tb.align;
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = `${tb.letterSpacing}px`;
        const tx = (tb.x / 100) * W;
        const ty = (tb.y / 100) * H;
        ctx.fillText(tb.text, tx, ty);
        ctx.restore();
      });
    });
  }, [config, W, H]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
    />
  );
}

// ── Slot Photo Editor (crop/zoom) ─────────────────────────────────────────────

function PhotoSlotEditor({
  slot, index, onUpdate, onDelete,
  slotRect, hideHeader,
}: {
  slot: PhotoSlot; index: number;
  onUpdate: (id: string, updates: Partial<PhotoSlot>) => void;
  onDelete: (id: string) => void;
  slotRect: { x: number; y: number; w: number; h: number };
  hideHeader?: boolean;
}) {
  return (
    <div style={{ background:'transparent' }}>
      {!hideHeader && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Фото {index+1}</span>
          <button onClick={() => onDelete(slot.id)} style={{ background:'#fee2e2', border:'none', borderRadius:6, padding:'3px 7px', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:700 }}>✕ Видалити</button>
        </div>
      )}
      <img src={slot.photoUrl} style={{ width:'100%', height:72, objectFit:'cover', borderRadius:6, marginBottom:8 }} />
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'#64748b', width:32 }}>Zoom</span>
          <input type="range" min={100} max={300} value={Math.round((slot.zoom||1)*100)}
            onChange={e => onUpdate(slot.id, { zoom: +e.target.value/100 })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:10, color:'#475569', width:30 }}>{Math.round((slot.zoom||1)*100)}%</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'#64748b', width:32 }}>← →</span>
          <input type="range" min={0} max={100} value={slot.cropX||50}
            onChange={e => onUpdate(slot.id, { cropX: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'#64748b', width:32 }}>↑ ↓</span>
          <input type="range" min={0} max={100} value={slot.cropY||50}
            onChange={e => onUpdate(slot.id, { cropY: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
        </div>
      </div>
    </div>
  );
}

// ── Text Block Editor ─────────────────────────────────────────────────────────

function TextBlockEditor({ block, onUpdate, onDelete }: {
  block: TextBlock;
  onUpdate: (id: string, updates: Partial<TextBlock>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ padding:'10px 12px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:11, color:'#94a3b8', fontFamily: block.fontFamily }}>{block.text.slice(0,20) || 'Новий текст'}</span>
        <button onClick={() => onDelete(block.id)} style={{ background:'#fee2e2', border:'none', borderRadius:6, padding:'3px 7px', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:700 }}>✕</button>
      </div>
      <input type="text" value={block.text}
        onChange={e => onUpdate(block.id, { text: e.target.value })}
        style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:13, marginBottom:8, boxSizing:'border-box' }}
        placeholder="Текст напису..." />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
        {/* Font */}
        <select value={block.fontFamily} onChange={e => onUpdate(block.id, { fontFamily: e.target.value })}
          style={{ padding:'5px 8px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:11, fontFamily: block.fontFamily }}>
          {FONT_GROUPS.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          ))}
        </select>
        {/* Color */}
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <input type="color" value={block.color} onChange={e => onUpdate(block.id, { color: e.target.value })}
            style={{ width:32, height:32, border:'1px solid #e2e8f0', borderRadius:6, cursor:'pointer', padding:2 }}/>
          <input type="number" min={8} max={120} value={block.fontSize}
            onChange={e => onUpdate(block.id, { fontSize: +e.target.value })}
            style={{ flex:1, padding:'5px 8px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:11, textAlign:'center' }}/>
          <span style={{ fontSize:10, color:'#94a3b8' }}>px</span>
        </div>
      </div>
      {/* Position */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:9, color:'#94a3b8', width:12 }}>X</span>
          <input type="range" min={5} max={95} value={block.x} onChange={e => onUpdate(block.id, { x: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:9, color:'#475569', width:20 }}>{block.x}%</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:9, color:'#94a3b8', width:12 }}>Y</span>
          <input type="range" min={2} max={98} value={block.y} onChange={e => onUpdate(block.id, { y: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:9, color:'#475569', width:20 }}>{block.y}%</span>
        </div>
      </div>
      {/* Alignment + style */}
      <div style={{ display:'flex', gap:4 }}>
        {(['left','center','right'] as const).map(a => (
          <button key={a} onClick={() => onUpdate(block.id, { align: a })}
            style={{ flex:1, padding:'4px', border: block.align===a ? '2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: block.align===a?'#f0f3ff':'#fff', cursor:'pointer', fontSize:14 }}>
            {a==='left'?'⬅':a==='center'?'⬆':'➡'}
          </button>
        ))}
        <button onClick={() => onUpdate(block.id, { bold: !block.bold })}
          style={{ flex:1, padding:'4px', border: block.bold?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: block.bold?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:900, fontSize:12 }}>B</button>
        <button onClick={() => onUpdate(block.id, { italic: !block.italic })}
          style={{ flex:1, padding:'4px', border: block.italic?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: block.italic?'#f0f3ff':'#fff', cursor:'pointer', fontStyle:'italic', fontSize:12 }}>I</button>
      </div>
    </div>
  );
}

// ── Main Constructor ──────────────────────────────────────────────────────────

export default function PosterConstructor() {
  const router = useRouter();
  const { addItem } = useCartStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlotUpload, setActiveSlotUpload] = useState<number | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdx = useRef<number>(-1);
  const [cropSlotIdx, setCropSlotIdx] = useState<number | null>(null);
  const [showPixar, setShowPixar] = useState(false);
  const [hasAiPortrait, setHasAiPortrait] = useState(false); // which photo slot is in crop mode
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [step, setStep] = useState<'layout' | 'photos' | 'design' | 'text' | 'size'>('layout');
  const [isOrdering, setIsOrdering] = useState(false);

  const [config, setConfig] = useState<PosterConfig>({
    photos: [],
    layoutId: 'single',
    bgColor: '#ffffff',
    frameStyle: 'thin',
    frameColor: '#1a1a1a',
    padding: 20,
    textBlocks: [],
    size: 'a4',
  });

  const layout = LAYOUTS.find(l => l.id === config.layoutId) || LAYOUTS[0];
  const sizeObj = SIZES.find(s => s.id === config.size) || SIZES[0];

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  // ── Photo management ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPhotos: PhotoSlot[] = [];
    let loaded = 0;
    files.slice(0, layout.slots - config.photos.length).forEach(file => {
      const url = URL.createObjectURL(file);
      newPhotos.push({ id: `photo-${Date.now()}-${Math.random()}`, photoUrl: url, cropX: 50, cropY: 50, zoom: 1, rotation: 0 });
      loaded++;
      if (loaded === files.length || loaded === layout.slots - config.photos.length) {
        setConfig(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updatePhoto = (id: string, updates: Partial<PhotoSlot>) => {
    setConfig(prev => ({ ...prev, photos: prev.photos.map(p => p.id === id ? { ...p, ...updates } : p) }));
  };

  const deletePhoto = (id: string) => {
    setConfig(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  // Swap two photos by index
  const swapPhotos = (fromIdx: number, toIdx: number) => {
    setConfig(prev => {
      const photos = [...prev.photos];
      [photos[fromIdx], photos[toIdx]] = [photos[toIdx], photos[fromIdx]];
      return { ...prev, photos };
    });
  };

  // Replace photo at index with new file
  const replacePhotoAtIndex = (index: number, file: File) => {
    const url = URL.createObjectURL(file);
    setConfig(prev => ({
      ...prev,
      photos: prev.photos.map((p, i) => i === index
        ? { ...p, photoUrl: url, cropX: 50, cropY: 50, zoom: 1 }
        : p
      ),
    }));
  };

  // ── Text management ───────────────────────────────────────────────────────
  const addTextBlock = () => {
    setConfig(prev => ({ ...prev, textBlocks: [...prev.textBlocks, {
      id: `txt-${Date.now()}`, text: 'Ваш текст', x: 50, y: 90,
      fontSize: 24, fontFamily: 'Playfair Display', color: '#1a1a1a',
      align: 'center', bold: false, italic: false, letterSpacing: 1,
    }]}));
  };

  const updateTextBlock = (id: string, updates: Partial<TextBlock>) => {
    setConfig(prev => ({ ...prev, textBlocks: prev.textBlocks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  };

  const deleteTextBlock = (id: string) => {
    setConfig(prev => ({ ...prev, textBlocks: prev.textBlocks.filter(t => t.id !== id) }));
  };

  // ── Layout change ─────────────────────────────────────────────────────────
  const changeLayout = (layoutId: string) => {
    const newLayout = LAYOUTS.find(l => l.id === layoutId)!;
    setConfig(prev => ({
      ...prev,
      layoutId,
      photos: prev.photos.slice(0, newLayout.slots),
    }));
  };

  // ── Order ────────────────────────────────────────────────────────────────
  const handleOrder = async () => {
    if (config.photos.length === 0) { toast.error('Додайте хоча б одне фото'); return; }
    setIsOrdering(true);
    try {
      let fileUrl = '';
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const blob = await exportCanvasAt300DPI(canvas);
          const filePath = `poster-${Date.now()}.png`;
          const uploadResult = await uploadOrderFile('poster-exports', filePath, blob); fileUrl = uploadResult.url;
        } catch {}
      }

      addItem({
        id: `poster-${Date.now()}`,
        name: `Постер ${sizeObj.label}`,
        price: sizeObj.price + (hasAiPortrait ? AI_PORTRAIT_PRICE : 0),
        qty: 1,
        image: config.photos[0]?.photoUrl || '',
        options: {
          'Розмір': sizeObj.label,
          'Макет': layout.name,
          'Рамка': config.frameStyle,
        },
        personalization_note: fileUrl ? `Файл: ${fileUrl}` : `Макет: ${layout.name}`,
      });
      toast.success('✅ Постер додано до кошика!');
      router.push('/cart');
    } catch (err) {
      toast.error('Помилка при оформленні');
    } finally {
      setIsOrdering(false);
    }
  };

  // ── Preview width ─────────────────────────────────────────────────────────
  const PREVIEW_W = 480;

  // ── Render ────────────────────────────────────────────────────────────────
  const steps = [
    { id: 'layout', label: '1. Макет' },
    { id: 'photos', label: '2. Фото' },
    { id: 'design', label: '3. Дизайн' },
    { id: 'text',   label: '4. Текст' },
    { id: 'size',   label: '5. Розмір' },
  ];

  return (
    <div style={{ display:'flex', gap:0, minHeight:'80vh', fontFamily:'var(--font-primary, sans-serif)' }}>
      {/* ── LEFT: Steps + Controls ── */}
      <div style={{ width:360, flexShrink:0, background:'#fff', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column' }}>
        {/* Step tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', overflowX:'auto' }}>
          {steps.map(s => (
            <button key={s.id} onClick={() => setStep(s.id as any)}
              style={{ flex:1, padding:'12px 4px', border:'none', background: step===s.id ? '#f0f3ff' : 'transparent',
                color: step===s.id ? '#1e2d7d' : '#64748b', fontWeight: step===s.id ? 800 : 500,
                fontSize:11, cursor:'pointer', borderBottom: step===s.id ? '3px solid #1e2d7d' : '3px solid transparent',
                transition:'all 0.15s', whiteSpace:'nowrap' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>

          {/* ── STEP 1: Layout ── */}
          {step === 'layout' && (
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:4 }}>Оберіть макет</h3>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Як розміщувати фотографії на постері</p>
              {[
                { label: '1 фото', ids: ['single','circle-single','heart-single'] },
                { label: '2 фото', ids: ['two-h','two-v','two-uneven','two-circles','two-hearts'] },
                { label: '3 фото', ids: ['three-top','three-bot','triptych','three-circles'] },
                { label: '4 фото', ids: ['four-grid','four-left','four-right','four-diagonal','four-circles','heart-collage-4'] },
                { label: '5–6 фото', ids: ['five-cross','five-grid','six-grid','six-3rows','six-circles'] },
                { label: '9+ фото', ids: ['nine-grid'] },
                { label: 'Фігурні', ids: ['heart-collage-2','mixed-heart-grid','panorama'] },
              ].map(group => {
                const groupLayouts = LAYOUTS.filter(l => group.ids.includes(l.id));
                if (!groupLayouts.length) return null;
                return (
                  <div key={group.label} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{group.label}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                      {groupLayouts.map(l => {
                        const isActive = config.layoutId === l.id;
                        return (
                          <button key={l.id} onClick={() => changeLayout(l.id)}
                            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 4px',
                              border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                              borderRadius:8, background: isActive ? '#f0f3ff' : '#fff',
                              cursor:'pointer', transition:'all 0.15s' }}>
                            <div style={{ width:'100%', height:52, padding:2 }}>{l.preview}</div>
                            <span style={{ fontSize:9, fontWeight:700, color: isActive ? '#1e2d7d' : '#374151', textAlign:'center', lineHeight:1.2 }}>{l.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── STEP 2: Photos ── */}
          {step === 'photos' && (
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:4 }}>Додати фото</h3>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>Макет "{layout.name}" — {layout.slots} фото</p>

              {config.photos.length < layout.slots && (<>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ width:'100%', padding:'14px', border:'2px dashed #c7d2fe', borderRadius:10,
                    background:'#f8faff', color:'#1e2d7d', fontWeight:700, fontSize:13,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:6 }}>
                  <Upload size={16}/> Завантажити фото ({config.photos.length}/{layout.slots})
                </button>
                <button onClick={() => setShowPixar(p => !p)}
                  style={{ width:'100%', padding:'10px', border:'2px dashed #a855f7', borderRadius:10,
                    background:'#faf5ff', color:'#7c3aed', fontWeight:700, fontSize:12,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12 }}>
                  🎨 AI Портрет — Піксар / Аніме / Акварель
                </button>
                {showPixar && (
                  <div style={{ border:'1px solid #e9d5ff', borderRadius:10, padding:12, marginBottom:12, background:'#fdf4ff' }}>
                    <PixarPortraitGenerator compact onResult={(url) => {
                      const newPhoto = { id: 'ai-'+Date.now(), photoUrl: url, cropX:50, cropY:50, zoom:1, rotation:0 };
                      setConfig(prev => ({ ...prev, photos: [...prev.photos.slice(0, layout.slots-1), newPhoto] }));
                      setHasAiPortrait(true);
                      setShowPixar(false);
                      toast.success('🎨 AI портрет додано! +75 ₴');
                    }}/>
                  </div>
                )}
              </>)}

              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={handleFileSelect} />

              {/* Hidden replace input */}
              <input ref={replaceInputRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && replaceTargetIdx.current >= 0) {
                    replacePhotoAtIndex(replaceTargetIdx.current, file);
                    replaceTargetIdx.current = -1;
                  }
                  if (replaceInputRef.current) replaceInputRef.current.value = '';
                }}
              />

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {config.photos.map((photo, i) => {
                  const sizeObj2 = SIZES.find(s => s.id === config.size) || SIZES[0];
                  const posterH = PREVIEW_W / sizeObj2.ratio;
                  const slots = layout.getSlots(PREVIEW_W, posterH, config.padding);
                  const sl = slots[i] || slots[0];
                  const isDragOver = dragOverIdx === i && dragFromIdx !== null && dragFromIdx !== i;
                  return (
                    <div key={photo.id}
                      draggable
                      onDragStart={() => setDragFromIdx(i)}
                      onDragEnd={() => { setDragFromIdx(null); setDragOverIdx(null); }}
                      onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={e => {
                        e.preventDefault();
                        if (dragFromIdx !== null && dragFromIdx !== i) swapPhotos(dragFromIdx, i);
                        setDragFromIdx(null); setDragOverIdx(null);
                      }}
                      style={{
                        borderRadius:10, border: isDragOver ? '2px dashed #1e2d7d' : '1px solid #e2e8f0',
                        background: isDragOver ? '#f0f3ff' : '#f8fafc',
                        transition:'all 0.15s', cursor: dragFromIdx !== null ? 'grabbing' : 'grab',
                        opacity: dragFromIdx === i ? 0.5 : 1,
                      }}
                    >
                      {/* Drag handle + header */}
                      <div style={{ display:'flex', alignItems:'center', padding:'8px 12px 0', gap:6 }}>
                        <span style={{ fontSize:16, color:'#94a3b8', cursor:'grab', userSelect:'none' }}>⠿</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#374151', flex:1 }}>Фото {i+1}</span>
                        {/* Move buttons */}
                        <button onClick={() => i > 0 && swapPhotos(i, i-1)} disabled={i===0}
                          style={{ padding:'2px 7px', border:'1px solid #e2e8f0', borderRadius:5, background:'#fff', cursor:i===0?'not-allowed':'pointer', color:i===0?'#cbd5e1':'#374151', fontSize:12 }} title="Вгору">↑</button>
                        <button onClick={() => i < config.photos.length-1 && swapPhotos(i, i+1)} disabled={i===config.photos.length-1}
                          style={{ padding:'2px 7px', border:'1px solid #e2e8f0', borderRadius:5, background:'#fff', cursor:i===config.photos.length-1?'not-allowed':'pointer', color:i===config.photos.length-1?'#cbd5e1':'#374151', fontSize:12 }} title="Вниз">↓</button>
                        {/* Replace button */}
                        <button onClick={() => { replaceTargetIdx.current = i; replaceInputRef.current?.click(); }}
                          style={{ padding:'2px 8px', border:'1px solid #c7d2fe', borderRadius:5, background:'#f0f3ff', cursor:'pointer', color:'#1e2d7d', fontSize:10, fontWeight:700 }}>🔄 Замінити</button>
                        <button onClick={() => deletePhoto(photo.id)}
                          style={{ padding:'2px 7px', border:'none', borderRadius:5, background:'#fee2e2', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:700 }}>✕</button>
                      </div>
                      {/* Photo editor */}
                      <div style={{ padding:'0 12px 10px' }}>
                        <PhotoSlotEditor slot={photo} index={i}
                          onUpdate={updatePhoto} onDelete={deletePhoto}
                          slotRect={{ x: sl.x/PREVIEW_W*100, y: sl.y/posterH*100, w: sl.w/PREVIEW_W*100, h: sl.h/posterH*100 }}
                          hideHeader
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {config.photos.length === 0 && (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'#94a3b8' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
                  <div style={{ fontSize:13 }}>Натисніть кнопку вище щоб додати фото</div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Design ── */}
          {step === 'design' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', margin:0 }}>Дизайн</h3>

              {/* Background */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Фон постера</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                  {BG_PRESETS.map(c => (
                    <button key={c} onClick={() => setConfig(p => ({ ...p, bgColor: c }))}
                      style={{ width:28, height:28, borderRadius:6, background:c, border: config.bgColor===c ? '3px solid #1e2d7d' : '1.5px solid #e2e8f0', cursor:'pointer', flexShrink:0 }}/>
                  ))}
                </div>
                <input type="color" value={config.bgColor} onChange={e => setConfig(p => ({ ...p, bgColor: e.target.value }))}
                  style={{ width:'100%', height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', padding:2 }}/>
              </div>

              {/* Frame style */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Рамка</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                  {FRAME_STYLES.map(f => (
                    <button key={f.id} onClick={() => setConfig(p => ({ ...p, frameStyle: f.id as any }))}
                      style={{ padding:'7px 4px', border: config.frameStyle===f.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius:8, background: config.frameStyle===f.id ? '#f0f3ff' : '#fff',
                        cursor:'pointer', fontSize:10, fontWeight:700, color: config.frameStyle===f.id ? '#1e2d7d' : '#374151' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame color */}
              {config.frameStyle !== 'none' && (
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Колір рамки</label>
                  <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                    {['#1a1a1a','#ffffff','#1e2d7d','#b8860b','#8b0000','#2d5a27'].map(c => (
                      <button key={c} onClick={() => setConfig(p => ({ ...p, frameColor: c }))}
                        style={{ width:28, height:28, borderRadius:6, background:c, border: config.frameColor===c ? '3px solid #1e2d7d' : '1.5px solid #e2e8f0', cursor:'pointer' }}/>
                    ))}
                  </div>
                  <input type="color" value={config.frameColor} onChange={e => setConfig(p => ({ ...p, frameColor: e.target.value }))}
                    style={{ width:'100%', height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', padding:2 }}/>
                </div>
              )}

              {/* Padding */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>
                  Відступ від краю: {config.padding}px
                </label>
                <input type="range" min={0} max={60} value={config.padding}
                  onChange={e => setConfig(p => ({ ...p, padding: +e.target.value }))}
                  style={{ width:'100%', accentColor:'#1e2d7d' }}/>
              </div>
            </div>
          )}

          {/* ── STEP 4: Text ── */}
          {step === 'text' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', margin:0 }}>Написи</h3>
                <button onClick={addTextBlock}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  <Plus size={14}/> Додати
                </button>
              </div>

              {config.textBlocks.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'#94a3b8' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✍️</div>
                  <div style={{ fontSize:13 }}>Натисніть "Додати" щоб додати напис</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {config.textBlocks.map(tb => (
                    <TextBlockEditor key={tb.id} block={tb} onUpdate={updateTextBlock} onDelete={deleteTextBlock} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 5: Size ── */}
          {step === 'size' && (
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:4 }}>Розмір постера</h3>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Вибір впливає на ціну</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
                {SIZES.map(s => (
                  <button key={s.id} onClick={() => setConfig(p => ({ ...p, size: s.id as any }))}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px',
                      border: config.size===s.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                      borderRadius:10, background: config.size===s.id ? '#f0f3ff' : '#fff', cursor:'pointer' }}>
                    <span style={{ fontWeight:700, fontSize:14, color: config.size===s.id ? '#1e2d7d' : '#374151' }}>{s.label}</span>
                    <span style={{ fontWeight:800, fontSize:16, color: config.size===s.id ? '#1e2d7d' : '#374151' }}>{s.price + (hasAiPortrait ? AI_PORTRAIT_PRICE : 0)} ₴</span>
                  </button>
                ))}
              </div>

              {/* Order summary */}
              <div style={{ background:'#f0f3ff', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>Ваше замовлення:</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, color:'#374151' }}>Постер {sizeObj.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1e2d7d' }}>{sizeObj.price + (hasAiPortrait ? AI_PORTRAIT_PRICE : 0)} ₴</span>
                </div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Макет: {layout.name} · {config.photos.length} фото</div>
                {hasAiPortrait && (
                  <div style={{ fontSize:11, color:'#7c3aed', fontWeight:700, marginTop:4 }}>
                    🎨 AI Портрет +{AI_PORTRAIT_PRICE} ₴
                    <button onClick={() => setHasAiPortrait(false)} style={{ marginLeft:6, background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:10 }}>✕</button>
                  </div>
                )}
              </div>

              <button onClick={handleOrder} disabled={isOrdering || config.photos.length === 0}
                style={{ width:'100%', padding:'14px', background: config.photos.length === 0 ? '#e2e8f0' : '#1e2d7d',
                  color: config.photos.length === 0 ? '#94a3b8' : '#fff',
                  border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor: config.photos.length === 0 ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow: config.photos.length > 0 ? '0 4px 20px rgba(30,45,125,0.3)' : 'none' }}>
                <ShoppingCart size={18}/>
                {isOrdering ? 'Оформлюємо...' : config.photos.length === 0 ? 'Спочатку додайте фото' : `Замовити за ${sizeObj.price + (hasAiPortrait ? AI_PORTRAIT_PRICE : 0)} ₴`}
              </button>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between' }}>
          <button onClick={() => { const idx = steps.findIndex(s => s.id === step); if (idx > 0) setStep(steps[idx-1].id as any); }}
            disabled={step === 'layout'}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor: step==='layout'?'not-allowed':'pointer', color: step==='layout'?'#cbd5e1':'#374151', fontWeight:600, fontSize:13 }}>
            <ChevronLeft size={14}/> Назад
          </button>
          {step !== 'size' && (
            <button onClick={() => { const idx = steps.findIndex(s => s.id === step); if (idx < steps.length-1) setStep(steps[idx+1].id as any); }}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 14px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
              Далі <ChevronRight size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT: Live Preview ── */}
      <div style={{ flex:1, background:'#f4f6fb', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'32px 24px', gap:16, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase' }}>
          Попередній перегляд — {sizeObj.label}
        </div>
        <div style={{ width:'100%', maxWidth:PREVIEW_W, position:'relative' }}>
          <PosterPreview config={config} canvasRef={canvasRef} W={PREVIEW_W} />

          {/* Interactive overlay — text drag + photo crop */}
          {(() => {
            const sizeObj2 = SIZES.find(s => s.id === config.size) || SIZES[0];
            const posterH = PREVIEW_W / sizeObj2.ratio;
            const slots = layout.getSlots(PREVIEW_W, posterH, config.padding);
            // Scale factor: canvas renders at PREVIEW_W, overlay div is 100% of container
            return (
              <div style={{ position:'absolute', inset:0, borderRadius:8, overflow:'hidden' }}
                // Click on canvas to deselect crop
                onClick={() => setCropSlotIdx(null)}
              >
                {/* Photo slot crop zones */}
                {slots.map((slot, i) => {
                  const photo = config.photos[i];
                  const isCrop = cropSlotIdx === i;
                  const scaleX = 100 / PREVIEW_W;
                  const scaleY = 100 / posterH;
                  return (
                    <div key={i}
                      style={{
                        position:'absolute',
                        left: `${slot.x * scaleX}%`,
                        top: `${slot.y * scaleY}%`,
                        width: `${slot.w * scaleX}%`,
                        height: `${slot.h * scaleY}%`,
                        border: isCrop ? '2px solid #3b82f6' : 'none',
                        boxSizing:'border-box',
                        cursor: photo ? (isCrop ? 'grab' : 'pointer') : 'default',
                        zIndex: isCrop ? 20 : 5,
                      }}
                      onClick={e => { e.stopPropagation(); if (photo) setCropSlotIdx(isCrop ? null : i); }}
                    >
                      {/* Crop mode toolbar */}
                      {isCrop && photo && (
                        <div
                          style={{
                            position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)',
                            background:'rgba(15,23,42,0.92)', borderRadius:10, padding:'6px 10px',
                            display:'flex', gap:8, alignItems:'center', zIndex:30,
                            boxShadow:'0 4px 16px rgba(0,0,0,0.35)', whiteSpace:'nowrap', marginBottom:4,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <span style={{ color:'rgba(255,255,255,0.6)', fontSize:10 }}>Кадрування {i+1}:</span>
                          {/* Zoom */}
                          <span style={{ color:'#fff', fontSize:10 }}>🔍</span>
                          <input type="range" min={100} max={300} value={Math.round((photo.zoom||1)*100)}
                            onChange={e => updatePhoto(photo.id, { zoom: +e.target.value/100 })}
                            style={{ width:70, accentColor:'#3b82f6' }}/>
                          <span style={{ color:'rgba(255,255,255,0.7)', fontSize:10, minWidth:28 }}>{Math.round((photo.zoom||1)*100)}%</span>
                          {/* Crop X */}
                          <span style={{ color:'#fff', fontSize:10 }}>↔</span>
                          <input type="range" min={0} max={100} value={photo.cropX||50}
                            onChange={e => updatePhoto(photo.id, { cropX: +e.target.value })}
                            style={{ width:60, accentColor:'#3b82f6' }}/>
                          {/* Crop Y */}
                          <span style={{ color:'#fff', fontSize:10 }}>↕</span>
                          <input type="range" min={0} max={100} value={photo.cropY||50}
                            onChange={e => updatePhoto(photo.id, { cropY: +e.target.value })}
                            style={{ width:60, accentColor:'#3b82f6' }}/>
                          {/* Reset */}
                          <button onClick={() => updatePhoto(photo.id, { cropX:50, cropY:50, zoom:1 })}
                            style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:5, padding:'2px 7px', color:'#fff', cursor:'pointer', fontSize:10 }}>↺</button>
                          <button onClick={() => setCropSlotIdx(null)}
                            style={{ background:'#3b82f6', border:'none', borderRadius:5, padding:'2px 8px', color:'#fff', cursor:'pointer', fontSize:10, fontWeight:700 }}>Готово</button>
                        </div>
                      )}
                      {/* Hint to click */}
                      {!isCrop && photo && (
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:4, opacity:0, transition:'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity='1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity='0')}>
                          <span style={{ background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4 }}>✂ Кадрувати</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Draggable text blocks */}
                {config.textBlocks.map(tb => {
                  const isDragging = draggingTextId === tb.id;
                  return (
                    <div key={tb.id}
                      style={{
                        position:'absolute',
                        left: `${tb.x}%`,
                        top: `${tb.y}%`,
                        transform:'translate(-50%, -50%)',
                        cursor:'move',
                        zIndex:25,
                        padding:'3px 6px',
                        border: isDragging ? '1.5px solid #3b82f6' : '1.5px dashed rgba(59,130,246,0.5)',
                        borderRadius:4,
                        background: isDragging ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.05)',
                        userSelect:'none',
                      }}
                      onPointerDown={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        const el = e.currentTarget.parentElement!;
                        const rect = el.getBoundingClientRect();
                        setDraggingTextId(tb.id);
                        const onMove = (ev: PointerEvent) => {
                          const x = Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100));
                          const y = Math.max(2, Math.min(98, ((ev.clientY - rect.top) / rect.height) * 100));
                          updateTextBlock(tb.id, { x, y });
                        };
                        const onUp = () => {
                          setDraggingTextId(null);
                          window.removeEventListener('pointermove', onMove);
                          window.removeEventListener('pointerup', onUp);
                        };
                        window.addEventListener('pointermove', onMove);
                        window.addEventListener('pointerup', onUp);
                      }}
                    >
                      <span style={{
                        fontFamily: tb.fontFamily,
                        fontSize: Math.max(8, tb.fontSize * (PREVIEW_W / 600) * 0.85),
                        color: tb.color,
                        fontWeight: tb.bold ? 700 : 400,
                        fontStyle: tb.italic ? 'italic' : 'normal',
                        letterSpacing: tb.letterSpacing,
                        whiteSpace:'nowrap',
                        textAlign: tb.align,
                        display:'block',
                        pointerEvents:'none',
                      }}>{tb.text || '...'}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <div style={{ fontSize:11, color:'#94a3b8', textAlign:'center' }}>
          Друк на щільному папері 200г/м² · Формат {sizeObj.label} · {sizeObj.price} ₴
        </div>
      </div>
    </div>
  );
}
