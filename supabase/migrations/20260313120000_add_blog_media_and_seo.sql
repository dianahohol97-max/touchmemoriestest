-- Add keywords and content_images to blog_posts
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS content_images text[] DEFAULT '{}';
