import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Check if Anthropic API key is configured
        if (!process.env.ANTHROPIC_API_KEY) {
            return NextResponse.json({
                error: 'AI service not configured. Please add ANTHROPIC_API_KEY to your environment variables.'
            }, { status: 503 });
        }

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: { user } } = await supabase.auth.getUser();

        // Temporarily turning off strict auth check for MVP/Ease of use in this AI endpoint,
        // but normally you require authentication here:
        // if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

        const body = await req.json();
        const { action, payload } = body;

        let systemPrompt = "Ти експерт з контент-маркетингу для українського бізнесу з виготовлення фотокниг та фотопродуктів Touch Memories. Відповідай тільки українською мовою.";
        let userMessage = '';

        if (action === 'generate_structure') {
            userMessage = `Створи детальну структуру статті для блогу на тему: ${payload.title}. 
            Поверни структуру у вигляді H2 та H3 заголовків з коротким описом кожного розділу (1-2 речення).
            Структура має бути практичною та корисною для читача.`;
        } else if (action === 'generate_meta') {
            systemPrompt = "Ти SEO-спеціаліст для українського інтернет-магазину фотопродуктів Touch Memories. Відповідай тільки українською мовою. Повертай відповідь ТІЛЬКИ у форматі JSON, без жодного тексту до або після JSON.";
            userMessage = `Згенеруй SEO-дані для статті блогу з заголовком: ${payload.title}.
            Поверни JSON у такому форматі:
            {
              "meta_title": "...",
              "meta_description": "...",
              "keywords": ["...", "...", "...", "...", "..."]
            }
            meta_title — до 60 символів.
            meta_description — до 155 символів.
            keywords — рівно 5 ключових слів.`;
        } else if (action === 'generate_expert') {
            systemPrompt = "Ти експертний автор блогу для українського бізнесу Touch Memories — виготовлення фотокниг, фотодруку та персоналізованих подарунків. Пиши природно, тепло, з експертністю. Відповідай тільки українською мовою.";
            userMessage = `Напиши експертний вступний абзац для статті блогу з заголовком: ${payload.title}.
            Абзац має:
            - бути 3-4 речення
            - зацікавити читача з першого рядка
            - показати експертність та користь статті
            - звучати природно, не як реклама`;
        } else if (action === 'generate_excerpt') {
            userMessage = `Generate a compelling, click-worthy excerpt (150-160 characters) in Ukrainian based on the following text: "${payload.text}". Only return the excerpt text, nothing else.`;
        } else if (action === 'suggest_tags') {
            userMessage = `Based on the title "${payload.title}" and excerpt "${payload.excerpt}" for a photobook store blog, suggest 5-8 relevant SEO tags in Ukrainian. Return ONLY a comma-separated list of tags in lowercase.`;
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        });

        // @ts-ignore
        let text = message.content[0].text;

        if (action === 'generate_meta') {
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                const rawJson = jsonMatch ? jsonMatch[0] : text;
                return NextResponse.json(JSON.parse(rawJson));
            } catch (e) {
                console.error("AI Output parse error:", text);
                return NextResponse.json({ error: 'Failed to parse AI output. Try again.' }, { status: 500 });
            }
        }

        if (action === 'suggest_tags') {
            const tags = text.split(',').map((t: string) => t.trim().replace(/\.$/, '')).filter(Boolean);
            return NextResponse.json({ tags });
        }

        return NextResponse.json({ result: text.trim() });

    } catch (error: any) {
        console.error('AI Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
