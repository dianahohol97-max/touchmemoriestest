'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { ArrowRight, BookHeart } from 'lucide-react';

export function FinalCTA() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    return (
        <section ref={ref} className="bg-stone-900 text-white py-24 overflow-hidden relative">
            {/* Decorative Background Patterns */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none" />
            <div className="absolute -top-64 -right-64 w-[800px] h-[800px] bg-white/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
                    {/* Left Side: Text Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                        {/* Label */}
                        <p className="text-xs text-[#4a5cc7] tracking-widest uppercase mb-4 font-semibold">
                            КНИГА ПОБАЖАНЬ
                        </p>

                        {/* Main Heading */}
                        <h2 className="text-4xl lg:text-5xl font-black leading-tight mb-6">
                            Зробіть своє свято незабутнім
                        </h2>

                        {/* Subtext */}
                        <p className="text-lg text-stone-300 leading-relaxed mb-10">
                            Книга побажань — це місце, де ваші гості залишать найтепліші слова та побажання.
                            Ідеальний подарунок на весілля, день народження чи іншу особливу подію.
                        </p>

                        {/* Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link
                                href="/constructor/guestbook"
                                className="inline-flex items-center justify-center gap-3 bg-white text-[#1e2d7d] px-8 py-4 rounded-full font-bold text-lg shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200"
                            >
                                <BookHeart size={20} />
                                Створити книгу побажань
                            </Link>
                            <Link
                                href="/catalog?category=guestbooks"
                                className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white/30 text-white px-8 py-4 rounded-full font-bold text-lg hover:border-white hover:bg-white/10 transition-all duration-200"
                            >
                                Переглянути зразки
                                <ArrowRight size={18} />
                            </Link>
                        </div>
                    </motion.div>

                    {/* Right Side: Constructor Visualization */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                        className="relative"
                    >
                        {/* Guest Book Mockup */}
                        <div className="relative mx-auto max-w-md">
                            {/* Book Shadow */}
                            <div className="absolute inset-0 bg-white/10 blur-3xl transform translate-y-8" />

                            {/* Book Cover */}
                            <div className="relative bg-gradient-to-br from-[#eef0fb] to-stone-100 rounded-lg overflow-hidden shadow-2xl">
                                <div className="aspect-[3/4] relative">
                                    {/* Cover Design */}
                                    <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center">
                                        <div className="w-24 h-24 mb-6 bg-gradient-to-br from-[#1e2d7d] to-[#152158] rounded-full flex items-center justify-center shadow-lg">
                                            <BookHeart size={48} className="text-white" strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-2xl font-serif font-bold text-stone-800 mb-2">
                                            Книга Побажань
                                        </h3>
                                        <div className="w-32 h-px bg-stone-400 mb-4" />
                                        <p className="text-stone-600 text-sm font-serif italic">
                                            Весілля<br />
                                            Олени та Максима
                                        </p>
                                        <p className="text-stone-500 text-xs mt-4">
                                            15.06.2025
                                        </p>
                                    </div>

                                    {/* Decorative Border */}
                                    <div className="absolute inset-4 border-2 border-[#1e2d7d]/20 rounded pointer-events-none" />
                                </div>

                                {/* Book Spine Effect */}
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#152158] via-[#0f1a45] to-[#152158]" />
                            </div>

                            {/* Floating Elements */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.5 }}
                                className="absolute -top-4 -right-4 bg-[#4a5cc7] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold"
                            >
                                від 450 ₴
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.7 }}
                                className="absolute -bottom-4 -left-4 bg-white/90 backdrop-blur-sm text-stone-800 px-4 py-2 rounded-lg shadow-lg text-xs"
                            >
                                50+ сторінок
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
