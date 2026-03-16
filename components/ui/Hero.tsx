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
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-20 bg-transparent rounded-none section-padding">
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
                        <div key={idx} className="overflow-hidden pb-1">
                            <motion.span variants={wordVariants} className="inline-block tracking-[-0.03em]">{line}</motion.span>
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
                    className="max-w-[600px]"
                >
                    {/* Row 1: Глянцевий журнал + Фотокнига */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Link href="/catalog?category=magazines" className="h-[52px] bg-white/95 backdrop-blur-md text-primary font-bold text-[15px] rounded-[3px] flex items-center justify-center no-underline transition-all shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:-translate-y-0.5">
                            Глянцевий журнал
                        </Link>
                        <Link href="/catalog?category=photobooks" className="h-[52px] bg-white/95 backdrop-blur-md text-primary font-bold text-[15px] rounded-[3px] flex items-center justify-center no-underline transition-all shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:-translate-y-0.5">
                            Фотокнига
                        </Link>
                    </div>

                    {/* Row 2: Фотодрук + Travel book */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Link href="/catalog?category=photo-print" className="h-[52px] bg-white/95 backdrop-blur-md text-primary font-bold text-[15px] rounded-[3px] flex items-center justify-center no-underline transition-all shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:-translate-y-0.5">
                            Фотодрук
                        </Link>
                        <Link href="/catalog?category=travelbook" className="h-[52px] bg-white/95 backdrop-blur-md text-primary font-bold text-[15px] rounded-[3px] flex items-center justify-center no-underline transition-all shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:-translate-y-0.5">
                            Travel book
                        </Link>
                    </div>

                    {/* Row 3: В магазин (half width, primary) */}
                    <Link href="/catalog" className="btn-primary w-1/2 !h-[52px] text-[15px] shadow-[0_4px_12px_rgba(38,58,153,0.2)] hover:shadow-[0_8px_24px_rgba(38,58,153,0.3)]">
                        В магазин
                    </Link>

                </motion.div>
            </div>
        </section>
    );
}
