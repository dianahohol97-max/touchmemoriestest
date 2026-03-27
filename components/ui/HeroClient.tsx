'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '@/components/providers/ThemeProvider';
import { PRODUCT_IMAGES } from '@/lib/productImages';

const easing = [0.25, 0.46, 0.45, 0.94] as any;

interface HeroContent {
    id: string;
    overline_text: string;
    title_line1: string;
    title_line2: string;
    subtitle: string;
    background_image_url: string;
    is_active: boolean;
}

interface HeroButton {
    id: string;
    button_text: string;
    button_url: string;
    display_order: number;
    row_number: number;
    is_active: boolean;
}

interface HeroClientProps {
    heroContent?: HeroContent;
    heroButtons: HeroButton[];
}

export function HeroClient({ heroContent, heroButtons }: HeroClientProps) {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'hero');
    const style = block?.style_metadata || {};

    // Use database content or fallback to theme provider or hardcoded defaults
    const overlineText = heroContent?.overline_text || content['hero_overline'] || "Збережіть найкращі моменти";
    const titleLine1 = heroContent?.title_line1 || "Зберігайте найкращі";
    const titleLine2 = heroContent?.title_line2 || "моменти назавжди";
    const subtitleText = heroContent?.subtitle || content['hero_subtitle'] || "Фотокниги, тревел-буки, журнали та інша поліграфія ручної роботи з Тернополя";
    const bgImage = heroContent?.background_image_url || content['hero_image_url'] || PRODUCT_IMAGES.hero;

    // Group buttons by row number
    const buttonsByRow = heroButtons.reduce((acc, button) => {
        if (!acc[button.row_number]) {
            acc[button.row_number] = [];
        }
        acc[button.row_number].push(button);
        return acc;
    }, {} as Record<number, HeroButton[]>);

    const rows = Object.keys(buttonsByRow).map(Number).sort((a, b) => a - b);

    return (
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-20 bg-transparent rounded-none section-padding">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src={bgImage}
                    alt="Hero background"
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
                        <span className="block">{titleLine1}</span>
                        <span className="block">{titleLine2}</span>
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

                {/* Product Category Buttons - Dynamic from Database */}
                {heroButtons.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }}
                        className="flex flex-col gap-3"
                    >
                        {rows.map((rowNum) => (
                            <div key={rowNum} className="flex gap-3 flex-wrap">
                                {buttonsByRow[rowNum].map((button) => (
                                    <Link
                                        key={button.id}
                                        href={button.button_url}
                                        className="bg-white text-[#1e2d7d] border border-[#1e2d7d] hover:bg-[#f0f2f8] font-semibold px-7 py-3.5 rounded-lg transition-colors duration-200"
                                    >
                                        {button.button_text}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        </section>
    );
}
