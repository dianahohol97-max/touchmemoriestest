import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        const body = await request.json();
        const { slug, paths } = body;

        // Revalidate specific product page
        if (slug) {
            revalidatePath(`/[locale]/catalog/${slug}`, 'page');
            revalidatePath(`/uk/catalog/${slug}`);
            revalidatePath(`/en/catalog/${slug}`);
            revalidatePath(`/ro/catalog/${slug}`);
            revalidatePath(`/pl/catalog/${slug}`);
            revalidatePath(`/de/catalog/${slug}`);
        }

        // Revalidate catalog and homepage
        revalidatePath('/[locale]/catalog', 'page');
        revalidatePath('/[locale]', 'page');

        // Revalidate specific paths if provided
        if (paths && Array.isArray(paths)) {
            paths.forEach((p: string) => revalidatePath(p));
        }

        return NextResponse.json({ revalidated: true, slug, timestamp: Date.now() });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
