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
        <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-20">
            <div className="container mx-auto px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                {/* Left: Content */}
                <div className="relative z-10 order-2 lg:order-1">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: easing }}
                        className="mb-8"
                    >
                        <span className="text-[14px] uppercase tracking-[0.2em] font-extrabold text-primary/60">
                            {overlineText}
                        </span>
                    </motion.div>

                    <motion.h1
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="font-heading font-extrabold text-5xl md:text-7xl lg:text-[72px] leading-[1.05] tracking-tight text-primary mb-10"
                    >
                        {titleText.split('\n').map((line: string, idx: number) => (
                            <div key={idx} className="overflow-hidden pb-1">
                                <motion.span variants={wordVariants} className="inline-block tracking-[-0.04em]">{line}</motion.span>
                            </div>
                        ))}
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: easing, delay: 0.3 }}
                        className="font-body text-lg text-primary/70 max-w-[480px] mb-12 font-medium leading-relaxed"
                    >
                        {subtitleText}
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: easing, delay: 0.5 }}
                        className="flex flex-col sm:flex-row gap-4"
                    >
                        <Link href="/catalog?category=photobooks" className="btn-primary">
                            Створити фотокнигу
                        </Link>
                        <Link href="/catalog" className="btn-secondary">
                            Переглянути каталог
                        </Link>
                    </motion.div>
                </div>

                {/* Right: Product Visual Focus */}
                <div className="relative order-1 lg:order-2 h-[400px] lg:h-[600px] rounded-brand overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] group">
                    <motion.img
                        initial={{ scale: 1.1, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                        src={bgImage}
                        alt="Touch Memories Premium Book"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-transparent transition-colors"></div>
                </div>
            </div>
        </section>
    );
}
