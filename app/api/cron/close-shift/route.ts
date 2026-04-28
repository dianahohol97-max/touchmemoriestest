import { NextResponse } from 'next/server';
import { CheckboxService } from '@/lib/checkbox';

export async function GET(req: Request) {
    try {
        // Basic Auth or Secret Header check for Cron security
        const authHeader = req.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const checkbox = new CheckboxService({
            login: process.env.CHECKBOX_LOGIN!,
            password: process.env.CHECKBOX_PASSWORD!,
            licenseKey: process.env.CHECKBOX_LICENSE_KEY!
        });

        const result = await checkbox.closeShift();

        return NextResponse.json({
            status: 'success',
            message: result ? 'Shift closed successfully' : 'No open shift found',
            data: result
        });

    } catch (error: any) {
        console.error('Cron Error (Close Shift):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
