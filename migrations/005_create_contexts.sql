-- Create contexts table for GTD contexts (@home, @work, @errands, etc.)
-- Follows the same pattern as categories table with RLS

CREATE TABLE IF NOT EXISTS contexts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own contexts
CREATE POLICY "Users can view own contexts"
    ON contexts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own contexts
CREATE POLICY "Users can insert own contexts"
    ON contexts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own contexts
CREATE POLICY "Users can update own contexts"
    ON contexts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own contexts
CREATE POLICY "Users can delete own contexts"
    ON contexts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contexts_user_id ON contexts(user_id);

-- Add comments
COMMENT ON TABLE contexts IS 'GTD contexts like @home, @work, @errands for location/tool-based filtering';
COMMENT ON COLUMN contexts.name IS 'Context name (encrypted), typically prefixed with @ symbol';
