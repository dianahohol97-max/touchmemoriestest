'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen } from 'lucide-react';
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

    // Default posts if none are provided (for demonstration or empty state)
    const displayPosts: BlogPost[] = posts.length > 0 ? posts.slice(0, 3) : [
        {
            id: '1',
            title: 'Мистецтво мінімалізму: Як обрати обкладинку для вашої книги',
            slug: 'minimalism-art',
            excerpt: 'Дізнайтеся, як текстура тканини та колір форзацу можуть змінити сприйняття фотокниги.',
            cover_image: '/images/blog/interior.png',
            cover_image_alt: 'Фото інтер\'єру з фотокнигами',
            reading_time: 5,
            published_at: new Date().toISOString(),
            category: { name: 'Поради', slug: 'tips' }
        },
        {
            id: '2',
            title: 'Весільний альбом: 5 кроків до ідеальної історії кохання',
            slug: 'wedding-story',
            excerpt: 'Від підбору знімків до композиційних рішень, які збережуть ваші емоції на все життя.',
            cover_image: '/images/blog/wedding.png',
            cover_image_alt: 'Весільний фотоальбом',
            reading_time: 7,
            published_at: new Date().toISOString(),
            category: { name: 'Весілля', slug: 'wedding' }
        },
        {
            id: '3',
            title: 'Сімейні архіви: Чому важливо друкувати фотографії сьогодні',
            slug: 'family-archives',
            excerpt: 'Цифрові кадри легко втратити, але паперові спогади стають сімейною реліквією.',
            cover_image: '/images/blog/family.png',
            cover_image_alt: 'Сімейна історія в альбомі',
            reading_time: 6,
            published_at: new Date().toISOString(),
            category: { name: 'Блог', slug: 'blog' }
        }
    ];

    return (
        <section ref={ref} className="section-padding bg-white overflow-hidden">
            <div className="container">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-center mb-16"
                >
                    <h2 className="text-[40px] lg:text-[56px] font-black text-primary leading-none tracking-tight mb-4">
                        {content['blog_title'] || 'Ідеї та натхнення'}
                    </h2>
                    <div className="w-24 h-1 bg-primary/10 mx-auto rounded-full" />
                </motion.div>

                {/* Magazine Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-14">
                    {displayPosts.map((post, index) => (
                        <motion.article
                            key={post.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: index * 0.15 }}
                            className="group"
                        >
                            <Link href={`/blog/${post.slug}`} className="block">
                                {/* Image Container */}
                                <div className="relative aspect-[4/5] mb-8 rounded-[3px] overflow-hidden shadow-[var(--card-shadow)] bg-gray-100 group-hover:shadow-[var(--card-shadow-hover)] transition-all duration-500">
                                    <Image
                                        src={post.cover_image || '/images/promo/photo_print_premium.png'}
                                        alt={post.cover_image_alt || post.title}
                                        fill
                                        className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                    />
                                    {/* Glassmorphic Category Tag */}
                                    {post.category && (
                                        <div className="absolute top-6 left-6 px-4 py-2 bg-white/80 backdrop-blur-md rounded-[3px] text-[10px] font-black uppercase tracking-widest text-primary shadow-sm border border-white/20">
                                            {post.category.name}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="space-y-4">
                                    <h3 className="text-2xl lg:text-3xl font-bold text-primary leading-tight tracking-tight group-hover:text-primary/70 transition-colors duration-300">
                                        {post.title}
                                    </h3>
                                    <p className="text-slate-500 font-medium leading-relaxed line-clamp-2">
                                        {post.excerpt}
                                    </p>

                                    <div className="pt-2">
                                        <span className="inline-flex items-center text-[13px] font-bold uppercase tracking-[0.15em] text-primary group-hover:gap-3 transition-all duration-300">
                                            Читати
                                            <ArrowRight size={16} className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </motion.article>
                    ))}
                </div>

                {/* View All Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="mt-20 text-center"
                >
                    <Link
                        href="/blog"
                        className="btn-secondary"
                    >
                        Читати всі статті
                        <BookOpen size={18} className="ml-2" />
                    </Link>
                </motion.div>
            </div>

            {/* Background Accent */}
            <div className="absolute -z-10 top-1/2 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </section>
    );
}
