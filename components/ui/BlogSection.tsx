'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
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

interface BlogSectionProps {
    posts?: BlogPost[];
}

export function BlogSection({ posts = [] }: BlogSectionProps) {
    const { content } = useTheme();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <section ref={ref} className="section-padding bg-gray-50/50">
            <div className="container">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-center mb-16"
                >
                    <h2 className="section-title text-center">
                        {content['blog_title'] || 'Блог'}
                    </h2>
                    <p className="section-subtitle text-center">
                        {content['blog_subtitle'] || 'Натхнення, ідеї та поради від команди Touch Memories'}
                    </p>
                </motion.div>

                {/* Blog Posts Grid */}
                {posts.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                            {posts.map((post, index) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={inView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ duration: 0.6, delay: index * 0.1 }}
                                >
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        className="bg-white rounded-[3px] overflow-hidden border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-premium)] h-full flex flex-col group block"
                                    >
                                        {/* Cover Image */}
                                        <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
                                            {post.cover_image ? (
                                                <Image
                                                    src={post.cover_image}
                                                    alt={post.cover_image_alt || post.title}
                                                    fill
                                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                                                    Зображення відсутнє
                                                </div>
                                            )}
                                            {post.category && (
                                                <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1.5 rounded-[3px] text-[10px] font-black uppercase tracking-widest z-10">
                                                    {post.category.name}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="p-8 flex-1 flex flex-col">
                                            <h3 className="font-heading text-2xl font-bold mb-4 leading-tight line-clamp-2 text-primary group-hover:text-primary/70 transition-colors">
                                                {post.title}
                                            </h3>

                                            <p className="text-gray-500 leading-relaxed mb-6 flex-1 line-clamp-3">
                                                {post.excerpt}
                                            </p>

                                            {/* Meta Info */}
                                            <div className="flex items-center gap-6 text-sm text-gray-400 pt-6 border-t border-gray-100">
                                                <span className="flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    {formatDate(post.published_at)}
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <Clock size={14} />
                                                    {post.reading_time} хв
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>

                        {/* Read All Articles Button */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="text-center"
                        >
                            <Link href="/blog" className="btn-secondary">
                                Читати всі статті
                                <ArrowRight size={20} className="ml-2" />
                            </Link>
                        </motion.div>
                    </>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 1 } : {}}
                        transition={{ duration: 0.6 }}
                        className="text-center py-20 bg-white rounded-[3px] border border-dashed border-gray-200"
                    >
                        <p className="text-lg text-gray-400">
                            Скоро тут з'являться цікаві статті
                        </p>
                    </motion.div>
                )}
            </div>
        </section>
    );
}
