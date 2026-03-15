'use client';

import { useTheme } from '@/components/providers/ThemeProvider';
import { motion } from 'framer-motion';
import Link from 'next/link';

export function DynamicPromo({ blockName }: { blockName: string }) {
    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === blockName);

    if (!block || !block.is_visible) return null;

    const style = block.style_metadata || {};
    const title = content[`${blockName}_title`] || 'Заголовок акції';
    const subtitle = content[`${blockName}_subtitle`] || 'Опис вашої спеціальної пропозиції...';
    const buttonText = content[`${blockName}_button`] || 'Детальніше';
    const imageUrl = content[`${blockName}_image_url`];

    return (
        <section
            style={{
                backgroundColor: style.bg_color || '#ffffff',
                padding: style.padding || '80px 0',
                borderRadius: style.border_radius || '0px'
            }}
            className="w-full relative overflow-hidden"
        >
            <div className="container mx-auto px-4">
                <div className={`flex flex-col md:flex-row items-center gap-12 ${style.reverse ? 'md:flex-row-reverse' : ''}`}>
                    {imageUrl && (
                        <div className="flex-1">
                            <motion.img
                                initial={{ opacity: 0, x: style.reverse ? 50 : -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                src={imageUrl}
                                alt={title}
                                className="w-full h-auto rounded-[3px] shadow-xl"
                                style={{ borderRadius: style.image_radius || '1rem' }}
                            />
                        </div>
                    )}
                    <div className="flex-1 text-center md:text-left">
                        <motion.span
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-4 block"
                        >
                            Акція
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-bold mb-6"
                            style={{ color: style.text_color || 'inherit', fontSize: style.title_size || '3rem' }}
                        >
                            {title}
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg opacity-80 mb-8 max-w-xl"
                            style={{ color: style.text_color || 'inherit' }}
                        >
                            {subtitle}
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Link
                                href="/products"
                                className="inline-block bg-blue-600 text-white px-10 py-4 rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                            >
                                {buttonText}
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
