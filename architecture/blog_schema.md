# Blog Schema Architecture

## Overview
This document defines the data schema and architectural decisions for the SEO-optimized blog feature on the TouchMemories e-commerce platform.

## Data Schemas

### blog_categories
```json
{
  "id": "uuid (PK)",
  "name": "text",
  "slug": "text (unique)",
  "description": "text",
  "sort_order": "int",
  "is_active": "boolean"
}
```

### blog_posts
```json
{
  "id": "uuid (PK)",
  "title": "text",
  "slug": "text (unique)",
  "category_id": "uuid (FK -> blog_categories)",
  "author_name": "text",
  "author_avatar": "text (Storage URL)",
  "cover_image": "text (Storage URL)",
  "cover_image_alt": "text",
  "excerpt": "text (150-160 chars)",
  "content": "text (HTML or Markdown)",
  "reading_time": "int",
  "tags": "text[]",
  "related_product_ids": "uuid[]",
  "meta_title": "text",
  "meta_description": "text",
  "og_title": "text",
  "is_published": "boolean (default false)",
  "is_featured": "boolean",
  "published_at": "timestamptz",
  "views_count": "int (default 0)",
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```

## AI Content Generation
We integrate with the Anthropic API (Claude) on the admin panel to assist with:
- Generating article structure (H2/H3).
- Generating meta titles and descriptions (3 variants).
- Generating excerpts based on the first paragraph.
- Suggesting tags.

This will be exposed via a Next.js API route (`/api/admin/ai/generate`).

## SEO Architecture
1. **Dynamic Open Graph & Twitter Cards**: Utilizing Next.js `generateMetadata` for `/blog/[slug]`.
2. **Schema.org JSON-LD**: `Article` and `BreadcrumbList` schemas injected into the `<head>` of blog post pages.
3. **Sitemap**: Post URLs and categories appended to `/app/sitemap.ts`.
4. **RSS Feed**: Generated dynamically at `/app/blog/rss.xml/route.ts`.

## View Tracking
A view counter is implemented at `/api/blog/[slug]/view` with rudimentary rate limiting (1 view per IP per 24 hours - maybe using redis or local cache/DB logging, but simple DB update `views_count + 1` for MVP).

## Edge Cases & Reliability
- Content regeneration using AI must handle timeouts gracefully.
- The `slug` must be unique across all blog posts to prevent 404s or collisions. Enforced at the DB level.
