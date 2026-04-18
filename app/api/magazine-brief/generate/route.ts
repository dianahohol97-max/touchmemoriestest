import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TOPIC_PROMPTS: Record<string, string> = {
  'intro': 'передмова — хто ця людина, яка вона є насправді',
  'friendship': 'дружба — як вона дружить, що таке справжня дружба для неї',
  'family': 'сімʼя і дім — що означає для неї дім, рідні люди',
  'love': 'любов і стосунки — як вона кохає, що важливо в стосунках',
  'favourites': 'улюблені речі — що вона обожнює, маленькі радощі та ритуали',
  'strength': 'сила і характер — яка вона всередині, що робить її особливою',
  'memories': 'спільні спогади — моменти які обʼєднують вас',
  'future': 'побажання на майбутнє — що ти їй бажаєш від серця',
};

function buildPrompt(brief: any, topic: string, topicIndex: number, totalPages: number): string {
  const topicDesc = TOPIC_PROMPTS[topic] || topic;
  const toneMap: Record<string, string> = {
    warm: 'ніжний і теплий, як пише близька подруга — щиро, без пафосу',
    humor: 'з легким гумором і теплотою, живий і трохи з іронією — але ніжно',
    poetic: 'поетичний, з метафорами і образами, але не пишномовний',
    mix: 'теплий з легкою іронією — як пише людина, яка добре знає і любить цю людину',
  };
  const toneDesc = toneMap[brief.tone] || toneMap.warm;
  const langMap: Record<string, string> = { uk: 'українська', en: 'англійська', pl: 'польська', ro: 'румунська' };
  const lang = langMap[brief.language] || 'українська';

  const details = [
    brief.three_words && `Три слова про неї: ${brief.three_words}`,
    brief.what_amazes && `Що вражає в ній: ${brief.what_amazes}`,
    brief.in_hard_moments && `У складні моменти вона: ${brief.in_hard_moments}`,
    brief.superpower && `Її суперсила: ${brief.superpower}`,
    brief.never_does && `Вона ніколи не: ${brief.never_does}`,
    brief.unforgettable_moment && `Незабутній момент: ${brief.unforgettable_moment}`,
    brief.when_you_feel_bad && `Коли вам погано вона: ${brief.when_you_feel_bad}`,
    brief.funny_situation && `Смішна ситуація між вами: ${brief.funny_situation}`,
    brief.loves && `Обожнює: ${brief.loves}`,
    brief.small_habit && `Маленька звичка: ${brief.small_habit}`,
    brief.morning_ritual && `Зранку: ${brief.morning_ritual}`,
    brief.music_film && `Музика або фільм: ${brief.music_film}`,
    brief.how_she_laughs && `Як сміється: ${brief.how_she_laughs}`,
    brief.subject_city && `Місто: ${brief.subject_city}`,
    brief.subject_age && `Вік або скільки знайомі: ${brief.subject_age}`,
  ].filter(Boolean).join('\n');

  return `Ти пишеш текст для однієї сторінки персонального глянцевого журналу про людину на ім'я ${brief.subject_name}.

ТЕМА ЦІЄЇ СТОРІНКИ: ${topicDesc}
СТОРІНКА: ${topicIndex + 1} з ${totalPages}
СТОСУНКИ: ${brief.relationship}

ДЕТАЛІ ПРО ЛЮДИНУ:
${details}

СТИЛЬ: ${toneDesc}
МОВА: ${lang}
ОБСЯГ: 120-180 слів

ПРАВИЛА (обовʼязкові):
1. Пиши ніби ти — близька людина. НЕ як AI, НЕ як копірайтер, НЕ офіційно.
2. Використовуй конкретні деталі з анкети — імʼя, звички, спогади. Не пиши абстрактно.
3. Чергуй короткі (3-7 слів) і довгі речення. Ніколи рівномірно.
4. Тире замість ком для драматичної паузи: "Вона не з тих — вона просто є."
5. Люби конструкцію: "Це не про X. Це про Y." або "Вона не з тих, хто..."
6. ЗАБОРОНЕНО: "неймовірна", "дивовижна", "неперевершена", "унікальна" — шаблонно.
7. ЗАБОРОНЕНО: списки з крапками, питання до читача типу "чи знаєш ти?"
8. ЗАБОРОНЕНО: плейсхолдери [ім'я] — вставляй справжнє імʼя ${brief.subject_name}
9. Заголовок сторінки — 1-4 слова, може бути англійською або великими літерами.
10. Текст має звучати як написаний живою людиною яка зупинилась і написала від серця.

Відповідай ТІЛЬКИ у форматі JSON без markdown:
{"title": "ЗАГОЛОВОК", "text": "текст сторінки"}`;
}

export async function POST(request: NextRequest) {
  try {
    const { briefId } = await request.json();
    if (!briefId) return NextResponse.json({ error: 'briefId required' }, { status: 400 });

    const { data: brief, error: briefError } = await supabase
      .from('magazine_briefs')
      .select('*')
      .eq('id', briefId)
      .single();

    if (briefError || !brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });

    await supabase.from('magazine_briefs').update({ status: 'generating', updated_at: new Date().toISOString() }).eq('id', briefId);

    const topics: string[] = brief.page_topics || ['intro', 'friendship', 'strength', 'favourites'];
    const pages: any[] = [];

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const prompt = buildPrompt(brief, topic, i, topics.length);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '{}';

      let parsed: any = { title: topic.toUpperCase(), text: rawText };
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch {}

      pages.push({ page: i + 1, topic, title: parsed.title || topic.toUpperCase(), text: parsed.text || rawText, edited_text: null });

      if (i < topics.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    await supabase.from('magazine_briefs').update({
      status: 'done',
      generated_pages: pages,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', briefId);

    // Notify email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';
    fetch(`${siteUrl}/api/magazine-brief/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId, customerEmail: brief.customer_email, customerName: brief.customer_name, subjectName: brief.subject_name }),
    }).catch(() => {});

    return NextResponse.json({ success: true, pages });
  } catch (e) {
    console.error('[generate]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
