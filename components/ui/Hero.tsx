'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { PRODUCT_IMAGES } from '@/lib/productImages';

const easing = [0.25, 0.46, 0.45, 0.94] as any;

export function Hero() {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'hero');
    const style = block?.style_metadata || {};

    const overlineText = content['hero_overline'] || "Збережіть найкращі моменти";
    const titleText = content['hero_title'] || "Зберігайте найкращі\nмоменти назавжди";
    const subtitleText = content['hero_subtitle'] || "Фотокниги, тревел-буки, журнали та інша поліграфія ручної роботи з Тернополя";
    const buttonText = content['hero_button_text'] || "В магазин";
    const bgImage = content['hero_image_url'] || PRODUCT_IMAGES.hero;

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
                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-black/40"></div>
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

                <div className="overflow-hidden">
                    <motion.h1
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="font-heading font-black text-5xl md:text-6xl leading-[1.05] tracking-tight text-white mb-8 max-w-[800px]"
                    >
                        {titleText.split('\n').map((line: string, idx: number) => (
                            <span key={idx} className="block">{line}</span>
                        ))}
                    </motion.h1>
                </div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easing, delay: 0.3 }}
                    className="font-body text-lg text-white/90 max-w-[480px] mb-12 font-medium leading-relaxed"
                >
                    {subtitleText}
                </motion.p>


                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }}
                    className="flex flex-wrap gap-4"
                >
                    <Link
                        href="/constructor/photobook"
                        className="inline-flex items-center justify-center h-14 px-8 bg-stone-800 text-white font-bold text-sm uppercase tracking-widest rounded-sm transition-all hover:bg-stone-700 hover:shadow-lg"
                    >
                        Створити фотокнигу
                    </Link>
                    <Link
                        href="/catalog"
                        className="inline-flex items-center justify-center h-14 px-8 bg-transparent text-white font-bold text-sm uppercase tracking-widest rounded-sm border-2 border-white transition-all hover:bg-white hover:text-stone-800"
                    >
                        Переглянути каталог
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
