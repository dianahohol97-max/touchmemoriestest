'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    ChevronDown,
    MessageSquare,
    Send,
    ArrowRight,
    HelpCircle,
    Sparkles
} from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

const CATEGORIES = ["Всі", "Замовлення", "Доставка", "Конструктор", "Оплата", "Якість"];

export default function FaqPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState("Всі");
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('faqs')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (data) setFaqs(data);
        setLoading(false);
    };

    const filteredFaqs = useMemo(() => {
        return faqs.filter(faq => {
            const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === "Всі" || faq.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [faqs, searchQuery, activeCategory]);

    return (
        <main style={mainStyle}>
            <div style={containerStyle}>
                <header style={{ textAlign: 'center', marginBottom: '80px' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={badgeStyle}
                    >
                        БАЗА ЗНАНЬ
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={titleStyle}
                    >
                        Потрібна допомога? ❓
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        style={subtitleStyle}
                    >
                        Відповіді на найпопулярніші питання щодо створення та замовлення ваших фотоісторій.
                    </motion.p>

                    {/* Search Bar */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        style={searchContainer}
                    >
                        <Search style={searchIconStyle} size={24} />
                        <input
                            type="text"
                            placeholder="Що вас цікавить?"
                            style={searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </motion.div>
                </header>

                {/* Categories */}
                <div style={tabsContainer}>
                    {CATEGORIES.map((cat, i) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                ...tabStyle,
                                backgroundColor: activeCategory === cat ? 'var(--primary)' : 'white',
                                color: activeCategory === cat ? 'white' : '#64748b',
                                border: activeCategory === cat ? 'none' : '1.5px solid #f1f5f9',
                                boxShadow: activeCategory === cat ? '0 10px 20px rgba(var(--primary-rgb), 0.2)' : 'none'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* FAQ List */}
                <div style={faqListContainer}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '100px', color: '#64748b' }}>Завантаження...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <AnimatePresence>
                                {filteredFaqs.map((faq) => (
                                    <FaqItem
                                        key={faq.id}
                                        faq={faq}
                                        isOpen={openId === faq.id}
                                        onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
                                    />
                                ))}
                            </AnimatePresence>
                            {filteredFaqs.length === 0 && (
                                <div style={emptyStateStyle}>
                                    <HelpCircle size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                    <h3>Ми не знайшли відповіді на ваш запит</h3>
                                    <p>Спробуйте змінити слова або зверніться до нашої підтримки</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer CTA */}
                <div style={footerCta}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={messageIconBox}><MessageSquare size={28} color="white" /></div>
                        <div>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '4px' }}>Все ще сумніваєтесь?</h3>
                            <p style={{ color: '#64748b', margin: 0 }}>Наші менеджери готові допомогти вам 24/7</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Link href="https://t.me/touchmemories" style={supportBtnStyle}>
                            <Send size={18} /> Telegram
                        </Link>
                        <Link href="/contacts" style={{ ...supportBtnStyle, backgroundColor: '#f1f5f9', color: '#263A99' }}>
                            Контакти
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

function FaqItem({ faq, isOpen, onToggle }: { faq: any, isOpen: boolean, onToggle: () => void }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
                ...faqItemStyle,
                backgroundColor: isOpen ? 'white' : '#fcfcfc',
                border: isOpen ? '1.5px solid var(--primary)' : '1.5px solid #f1f5f9',
                boxShadow: isOpen ? '0 15px 40px rgba(0,0,0,0.05)' : 'none'
            }}
        >
            <button
                onClick={onToggle}
                style={questionBtn}
            >
                <span style={{ fontWeight: 800, fontSize: '18px', textAlign: 'left', color: '#263A99' }}>{faq.question}</span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    style={{ color: isOpen ? 'var(--primary)' : '#94a3b8' }}
                >
                    <ChevronDown size={24} />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={answerText}>
                            {faq.answer.split('\n').map((line: string, i: number) => (
                                <p key={i} style={{ marginBottom: '12px' }}>{line}</p>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

const mainStyle = { minHeight: '100vh', backgroundColor: '#fafafa', paddingTop: '140px', paddingBottom: '120px' };
const containerStyle = { maxWidth: '900px', margin: '0 auto', padding: '0 24px' };
const badgeStyle = { display: 'inline-block', backgroundColor: '#f0f9ff', color: '#263A99', padding: '6px 16px', borderRadius: "3px", fontSize: '12px', fontWeight: 900, marginBottom: '24px', letterSpacing: '0.1em' };
const titleStyle = { fontSize: '56px', fontWeight: 900, color: '#263A99', marginBottom: '24px', letterSpacing: '-0.02em', lineHeight: 1.1 };
const subtitleStyle = { fontSize: '18px', color: '#64748b', maxWidth: '600px', margin: '0 auto 48px', lineHeight: 1.6 };

const searchContainer = { position: 'relative' as any, maxWidth: '600px', margin: '0 auto' };
const searchInput = { width: '100%', padding: '24px 32px 24px 64px', borderRadius: "3px", border: 'none', backgroundColor: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.06)', fontSize: '18px', outline: 'none', transition: 'all 0.3s' };
const searchIconStyle = { position: 'absolute' as any, left: '24px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };

const tabsContainer = { display: 'flex', flexWrap: 'wrap' as any, gap: '12px', justifyContent: 'center', marginBottom: '60px' };
const tabStyle = { padding: '10px 20px', borderRadius: "3px", fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s', outline: 'none' };

const faqListContainer = { display: 'flex', flexDirection: 'column' as any, gap: '16px' };
const faqItemStyle = { borderRadius: "3px", padding: '20px 32px', cursor: 'default', transition: 'all 0.3s' };
const questionBtn = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', backgroundColor: 'transparent', padding: '16px 0', cursor: 'pointer', gap: '20px' };
const answerText = { padding: '8px 0 24px', color: '#64748b', fontSize: '16px', lineHeight: 1.7 };

const emptyStateStyle = { textAlign: 'center' as any, padding: '80px 40px', backgroundColor: 'white', borderRadius: "3px", border: '2px dashed #f1f5f9', color: '#64748b' };
const footerCta = { marginTop: '100px', padding: '40px', backgroundColor: 'white', borderRadius: "3px", border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as any, gap: '32px' };
const messageIconBox = { width: '64px', height: '64px', borderRadius: "3px", backgroundColor: '#263A99', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const supportBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 28px', borderRadius: "3px", backgroundColor: '#0088cc', color: 'white', fontWeight: 800, textDecoration: 'none', transition: 'all 0.3s' };
