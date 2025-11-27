-- Create user_settings table for storing user preferences
-- This table stores user-specific settings like color theme preference

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    color_theme VARCHAR(20) DEFAULT 'purple',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own settings
CREATE POLICY "Users can view own settings"
    ON user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
    ON user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings"
    ON user_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own settings
CREATE POLICY "Users can delete own settings"
    ON user_settings
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster lookups by user_id
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Add comment to table
COMMENT ON TABLE user_settings IS 'Stores user preferences like color theme selection';
COMMENT ON COLUMN user_settings.color_theme IS 'Color theme preference: purple, blue, green, orange, dark, or light';
