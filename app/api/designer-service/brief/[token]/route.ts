import { NextRequest, NextResponse } from 'next/server';
import { getDesignBriefByToken, isBriefAccessible } from '@/lib/designer-service/brief-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Check if brief is accessible
    const isAccessible = await isBriefAccessible(token);
    if (!isAccessible) {
      return NextResponse.json(
        { error: 'Brief not accessible. Order must be paid and have designer service.' },
        { status: 403 }
      );
    }

    // Get brief data
    const brief = await getDesignBriefByToken(token);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(brief);
  } catch (error) {
    console.error('Error fetching brief:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brief' },
      { status: 500 }
    );
  }
}
