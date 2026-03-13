import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.20.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhotoMetadata {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
}

interface AIPhotoAnalysis {
  photo_id: string;
  quality_score: number;
  subject_type: 'portrait' | 'landscape' | 'group' | 'object' | 'detail';
  has_faces: boolean;
  face_count: number;
  brightness: 'dark' | 'normal' | 'bright';
  composition: 'centered' | 'rule-of-thirds' | 'off-center';
  suggested_layout: 'full-bleed' | 'two-col' | 'single' | 'collage';
  description: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    });

    // Get brief data
    const { data: brief, error: briefError } = await supabaseClient
      .from('design_briefs')
      .select(`
        *,
        order:orders(
          id,
          order_number,
          customer:customers(name, email)
        )
      `)
      .eq('token', token)
      .single();

    if (briefError || !brief) {
      throw new Error('Brief not found');
    }

    // Update status to processing
    await supabaseClient
      .from('design_briefs')
      .update({ status: 'ai_processing' })
      .eq('token', token);

    const photos = brief.photos_metadata as PhotoMetadata[];

    if (!photos || photos.length === 0) {
      throw new Error('No photos found');
    }

    console.log(`Processing ${photos.length} photos for brief ${token}`);

    // Step 1: Analyze each photo with Claude Vision API
    const photoAnalyses: AIPhotoAnalysis[] = [];

    // Process photos in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (photo) => {
          try {
            // Fetch the image and convert to base64
            const imageResponse = await fetch(photo.url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

            // Analyze photo with Claude Vision
            const message = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 500,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: 'image/jpeg',
                        data: base64Image,
                      },
                    },
                    {
                      type: 'text',
                      text: `Analyze this photo for a photobook design. Return a JSON object with:
{
  "quality_score": 1-10 (overall quality),
  "subject_type": "portrait|landscape|group|object|detail",
  "has_faces": true/false,
  "face_count": number of faces,
  "brightness": "dark|normal|bright",
  "composition": "centered|rule-of-thirds|off-center",
  "suggested_layout": "full-bleed|two-col|single|collage",
  "description": "brief description in Ukrainian (max 50 words)"
}

Only return the JSON object, no other text.`,
                    },
                  ],
                },
              ],
            });

            const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
            const analysis = JSON.parse(responseText);

            return {
              photo_id: photo.id,
              ...analysis,
            };
          } catch (error) {
            console.error(`Error analyzing photo ${photo.id}:`, error);
            // Return default analysis if failed
            return {
              photo_id: photo.id,
              quality_score: 5,
              subject_type: 'object' as const,
              has_faces: false,
              face_count: 0,
              brightness: 'normal' as const,
              composition: 'centered' as const,
              suggested_layout: 'single' as const,
              description: 'Фото не вдалося проаналізувати',
            };
          }
        })
      );

      photoAnalyses.push(...batchResults);

      // Add a small delay between batches to respect rate limits
      if (i + batchSize < photos.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`Analyzed ${photoAnalyses.length} photos`);

    // Step 2: Generate layout plan
    const layoutPrompt = `You are an expert photobook designer. Based on the following information, create a detailed layout plan for a photobook.

**Brief Details:**
- Occasion: ${brief.occasion}
- Style: ${brief.style_preference}
- Is Gift: ${brief.is_gift}
- Title Text: ${brief.title_text || 'No title'}
- Important Photos: ${brief.important_photos || 'None specified'}
- Additional Notes: ${brief.additional_notes || 'None'}
- Photo Order Preference: ${brief.photo_order}

**Photo Analysis:**
${photoAnalyses.map((analysis, idx) => `
Photo ${idx + 1} (ID: ${analysis.photo_id}):
- Quality: ${analysis.quality_score}/10
- Type: ${analysis.subject_type}
- Faces: ${analysis.face_count}
- Description: ${analysis.description}
- Suggested Layout: ${analysis.suggested_layout}
`).join('\n')}

**Task:** Create a layout plan for a 20-page photobook. Return ONLY a JSON object with this structure:

{
  "pages": [
    {
      "page": 1,
      "type": "title",
      "template": "cover",
      "text": "title text here",
      "background_color": "#color",
      "text_color": "#color"
    },
    {
      "page": 2,
      "type": "content",
      "template": "full-bleed|two-col|single|collage",
      "photo_ids": ["photo_id_1", "photo_id_2"],
      "caption": "optional caption in Ukrainian",
      "layout": "description of how photos are arranged"
    }
  ],
  "total_pages": 20,
  "style_applied": "${brief.style_preference}",
  "occasion": "${brief.occasion}"
}

**Guidelines:**
1. First page should be a title page
2. Use high-quality photos (score 7+) for full-bleed layouts
3. Group similar photos together
4. Vary the layout to keep it interesting
5. Place important photos prominently
6. Follow the style preference (colors, layout density)
7. Respect the occasion theme
8. If ${brief.photo_order} is "chronological", try to maintain order
9. Create a balanced flow throughout the book
10. Last page can be a conclusion or back cover

Return ONLY the JSON object, no other text.`;

    const layoutMessage = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: layoutPrompt,
        },
      ],
    });

    const layoutResponseText = layoutMessage.content[0].type === 'text' ? layoutMessage.content[0].text : '';
    const layoutPlan = JSON.parse(layoutResponseText);

    console.log('Generated layout plan with', layoutPlan.pages.length, 'pages');

    // Step 3: Update brief with AI results
    await supabaseClient
      .from('design_briefs')
      .update({
        status: 'ai_done',
        ai_analysis_result: photoAnalyses,
        ai_layout_plan: layoutPlan,
        ai_processed_at: new Date().toISOString(),
        // Update photos_metadata with analysis
        photos_metadata: photos.map((photo) => {
          const analysis = photoAnalyses.find((a) => a.photo_id === photo.id);
          return {
            ...photo,
            score: analysis?.quality_score,
            analysis,
          };
        }),
      })
      .eq('token', token);

    // Step 4: Create draft photobook project
    // TODO: Implement actual canvas data generation based on layout plan
    // For now, we'll just mark the brief as AI-processed

    console.log('AI processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Brief processed successfully',
        photos_analyzed: photoAnalyses.length,
        pages_generated: layoutPlan.pages.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing brief:', error);

    // Try to update brief with error
    try {
      const { token } = await req.json();
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseClient
        .from('design_briefs')
        .update({
          status: 'brief_received',
          ai_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('token', token);
    } catch (updateError) {
      console.error('Error updating brief with error:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
