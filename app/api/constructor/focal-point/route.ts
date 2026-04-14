import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ x: 50, y: 40, hasFace: false });
    }

    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ x: 50, y: 40, hasFace: false });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Find the most important subject (face, person, or main object) in this photo. Return ONLY a JSON object: {"x":45,"y":35,"hasFace":true} where x/y are 0-100% coordinates of the focal point center. No other text.',
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const x = Math.max(10, Math.min(90, Number(parsed.x) || 50));
      const y = Math.max(10, Math.min(90, Number(parsed.y) || 40));
      return NextResponse.json({ x, y, hasFace: !!parsed.hasFace });
    }
    return NextResponse.json({ x: 50, y: 40, hasFace: false });
  } catch {
    return NextResponse.json({ x: 50, y: 40, hasFace: false });
  }
}
