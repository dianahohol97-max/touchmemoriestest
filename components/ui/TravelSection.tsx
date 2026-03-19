'use client';
import { motion } from 'framer-motion';
import styles from './TravelSection.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    cover_image: string;
    cover_image_alt: string;
    reading_time: number;
    published_at: string;
    category?: {
        name: string;
        slug: string;
    };
}

interface TravelSectionProps {
    travelPost?: BlogPost | null;
}

export function TravelSection({ travelPost }: TravelSectionProps) {
    if (!travelPost) return null;

    const { content, blocks } = useTheme();
    const block = blocks.find(b => b.block_name === 'travel');
    const style = block?.style_metadata || {};

    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const embed = content['travel_embed'];

    return (
        <section ref={ref} className="section-padding bg-gray-50/50 pb-20">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center mb-16"
                >
                    <h2 className="text-[40px] lg:text-[56px] font-black leading-[1.0] tracking-tight text-primary">
                        Travelbook
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    {/* Left Column - Featured Travel Article & Locations */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="lg:col-span-5 flex flex-col gap-8"
                    >
                        {/* Top Locations Block */}
                        <div className="bg-white border border-gray-100 rounded-[3px] p-10 flex flex-col items-center text-center justify-center shadow-[var(--shadow-subtle)]">
                            <MapPin size={48} className="text-primary/30 mb-6" />
                            <h3 className="font-heading text-2xl font-bold mb-4 text-primary">
                                {content['travel_locations_title'] || 'Top Locations'}
                            </h3>
                            <p className="text-primary/60 leading-relaxed text-sm">
                                {content['travel_locations_desc'] || 'Найкращі локації для ваших подорожей та фотосесій. Створюйте неймовірні кадри.'}
                            </p>
                        </div>

                        {/* Travel Article Block */}
                        {travelPost ? (
                            <Link
                                href={`/blog/${travelPost.slug}`}
                                className="bg-white/5 border border-white/10 rounded-[3px] overflow-hidden group flex-1 flex flex-col transition-all hover:bg-white/10 relative"
                            >
                                <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1.5 rounded-[3px] text-[10px] font-black uppercase tracking-widest z-10">
                                    {travelPost.category?.name || 'Travel'}
                                </div>

                                <div className="relative w-full aspect-[16/9] bg-white/5 overflow-hidden">
                                    {travelPost.cover_image ? (
                                        <Image
                                            src={travelPost.cover_image}
                                            alt={travelPost.cover_image_alt || travelPost.title}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                                            <MapPin size={40} className="text-white/20" />
                                        </div>
                                    )}
                                </div>

                                <div className="p-10 flex flex-col flex-1 text-center justify-center bg-white border border-gray-100 border-t-0 rounded-b-[3px]">
                                    <h3 className="font-heading text-2xl font-bold mb-4 leading-tight text-primary">
                                        {travelPost.title}
                                    </h3>
                                    <div className="flex items-center justify-center gap-2 text-primary/50 text-sm mt-auto">
                                        <span className="font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
                                            Читати історію <ArrowRight size={14} />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ) : null}
                    </motion.div>

                    {/* Right Column - Travel Book CTA */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="lg:col-span-7 bg-white text-primary rounded-[3px] p-12 lg:p-20 flex flex-col justify-center items-center text-center shadow-[var(--shadow-premium)] relative overflow-hidden"
                    >
                        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                        {/* Media Display */}
                        <div className="relative w-full aspect-[4/3] mb-12 flex items-center justify-center rounded-[3px] overflow-hidden shadow-[var(--shadow-premium)]">
                            <Image
                                src="/images/promo/travel_book_premium.png"
                                alt="Travel Book"
                                fill
                                className="object-cover transition-transform duration-700 hover:scale-105"
                            />
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
