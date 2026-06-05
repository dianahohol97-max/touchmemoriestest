import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { path, type } = await req.json();
        if (path) {
            // For dynamic routes (e.g. '/[locale]') Next requires the route
            // pattern plus a type ('page' | 'layout'). Literal paths work without.
            if (type === 'page' || type === 'layout') {
                revalidatePath(path, type);
            } else {
                revalidatePath(path);
            }
            console.log(`Revalidated path: ${path}${type ? ` (${type})` : ''}`);
            return NextResponse.json({ revalidated: true, now: Date.now() });
        }
        return NextResponse.json({ revalidated: false, message: 'Missing path' }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ revalidated: false, message: 'Error revalidating' }, { status: 500 });
    }
}
