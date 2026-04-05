'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import Link from 'next/link';
import Image from 'next/image';
import { useT } from '@/lib/i18n/context';

export default function CartDrawer() {
    const t = useT();
    const {
        items,
        isDrawerOpen,
        closeDrawer,
        removeItem,
        updateQuantity,
        getTotal
    } = useCartStore();

    const total = getTotal();

    return (
        <AnimatePresence>
            {isDrawerOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeDrawer}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 100
                        }}
                    />

                    {/* Drawer Content */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '100%',
                            maxWidth: '450px',
                            backgroundColor: 'white',
                            boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
                            zIndex: 101,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '24px',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ShoppingBag size={24} color="var(--primary)" />
                                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{t('cart.title')}</h2>
                                <span style={{
                                    backgroundColor: '#f0f0f0',
                                    padding: '2px 8px',
                                    borderRadius: "3px",
                                    fontSize: '12px',
                                    fontWeight: 700
                                }}>
                                    {items.length}
                                </span>
                            </div>
                            <button
                                onClick={closeDrawer}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: "3px",
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Items List */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '24px'
                        }}>
                            {items.length === 0 ? (
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#888',
                                    gap: '16px'
                                }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: "3px",
                                        backgroundColor: '#f9f9f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <ShoppingBag size={40} />
                                    </div>
                                    <p style={{ fontWeight: 600 }}>{t('cart.your_cart_empty')}</p>
                                    <button
                                        onClick={closeDrawer}
                                        style={{
                                            color: 'var(--primary)',
                                            fontWeight: 700,
                                            fontSize: '14px',
                                            textDecoration: 'underline',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('cart.continue_shopping')}
                                    </button>
                                </div>
                            ) : (
                                items.map((item) => (
                                    <div key={item.id} style={{ display: 'flex', gap: '16px' }}>
                                        {/* Product Image */}
                                        <div style={{
                                            position: 'relative',
                                            width: '90px',
                                            height: '90px',
                                            borderRadius: "3px",
                                            overflow: 'hidden',
                                            backgroundColor: '#f9f9f9',
                                            flexShrink: 0
                                        }}>
                                            <Image
                                                src={item.image || 'https://via.placeholder.com/150'}
                                                alt={item.name}
                                                fill
                                                style={{ objectFit: 'cover' }}
                                            />
                                        </div>

                                        {/* Product Details */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{item.name}</h3>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Options labels */}
                                            {item.options && Object.entries(item.options).map(([key, value]: [string, any]) => (
                                                <span key={key} style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>
                                                    {key}: {typeof value === 'object' ? value.name : value}
                                                </span>
                                            ))}

                                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {/* Quantity controls */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    border: '1px solid #f0f0f0',
                                                    borderRadius: "3px",
                                                    padding: '2px'
                                                }}>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.qty - 1)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span style={{ fontSize: '13px', fontWeight: 700, width: '24px', textAlign: 'center' }}>
                                                        {item.qty}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.qty + 1)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>

                                                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>
                                                    {item.price * item.qty} ₴
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer / Checkout */}
                        {items.length > 0 && (
                            <div style={{
                                padding: '24px',
                                borderTop: '1px solid #f0f0f0',
                                backgroundColor: '#fdfdfd'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <span style={{ fontWeight: 600, color: '#666' }}>{t('cart.total_to_pay')}</span>
                                    <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>{total} ₴</span>
                                </div>

                                <Link
                                    href="/cart"
                                    onClick={closeDrawer}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        width: '100%',
                                        padding: '18px',
                                        backgroundColor: 'var(--primary)',
                                        color: 'white',
                                        borderRadius: '9999px',
                                        textDecoration: 'none',
                                        fontWeight: 800,
                                        fontSize: '16px',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                                        transition: 'transform 0.2s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                >
                                    {t('cart.checkout')} <ArrowRight size={20} />
                                </Link>

                                <p style={{
                                    textAlign: 'center',
                                    fontSize: '12px',
                                    color: '#aaa',
                                    marginTop: '16px',
                                    marginBlockEnd: 0
                                }}>
                                    {t('cart.free_shipping')}
                                </p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
