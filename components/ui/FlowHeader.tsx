'use client';
import Link from 'next/link';

/**
 * Minimal top bar for full-screen flows (designer order, constructors) that
 * don't render the full site Navigation. Gives the customer a clear way out:
 * both the logo and the "На головну" link return to the home page. Sticky and
 * in normal flow, so it needs no top-padding compensation from the page.
 */
export default function FlowHeader() {
    return (
        <div className="sticky top-0 z-40 w-full bg-white border-b border-gray-100">
            <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
                <Link
                    href="/"
                    className="font-heading font-extrabold text-[16px] tracking-[0.08em] text-[#1e2d7d] no-underline hover:opacity-90 whitespace-nowrap"
                >
                    TOUCH.MEMORIES
                </Link>
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1e2d7d]/70 hover:text-[#1e2d7d] no-underline transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    На головну
                </Link>
            </div>
        </div>
    );
}
