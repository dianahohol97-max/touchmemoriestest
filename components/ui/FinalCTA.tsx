'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';

export function FinalCTA() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    return (
        <section ref={ref} className="bg-[#f0f2f8] py-24 overflow-hidden relative">

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
                    {/* Left Side: Text Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                        {/* Main Heading */}
                        <h2 className="text-[#1e2d7d] font-bold text-3xl lg:text-4xl leading-tight mb-6">
                            Книга побажань — зробіть своє свято незабутнім
                        </h2>

                        {/* Subtext */}
                        <p className="text-lg text-gray-700 leading-relaxed mb-10">
                            Книга побажань — це місце, де ваші гості залишать найтепліші слова та побажання.
                            Ідеальний подарунок на весілля, день народження чи іншу особливу подію.
                        </p>

                        {/* Buttons */}
                        <div className="flex gap-3 flex-wrap">
                            <Link
                                href="https://pro.fotobookplus.com/ua/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-[#263a99] transition-colors duration-200"
                            >
                                Відкрити конструктор
                            </Link>
                            <Link
                                href="/kontakty"
                                className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-lg transition-colors text-center"
                            >
                                Оформити з дизайнером
                            </Link>
                        </div>
                    </motion.div>

                    {/* Right Side: 3x3 Photo Grid */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                        className="relative"
                    >
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div key={i} className="aspect-square bg-gray-300 rounded-lg overflow-hidden">
                                    <img
                                        src={`/images/wishbook-${i + 1}.jpg`}
                                        alt={`Книга побажань ${i + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
