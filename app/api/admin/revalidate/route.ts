import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { path } = await req.json();
        if (path) {
            revalidatePath(path);
            console.log(`Revalidated path: ${path}`);
            return NextResponse.json({ revalidated: true, now: Date.now() });
        }
        return NextResponse.json({ revalidated: false, message: 'Missing path' }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ revalidated: false, message: 'Error revalidating' }, { status: 500 });
    }
}
