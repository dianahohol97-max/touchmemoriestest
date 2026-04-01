import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface EditorNewPageProps {
  searchParams: {
    product?: string
    format?: string
    pages?: string
  }
}

export default async function EditorNewPage({ searchParams }: EditorNewPageProps) {
  const product = searchParams.product || 'photobook'
  const format = searchParams.format || '20x20'
  const pages = parseInt(searchParams.pages || '20', 10)

  try {
    const supabase = await createClient()

    // Create a new editor project in Supabase
    const { data, error } = await supabase
      .from('editor_projects')
      .insert({
        product,
        format,
        page_count: pages,
        name: `${product} ${format} ${pages}p`,
        status: 'draft',
        pages_data: [],
        cover_data: null,
        uploaded_photos: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) {
      // If table doesn't exist or insert fails, redirect to editor with temp ID
      redirect(`/editor/temp-${Date.now()}?product=${product}&format=${format}&pages=${pages}`)
    }

    redirect(`/editor/${data.id}`)
  } catch {
    // Fallback: redirect with temporary project ID
    redirect(`/editor/temp-${Date.now()}?product=${product}&format=${format}&pages=${pages}`)
  }
}
