-- Create reviews table for Instagram stories/customer reviews
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url TEXT NOT NULL,
    caption TEXT,
    author TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active reviews ordered by sort_order
CREATE INDEX IF NOT EXISTS idx_reviews_active_sort ON reviews(is_active, sort_order) WHERE is_active = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_reviews_updated_at();

-- Insert default reviews (using existing hardcoded data)
INSERT INTO reviews (image_url, author, category, is_active, sort_order) VALUES
('https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600', '@maybe_natasha', 'Весільна книга', true, 1),
('https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=600', '@nasstya.ss', 'Travel Book', true, 2),
('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600', '@ann_surovtseva', 'Family Album', true, 3),
('https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600', '@shcherbakova_mladshaya', 'Design Service', true, 4),
('https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600', '@nataplushcheva', 'Photo Print', true, 5);
