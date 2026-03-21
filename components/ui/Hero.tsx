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


                {/* Product Category Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }}
                    className="flex flex-col gap-3"
                >
                    {/* Row 1: Фотокнига */}
                    <div className="flex gap-3">
                        <Link href="/catalog?category=photobooks" className="bg-white text-[#263a99] font-bold px-6 py-3 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200">
                            Фотокнига
                        </Link>
                    </div>
                    {/* Row 2: Фотодрук + Travel Book + Глянцеві журнали */}
                    <div className="flex gap-3 flex-wrap">
                        <Link href="/catalog?category=prints" className="bg-white text-[#263a99] font-bold px-6 py-3 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200">
                            Фотодрук
                        </Link>
                        <Link href="/catalog?category=travelbooks" className="bg-white text-[#263a99] font-bold px-6 py-3 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200">
                            Travel Book
                        </Link>
                        <Link href="/catalog?category=hlyantsevi-zhurnaly" className="bg-white text-[#263a99] font-bold px-6 py-3 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200">
                            Глянцеві журнали
                        </Link>
                    </div>
                    {/* Row 3: Книга побажань + В магазин */}
                    <div className="flex gap-3 flex-wrap items-center">
                        <Link href="/catalog?category=guestbooks" className="bg-white text-[#263a99] font-bold px-6 py-3 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200">
                            Книга побажань
                        </Link>
                        <Link href="/catalog" className="bg-[#263a99] hover:bg-[#1a2966] text-white font-bold text-base px-9 py-4 rounded-full transition-all duration-200 shadow-[0_4px_20px_rgba(38,58,153,0.35)] hover:-translate-y-1">
                            В магазин
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
