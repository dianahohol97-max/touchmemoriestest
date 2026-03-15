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
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-20 bg-transparent rounded-none">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src={bgImage}
                    alt="Family reading a photo book"
                    className="w-full h-full object-cover object-center"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent"></div>
                <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 pl-[min(5vw,40px)] pr-5">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easing }}
                    className="mb-4"
                >
                    <span className="text-[12px] uppercase tracking-widest font-semibold text-white/90">
                        {overlineText}
                    </span>
                </motion.div>

                <motion.h1
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="font-heading font-black text-6xl md:text-6xl leading-[1.05] tracking-tight text-white mb-8 max-w-[800px]"
                >
                    {titleText.split('\n').map((line: string, idx: number) => (
                        <div key={idx} className="overflow-hidden pb-2">
                            <motion.span variants={wordVariants} className="inline-block">{line}</motion.span>
                        </div>
                    ))}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easing, delay: 0.3 }}
                    className="font-body text-lg text-white/90 max-w-[480px] mb-12 font-medium leading-relaxed"
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <Link href="/catalog?category=magazines" style={{
                            height: '52px',
                            backgroundColor: 'white',
                            color: '#263A99',
                            fontWeight: 700,
                            fontSize: '15px',
                            borderRadius: "3px",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }} className="hover-lift">
                            Глянцевий журнал
                        </Link>
                        <Link href="/catalog?category=photobooks" style={{
                            height: '52px',
                            backgroundColor: 'white',
                            color: '#263A99',
                            fontWeight: 700,
                            fontSize: '15px',
                            borderRadius: "3px",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }} className="hover-lift">
                            Фотокнига
                        </Link>
                    </div>

                    {/* Row 2: Фотодрук + Travel book */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <Link href="/catalog?category=photo-print" style={{
                            height: '52px',
                            backgroundColor: 'white',
                            color: '#263A99',
                            fontWeight: 700,
                            fontSize: '15px',
                            borderRadius: "3px",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }} className="hover-lift">
                            Фотодрук
                        </Link>
                        <Link href="/catalog?category=travelbook" style={{
                            height: '52px',
                            backgroundColor: 'white',
                            color: '#263A99',
                            fontWeight: 700,
                            fontSize: '15px',
                            borderRadius: "3px",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }} className="hover-lift">
                            Travel book
                        </Link>
                    </div>

                    {/* Row 3: В магазин (half width, primary) */}
                    <Link href="/catalog" style={{
                        height: '52px',
                        backgroundColor: '#263A99',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '15px',
                        borderRadius: "3px",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        transition: 'background-color 0.2s',
                        width: '50%',
                    }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d2d7a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#263A99'}
                    >
                        В магазин
                    </Link>

                </motion.div>
            </div>
        </section>
    );
}
