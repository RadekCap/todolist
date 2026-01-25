-- Add density_mode column to user_settings table
-- Allows users to choose between 'comfortable' and 'compact' display density

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS density_mode VARCHAR(20) DEFAULT 'comfortable';

-- Add comment to column
COMMENT ON COLUMN user_settings.density_mode IS 'Display density preference: comfortable or compact';
