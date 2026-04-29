import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface EditorNewPageProps {
  searchParams: {
    product?: string
    format?: string
    pages?: string
  }
}

// Routes /editor/new to a freshly-allocated temp editor session.
// The real project record gets created later by `saveDesignToProjects` in
// BookLayoutEditor when the user explicitly saves or orders. There is no
// `editor_projects` table — that was a legacy idea that was never built.
export default async function EditorNewPage({ searchParams }: EditorNewPageProps) {
  const product = searchParams.product || 'photobook'
  const format = searchParams.format || '20x20'
  const pages = parseInt(searchParams.pages || '20', 10)

  redirect(`/editor/temp-${Date.now()}?product=${product}&format=${format}&pages=${pages}`)
}
