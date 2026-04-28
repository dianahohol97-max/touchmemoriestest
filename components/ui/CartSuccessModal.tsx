'use client';
import { useT } from '@/lib/i18n/context';

interface CartSuccessModalProps {
  onClose: () => void;
  cartUrl?: string;
  catalogUrl?: string;
}

export function CartSuccessModal({ onClose, cartUrl = '/cart', catalogUrl = '/catalog' }: CartSuccessModalProps) {
  const t = useT();
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div
        style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:380, width:'100%',
          textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
        <h2 style={{ fontWeight:800, fontSize:20, color:'#1e2d7d', marginBottom:8 }}>
          Товар додано до кошика!
        </h2>
        <p style={{ color:'#64748b', fontSize:14, marginBottom:24 }}>
          Оформити замовлення або продовжити покупки?
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <a href={cartUrl}
            style={{ display:'block', padding:'13px', background:'#1e2d7d', color:'#fff',
              borderRadius:10, fontWeight:800, fontSize:15, textDecoration:'none' }}>
            Оформити замовлення →
          </a>
          <a href={catalogUrl}
            style={{ display:'block', padding:'13px', background:'#f1f5f9', color:'#374151',
              borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
            Продовжити покупки
          </a>
        </div>
      </div>
    </div>
  );
}
