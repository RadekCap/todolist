-- Add username column to user_settings table
-- Allows users to set a display name instead of showing email

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Add comment to column
COMMENT ON COLUMN user_settings.username IS 'User display name shown instead of email';
