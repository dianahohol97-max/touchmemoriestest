'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';

const easing = [0.25, 0.46, 0.45, 0.94] as any;

export function Hero() {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'hero');
    const style = block?.style_metadata || {};

    const overlineText = content['hero_overline'] || "Збережіть найкращі моменти";
    const titleText = content['hero_title'] || "Доторкнись\nдо спогадів";
    const subtitleText = content['hero_subtitle'] || "Створюйте власні історії у форматі преміальних фотокниг та журналів. Ваші найкращі моменти заслуговують на друк.";
    const buttonText = content['hero_button_text'] || "В магазин";
    const bgImage = content['hero_image_url'] || "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1920&q=80";

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const wordVariants = {
        hidden: { opacity: 0, y: 40 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.8, ease: easing },
        },
    };

    return (
        <section style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            paddingTop: '80px',
            backgroundColor: style.bg_color || 'transparent',
            borderRadius: style.border_radius || '0px'
        }}>
            {/* Background Image */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <img
                    src={bgImage}
                    alt="Family reading a photo book"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                />
                {/* Gradient Overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}></div>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }}></div>
            </div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 10, paddingLeft: 'min(5vw, 40px)', paddingRight: '20px' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easing }}
                    style={{ marginBottom: '16px' }}
                >
                    <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: style.text_color || 'rgba(255,255,255,0.9)' }}>
                        {overlineText}
                    </span>
                </motion.div>

                <motion.h1
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 900,
                        fontSize: 'clamp(36px, 8vw, 80px)',
                        lineHeight: 1.05,
                        letterSpacing: '-0.02em',
                        color: style.text_color || 'white',
                        marginBottom: '24px',
                        maxWidth: '800px'
                    }}
                >
                    {titleText.split('\n').map((line: string, idx: number) => (
                        <div key={idx} style={{ overflow: 'hidden', paddingBottom: '8px' }}>
                            <motion.span variants={wordVariants} style={{ display: 'inline-block' }}>{line}</motion.span>
                        </div>
                    ))}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easing, delay: 0.3 }}
                    style={{ fontSize: '20px', color: style.text_color || 'rgba(255,255,255,0.9)', maxWidth: '480px', marginBottom: '48px', fontWeight: 500, opacity: style.text_color ? 1 : 0.9 }}
                >
                    {subtitleText}
                </motion.p>

                {/* Actions - 2+2+1 Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }}
                    style={{ maxWidth: '500px' }}
                >
                    {/* Row 1: Глянцевий журнал + Фотокнига */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <Link href="/catalog?category=magazines" style={{
                            height: '56px',
                            padding: '0 24px',
                            backgroundColor: style.hero_btn_bg || 'white',
                            color: style.hero_btn_text || '#000',
                            fontWeight: 700,
                            fontSize: '16px',
                            borderRadius: 'var(--button-radius)',
                            boxShadow: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'transform 0.2s, background-color 0.2s',
                        }} className="hover-lift">
                            Глянцевий журнал
                        </Link>
                        <Link href="/catalog?category=photobooks" style={{
                            height: '56px',
                            padding: '0 24px',
                            backgroundColor: style.hero_btn_bg || 'white',
                            color: style.hero_btn_text || '#000',
                            fontWeight: 700,
                            fontSize: '16px',
                            borderRadius: 'var(--button-radius)',
                            boxShadow: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'transform 0.2s, background-color 0.2s',
                        }} className="hover-lift">
                            Фотокнига
                        </Link>
                    </div>

                    {/* Row 2: Фотодрук + Travel book */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <Link href="/catalog?category=photo-print" style={{
                            height: '56px',
                            padding: '0 24px',
                            backgroundColor: style.hero_btn_bg || 'white',
                            color: style.hero_btn_text || '#000',
                            fontWeight: 700,
                            fontSize: '16px',
                            borderRadius: 'var(--button-radius)',
                            boxShadow: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'transform 0.2s, background-color 0.2s',
                        }} className="hover-lift">
                            Фотодрук
                        </Link>
                        <Link href="/catalog?category=travelbook" style={{
                            height: '56px',
                            padding: '0 24px',
                            backgroundColor: style.hero_btn_bg || 'white',
                            color: style.hero_btn_text || '#000',
                            fontWeight: 700,
                            fontSize: '16px',
                            borderRadius: 'var(--button-radius)',
                            boxShadow: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'transform 0.2s, background-color 0.2s',
                        }} className="hover-lift">
                            Travel book
                        </Link>
                    </div>

                    {/* Row 3: В магазин (half width, primary) */}
                    <Link href="/catalog" style={{
                        height: '56px',
                        padding: '0 32px',
                        backgroundColor: 'var(--section-button-bg)',
                        color: 'var(--section-button-text)',
                        fontWeight: 700,
                        fontSize: '16px',
                        borderRadius: 'var(--button-radius)',
                        boxShadow: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        transition: 'transform 0.2s, background-color 0.2s',
                        width: '50%',
                    }} className="hover-lift">
                        В магазин
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
