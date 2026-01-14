-- Create areas table for organizing projects into areas of life/responsibility
-- Examples: Work, Health, Family, Finance, Personal Growth, etc.
-- Follows the same pattern as contexts table with RLS

CREATE TABLE IF NOT EXISTS areas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own areas
CREATE POLICY "Users can view own areas"
    ON areas
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own areas
CREATE POLICY "Users can insert own areas"
    ON areas
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own areas
CREATE POLICY "Users can update own areas"
    ON areas
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own areas
CREATE POLICY "Users can delete own areas"
    ON areas
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_areas_user_id ON areas(user_id);
CREATE INDEX IF NOT EXISTS idx_areas_sort_order ON areas(sort_order);

-- Add comments
COMMENT ON TABLE areas IS 'Life/responsibility areas for organizing projects (Work, Health, Family, etc.)';
COMMENT ON COLUMN areas.name IS 'Area name (encrypted client-side), e.g., Work, Health, Family';
COMMENT ON COLUMN areas.sort_order IS 'Display order for areas in the dropdown menu';
